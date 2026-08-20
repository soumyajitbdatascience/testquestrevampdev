/**
 * Granting a class pass — the only place `tq_class_access` is written.
 *
 * Two paths call this and they race by design: the browser returns from
 * Razorpay and verifies the signature, while Razorpay's webhook delivers
 * `payment.captured` independently. Whichever arrives first grants; the other
 * must do nothing at all.
 *
 * ── How exactly-once is achieved without a schema change ───────────────────
 * The `PENDING → PAID` flip is the mutex, and it is the **first write inside
 * the same transaction** as the grant:
 *
 *     tx.order.updateMany({ where: { id, status: "PENDING" }, data: { PAID } })
 *
 * `updateMany` with a status predicate is atomic — exactly one caller sees
 * `count === 1`. The loser sees `0` and throws, rolling its transaction back
 * having written nothing.
 *
 * The flip being *inside* the transaction is what makes the webhook backstop
 * real. If the order were marked PAID in a separate statement first and the
 * process then died, the order would be PAID with no `ClassAccess` — and the
 * webhook, seeing a non-PENDING order, would decline to grant. The student
 * would have paid for nothing. Committing them together means a crash rolls
 * back the flip too, leaving the order PENDING for the webhook to retry.
 *
 * ── Extension rule (Phase 4 renew uses this same function) ─────────────────
 * A pass starts at `max(now, current expiry)`, so buying while still active
 * appends to the end and unused days are never lost. `addMonths` clamps at
 * month ends, so 30 Nov + 3 months is 28 Feb rather than 2 March.
 */
import { prisma } from "@/lib/db";
import { track } from "@/lib/events";
import { addMonths, paiseToRupees } from "@/lib/money";
import { computeDiscount } from "@/lib/commerce";

export interface GrantResult {
  granted: boolean;
  /** True when this call was the one that flipped the order to PAID. */
  first: boolean;
  expiresAt?: Date;
  reason?: string;
}

/**
 * Marks an order paid and grants its pass, atomically and exactly once.
 *
 * `payment` carries the Razorpay identifiers to stamp on the order; the free
 * (100%-coupon) path passes none.
 */
