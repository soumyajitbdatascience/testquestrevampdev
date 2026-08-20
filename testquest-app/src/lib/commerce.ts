/**
 * Order quoting — the single server-side authority on what a pass costs.
 *
 * The client never sends an amount. It sends a plan id and, optionally, a
 * coupon code; everything else is derived here from `tq_b2c_plans` through
 * `resolvePlanPricing`, the same fail-closed resolver the admin grid and
 * Launch Readiness use. Going through the resolver rather than reading
 * `plan.price` directly is what stops an inactive or zero-priced term being
 * bought: if the resolver says that duration is not on sale, there is no quote.
 *
 * A quote is advisory until an order is created — `/api/coupons/validate` uses
 * it for a live preview, and `/api/orders/create` recomputes it rather than
 * trusting anything the preview returned.
 *
 * All amounts leaving this module are **paise** (see `money.ts`).
 */
import { prisma } from "@/lib/db";
import { resolvePlanPricing, type PlanRow, type PlanDuration } from "@/lib/pricing";
import { rupeesToPaise } from "@/lib/money";

export interface Quote {
  planId: number;
  boardId: number;
  classId: number;
  durationMonths: number;
  /** List price, paise. */
  amount: number;
  /** Coupon discount, paise. Never exceeds `amount`. */
  discount: number;
  /** What the student actually pays, paise. Zero is legitimate. */
  finalAmount: number;
  couponCode: string | null;
  couponId: number | null;
}

export class QuoteError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

/**
 * Prices one plan, optionally with a coupon.
 *
 * Throws `QuoteError` with a student-readable message — the caller turns it
 * into the HTTP response.
 */
export async function quoteOrder(
  planId: number,
  studentId: number,
  couponCode?: string | null,
): Promise<Quote> {
  const plan = await prisma.b2cPlan.findFirst({
    where: { id: planId, isActive: true, subjectId: null },
    select: { id: true, boardId: true, classId: true, durationMonths: true },
  });
  if (!plan) throw new QuoteError("Plan not found", 404);

  // Price comes from the resolver's view of this board+class, not from the row
  // we just read: the resolver drops terms that are inactive or non-positive
  // and picks the cheapest row when data has drifted, so a student can never be
  // charged more than a price we published.
  const rows = await prisma.b2cPlan.findMany({
    where: { boardId: plan.boardId, classId: plan.classId, subjectId: null },
    select: { boardId: true, classId: true, durationMonths: true, price: true, isActive: true },
  });
  const pricing = resolvePlanPricing(
    rows.map((r): PlanRow => ({
      boardId: r.boardId,
      classId: r.classId,
      durationMonths: r.durationMonths,
      price: Number(r.price),
      isActive: r.isActive,
    })),
    { boardId: plan.boardId, classId: plan.classId },
  );

  const rupees = pricing.byDuration[plan.durationMonths as PlanDuration] ?? null;
  if (rupees == null) {
    throw new QuoteError("This plan isn't on sale right now", 409);
  }

  const amount = rupeesToPaise(rupees);
  let discount = 0;
  let resolvedCode: string | null = null;
  let couponId: number | null = null;

  if (couponCode && couponCode.trim()) {
    const coupon = await evaluateCoupon(couponCode, studentId, amount);
    discount = coupon.discount;
    resolvedCode = coupon.code;
    couponId = coupon.id;
  }

  return {
    planId: plan.id,
    boardId: plan.boardId,
    classId: plan.classId,
    durationMonths: plan.durationMonths,
    amount,
    discount,
    finalAmount: Math.max(0, amount - discount),
    couponCode: resolvedCode,
    couponId,
  };
}

export interface CouponEvaluation {
  id: number;
  code: string;
  /** Paise. */
  discount: number;
}

/**
 * The one coupon evaluator. Validity window, minimum order, scope and both
 * usage limits — previously duplicated across `/orders/create` and
 * `/coupons/validate` with subtly different rules (one upper-cased the code,
 * the other didn't).
 *
 * The limit checks here are a *preview*. They are re-run inside the granting
 * transaction, because between a check and a commit another redemption can
 * land — this function cannot be the enforcement point.
 */
export async function evaluateCoupon(
  rawCode: string,
  studentId: number,
  amountPaise: number,
): Promise<CouponEvaluation> {
  const code = rawCode.trim().toUpperCase();
  const coupon = await prisma.coupon.findFirst({ where: { code, isActive: true } });
  if (!coupon) throw new QuoteError("Invalid coupon code");

  const now = new Date();
  if ((coupon.validFrom && now < coupon.validFrom) || (coupon.validUntil && now > coupon.validUntil)) {
    throw new QuoteError("Coupon has expired");
  }

  const minOrder = rupeesToPaise(Number(coupon.minOrder));
  if (minOrder > amountPaise) {
    throw new QuoteError(`Minimum order value for this coupon is ₹${Number(coupon.minOrder)}`);
  }

  if (coupon.scope === "FIRST_TIME") {
    const prior = await prisma.order.count({ where: { studentId, status: "PAID" } });
    if (prior > 0) throw new QuoteError("This coupon is for first-time buyers only");
  }

  if (coupon.totalLimit != null) {
    const used = await prisma.couponUsage.count({ where: { couponId: coupon.id } });
    if (used >= coupon.totalLimit) throw new QuoteError("Coupon usage limit reached");
  }
  if (coupon.perUserLimit != null) {
    const mine = await prisma.couponUsage.count({ where: { couponId: coupon.id, studentId } });
    if (mine >= coupon.perUserLimit) throw new QuoteError("You have already used this coupon");
  }

  return { id: coupon.id, code: coupon.code, discount: computeDiscount(coupon, amountPaise) };
}

/** Discount in paise, capped at the order value so a total can never go negative. */
export function computeDiscount(
  coupon: { discountType: string; discountValue: unknown; maxDiscount: unknown | null },
  amountPaise: number,
): number {
  let discount: number;
  if (coupon.discountType === "PERCENT") {
    discount = Math.round((amountPaise * Number(coupon.discountValue)) / 100);
    if (coupon.maxDiscount != null) {
      discount = Math.min(discount, rupeesToPaise(Number(coupon.maxDiscount)));
    }
  } else {
    discount = rupeesToPaise(Number(coupon.discountValue));
  }
  return Math.max(0, Math.min(discount, amountPaise));
}
