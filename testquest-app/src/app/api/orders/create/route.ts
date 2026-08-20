import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { getRazorpay } from "@/lib/razorpay";
import { handleApiError, parseBody, success, error } from "@/lib/api-utils";
import { quoteOrder, QuoteError } from "@/lib/commerce";
import { grantClassAccess } from "@/lib/passes";
import { paiseToRupees } from "@/lib/money";

/**
 * Order creation. One item type: a prepaid Board+Class pass.
 *
 * The client sends a plan id and maybe a coupon — never an amount. The price
 * is quoted here from `tq_b2c_plans` through `resolvePlanPricing`, and the
 * quote is recomputed rather than trusted from whatever `/coupons/validate`
 * returned to the browser earlier.
 *
 * Money on the order row is **paise**; `quoteOrder` did the single ×100, and
 * Razorpay is handed `finalAmount` unchanged.
 */
const createOrderSchema = z.object({
  itemType: z.literal("B2C_PLAN").default("B2C_PLAN"),
  /** `tq_b2c_plans.id` */
  itemId: z.number().int().positive(),
  couponCode: z.string().optional(),
}).strict();

export async function POST(request: Request) {
  try {
    const session = await requireAuth("student");
    const body = await parseBody(request, createOrderSchema);

    let quote;
    try {
      quote = await quoteOrder(body.itemId, session.id, body.couponCode);
    } catch (err) {
      if (err instanceof QuoteError) return error(err.message, err.status);
      throw err;
    }

    // ── Free after a 100% coupon ──────────────────────────────────────────
    // No payment provider is involved, so nothing external validates this —
    // it goes through the same mutex as a paid grant, and the coupon's limits
    // are re-checked inside that transaction. The order is still written and
    // still reaches PAID, so a free redemption is as auditable as a sale.
    if (quote.finalAmount === 0) {
      const order = await prisma.order.create({
        data: {
          studentId: session.id,
          itemType: "B2C_PLAN",
          planId: quote.planId,
          boardId: quote.boardId,
          classId: quote.classId,
          amount: quote.amount,
          discount: quote.discount,
          finalAmount: 0,
          couponCode: quote.couponCode,
          status: "PENDING",
        },
      });

      const granted = await grantClassAccess(order.id);
      if (!granted.granted) {
        await prisma.order.updateMany({
          where: { id: order.id, status: "PENDING" },
          data: { status: "FAILED" },
        });
        return error(
          granted.reason === "coupon_exhausted"
            ? "That coupon has just been fully used."
            : "Could not complete this order.",
          409,
        );
      }

      return success({
        orderId: order.id,
        free: true,
        expiresAt: granted.expiresAt,
        message: "Access granted!",
      });
    }

    // ── Paid ──────────────────────────────────────────────────────────────
    const razorpay = getRazorpay();
    const rzpOrder = await razorpay.orders.create({
      // Already paise. The ×100 happened once, in quoteOrder.
      amount: quote.finalAmount,
      currency: "INR",
      receipt: `tq_plan_${quote.planId}_${session.id}`,
      notes: {
        studentId: String(session.id),
        planId: String(quote.planId),
        boardId: String(quote.boardId),
        classId: String(quote.classId),
      },
    });

    const order = await prisma.order.create({
      data: {
        studentId: session.id,
        itemType: "B2C_PLAN",
        planId: quote.planId,
        boardId: quote.boardId,
        classId: quote.classId,
        amount: quote.amount,
        discount: quote.discount,
        finalAmount: quote.finalAmount,
        couponCode: quote.couponCode,
        razorpayOrderId: rzpOrder.id,
        status: "PENDING",
      },
    });

    return success({
      orderId: order.id,
      razorpayOrderId: rzpOrder.id,
      razorpayKeyId: process.env.RAZORPAY_KEY_ID,
      /** Rupees, for display only. */
      amount: paiseToRupees(quote.finalAmount),
      /** What the Razorpay handoff must use verbatim. */
      amountInPaise: quote.finalAmount,
      currency: "INR",
    });
  } catch (err) {
    return handleApiError(err);
  }
}