export async function grantClassAccess(
  orderId: number,
  payment?: { razorpayPaymentId?: string; razorpaySignature?: string },
): Promise<GrantResult> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true, studentId: true, itemType: true, planId: true, status: true,
      couponCode: true, amount: true, finalAmount: true,
    },
  });
  if (!order) return { granted: false, first: false, reason: "order_not_found" };
  if (order.itemType !== "B2C_PLAN" || !order.planId) {
    return { granted: false, first: false, reason: "not_a_plan_order" };
  }

  // Already granted by the other path — the caller's work is done, and this is
  // a success, not an error: both verify and webhook legitimately land here.
  if (order.status === "PAID") {
    const existing = await prisma.classAccess.findFirst({
      where: { orderId },
      orderBy: { expiresAt: "desc" },
      select: { expiresAt: true },
    });
    return { granted: !!existing, first: false, expiresAt: existing?.expiresAt, reason: "already_paid" };
  }
  if (order.status === "FAILED") return { granted: false, first: false, reason: "order_failed" };

  const plan = await prisma.b2cPlan.findUnique({ where: { id: order.planId } });
  if (!plan) return { granted: false, first: false, reason: "plan_missing" };

  try {
    const result = await prisma.$transaction(async (tx) => {
      // ── FIRST WRITE: the mutex. Anything before this could be done twice.
      const claimed = await tx.order.updateMany({
        where: { id: orderId, status: "PENDING" },
        data: {
          status: "PAID",
          ...(payment?.razorpayPaymentId ? { razorpayPaymentId: payment.razorpayPaymentId } : {}),
          ...(payment?.razorpaySignature ? { razorpaySignature: payment.razorpaySignature } : {}),
        },
      });
      if (claimed.count === 0) {
        // Another caller won. Roll back and report; nothing was written.
        throw new AlreadyClaimed();
      }

      // Coupon redemption is settled here, inside the mutex and *before* the
      // pass is written, so an exhausted coupon aborts with nothing to undo.
      //
      // The order-status flip above does NOT protect this: two students
      // redeeming the same coupon hold two different orders, so both flips
      // succeed. Under MySQL's REPEATABLE READ each transaction would then
      // count redemptions against its own snapshot, both read "0 used", and a
      // one-use coupon would be redeemed twice — verified happening before
      // this lock was added. `FOR UPDATE` takes a row lock on the coupon, so
      // the second transaction waits for the first to commit and then sees the
      // real count. The lock is on the coupon row because the coupon, not the
      // order, is the contended resource.
      if (order.couponCode) {
        const coupon = await tx.coupon.findFirst({ where: { code: order.couponCode } });
        if (coupon) {
          await tx.$queryRaw`SELECT id FROM tq_coupons WHERE id = ${coupon.id} FOR UPDATE`;
          const [totalUsed, mineUsed, already] = await Promise.all([
            tx.couponUsage.count({ where: { couponId: coupon.id } }),
            tx.couponUsage.count({ where: { couponId: coupon.id, studentId: order.studentId } }),
            tx.couponUsage.count({ where: { couponId: coupon.id, orderId: order.id } }),
          ]);
          const overTotal = coupon.totalLimit != null && totalUsed >= coupon.totalLimit;
          const overUser = coupon.perUserLimit != null && mineUsed >= coupon.perUserLimit;
          if (overTotal || overUser) throw new CouponExhausted();
          if (already === 0) {
            await tx.couponUsage.create({
              data: { couponId: coupon.id, studentId: order.studentId, orderId: order.id },
            });
          }
        }
      }

      const now = new Date();
      const prev = await tx.classAccess.findFirst({
        where: { studentId: order.studentId, boardId: plan.boardId, classId: plan.classId },
        orderBy: { expiresAt: "desc" },
        select: { expiresAt: true },
      });
      const startsAt = prev && prev.expiresAt > now ? prev.expiresAt : now;
      const expiresAt = addMonths(startsAt, plan.durationMonths);

      await tx.classAccess.create({
        data: {
          studentId: order.studentId,
          boardId: plan.boardId,
          classId: plan.classId,
          planId: plan.id,
          orderId: order.id,
          startsAt,
          expiresAt,
        },
      });

      // A purchase implies a browsing context for what was bought.
      await tx.studentContext.upsert({
        where: {
          studentId_boardId_classId: {
            studentId: order.studentId, boardId: plan.boardId, classId: plan.classId,
          },
        },
        create: { studentId: order.studentId, boardId: plan.boardId, classId: plan.classId },
        update: {},
      });

      return { expiresAt, renewal: !!(prev && prev.expiresAt > now) };
    });

    await track("pass_purchased", order.studentId, {
      orderId: order.id,
      planId: plan.id,
      boardId: plan.boardId,
      classId: plan.classId,
      durationMonths: plan.durationMonths,
      amountRupees: paiseToRupees(Number(order.finalAmount)),
      renewal: result.renewal,
    });

    return { granted: true, first: true, expiresAt: result.expiresAt };
  } catch (err) {
    if (err instanceof AlreadyClaimed) {
      const existing = await prisma.classAccess.findFirst({
        where: { orderId }, orderBy: { expiresAt: "desc" }, select: { expiresAt: true },
      });
      return { granted: !!existing, first: false, expiresAt: existing?.expiresAt, reason: "lost_race" };
    }
    if (err instanceof CouponExhausted) {
      return { granted: false, first: false, reason: "coupon_exhausted" };
    }
    throw err;
  }
}

class AlreadyClaimed extends Error {}
class CouponExhausted extends Error {}

/** Re-export so callers pricing a redemption don't reach past this module. */
export { computeDiscount };

/**
 * Back-compat alias. The old name said "pass for order"; the thing it grants
 * is class access, and the two paths that call it care that it is exactly once.
 */
export const grantPassForOrder = grantClassAccess;
