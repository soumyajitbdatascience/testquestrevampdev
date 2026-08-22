/**
 * Razorpay Subscriptions service — recurring mandates (Task 4.1).
 *
 * Separate from the one-time checkout (`/coaching/billing/checkout`). This
 * module owns the Razorpay-side objects:
 *
 *   - Plans:        one Razorpay Plan per (our planId × billingCycle), created
 *                   lazily and cached in SubscriptionPlan.featuresJson.
 *   - Customers:    one Razorpay customer per org, cached on the Subscription
 *                   row (razorpayCustomerId).
 *   - Subscriptions (mandates): the recurring authorization; id cached on the
 *                   Subscription row (razorpaySubscriptionId).
 *
 * The webhook (`/api/razorpay/webhook`) is the authoritative source for charge
 * outcomes; this service only creates / cancels the Razorpay objects and
 * persists their ids.
 */
import { prisma } from "@/lib/db";
import { getRazorpay } from "@/lib/razorpay";
import { Prisma, BillingCycle } from "@/generated/prisma/client";

export class RazorpaySubscriptionError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

/** Razorpay plan period/interval for each of our billing cycles. */
const CYCLE_PERIOD: Record<BillingCycle, { period: "monthly" | "yearly"; interval: number }> = {
  MONTHLY: { period: "monthly", interval: 1 },
  QUARTERLY: { period: "monthly", interval: 3 },
  ANNUAL: { period: "yearly", interval: 1 },
};

/** Approx days each cycle covers — used to extend expiresAt on each charge. */
export const CYCLE_DAYS: Record<BillingCycle, number> = {
  MONTHLY: 30,
  QUARTERLY: 90,
  ANNUAL: 365,
};

/** Total billing count we hand Razorpay (effectively "until cancelled"). */
const TOTAL_BILLING_CYCLES = 120; // 10 years of monthly; Razorpay requires a finite count.

interface PlanFeatures {
  razorpayPlanIds?: Partial<Record<BillingCycle, string>>;
  [k: string]: unknown;
}

/**
 * Per-cycle price in INR for a plan. Mirrors quoteUpgrade's math but scoped to
 * a single cycle's amount (what Razorpay charges each period).
 */
function cycleAmountInr(
  plan: { pricingModel: string; basePrice: Prisma.Decimal },
  seats: number,
  cycle: BillingCycle,
): number {
  // basePrice is stored as ₹/seat/month (PER_SEAT) or flat ₹/month (FLAT).
  const monthly = plan.pricingModel === "PER_SEAT"
    ? Number(plan.basePrice) * seats
    : Number(plan.basePrice);
  const months = cycle === "MONTHLY" ? 1 : cycle === "QUARTERLY" ? 3 : 12;
  return Math.round(monthly * months);
}

/**
 * Return a Razorpay plan_id for (planId × cycle), creating + caching it in
 * SubscriptionPlan.featuresJson on first use.
 */
export async function ensureRazorpayPlan(
  planId: number,
  cycle: BillingCycle,
  seats: number,
): Promise<string> {
  const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
  if (!plan || !plan.isActive) {
    throw new RazorpaySubscriptionError("Plan not found", 404);
  }

  const features = (plan.featuresJson ?? {}) as PlanFeatures;
  const cached = features.razorpayPlanIds?.[cycle];
  if (cached) return cached;

  const amount = cycleAmountInr(plan, seats, cycle);
  if (amount <= 0) {
    throw new RazorpaySubscriptionError("Selected plan has no billable amount", 400);
  }

  const { period, interval } = CYCLE_PERIOD[cycle];
  const razorpay = getRazorpay();
  const rzpPlan = await razorpay.plans.create({
    period,
    interval,
    item: {
      name: `${plan.name} (${cycle.toLowerCase()})`,
      amount: amount * 100, // paise
      currency: "INR",
      description: `Testquest ${plan.name} — ${cycle.toLowerCase()} billing`,
    },
    notes: { planId: String(planId), cycle },
  });

  const merged: PlanFeatures = {
    ...features,
    razorpayPlanIds: { ...(features.razorpayPlanIds ?? {}), [cycle]: rzpPlan.id },
  };
  await prisma.subscriptionPlan.update({
    where: { id: planId },
    data: { featuresJson: merged as unknown as Prisma.InputJsonValue },
  });

  return rzpPlan.id;
}

export interface CreateMandateInput {
  orgId: number;
  planId: number;
  cycle: BillingCycle;
  /** Owner's contact for the Razorpay customer record. */
  ownerEmail?: string | null;
  ownerName?: string | null;
  ownerMobile?: string | null;
}

export interface CreateMandateResult {
  razorpaySubscriptionId: string;
  shortUrl: string | null;
  razorpayKeyId: string;
  subscriptionId: number;
}

/**
 * Create a recurring mandate for an org's subscription. Idempotency-ish: if the
 * org already has an active Razorpay subscription id, we refuse (caller should
 * cancel first). Returns the data the client needs to open Razorpay Checkout.
 */
export async function createSubscriptionMandate(
  input: CreateMandateInput,
): Promise<CreateMandateResult> {
  const sub = await prisma.subscription.findFirst({
    where: { orgId: input.orgId },
    orderBy: { createdAt: "desc" },
  });
  if (!sub) throw new RazorpaySubscriptionError("No subscription on file", 400);

  if (sub.razorpaySubscriptionId) {
    const meta = (sub.razorpayMeta ?? {}) as { status?: string };
    const status = meta.status ?? "";
    if (status && !["cancelled", "completed", "expired"].includes(status)) {
      throw new RazorpaySubscriptionError(
        "An active auto-renew mandate already exists. Cancel it before creating a new one.",
        409,
      );
    }
  }

  const seats = Math.max(1, sub.seatsPurchased);
  const razorpay = getRazorpay();

  // Ensure customer (cache on the sub row).
  let customerId = sub.razorpayCustomerId;
  if (!customerId) {
    const customer = await razorpay.customers.create({
      name: input.ownerName ?? `Org ${input.orgId}`,
      email: input.ownerEmail ?? undefined,
      contact: input.ownerMobile ?? undefined,
      fail_existing: 0, // reuse if a customer with this email already exists
      notes: { orgId: String(input.orgId) },
    });
    customerId = customer.id;
  }

  const rzpPlanId = await ensureRazorpayPlan(input.planId, input.cycle, seats);

  const rzpSub = await razorpay.subscriptions.create({
    plan_id: rzpPlanId,
    customer_notify: 1,
    total_count: TOTAL_BILLING_CYCLES,
    quantity: 1,
    notes: {
      orgId: String(input.orgId),
      subscriptionId: String(sub.id),
      planId: String(input.planId),
      cycle: input.cycle,
      seats: String(seats),
    },
  });

  await prisma.subscription.update({
    where: { id: sub.id },
    data: {
      planId: input.planId,
      billingCycle: input.cycle,
      autoRenew: true,
      razorpayCustomerId: customerId,
      razorpaySubscriptionId: rzpSub.id,
      razorpayMeta: rzpSub as unknown as Prisma.InputJsonValue,
    },
  });

  return {
    razorpaySubscriptionId: rzpSub.id,
    shortUrl: (rzpSub as { short_url?: string }).short_url ?? null,
    razorpayKeyId: process.env.RAZORPAY_KEY_ID!,
    subscriptionId: sub.id,
  };
}

/**
 * Cancel an org's recurring mandate. `atCycleEnd=true` lets the current paid
 * period run out; otherwise cancels immediately. We do NOT flip our local
 * status here — the `subscription.cancelled` webhook does that (single source).
 */
export async function cancelMandate(
  orgId: number,
  opts: { atCycleEnd?: boolean } = {},
): Promise<{ cancelled: true }> {
  const sub = await prisma.subscription.findFirst({
    where: { orgId },
    orderBy: { createdAt: "desc" },
  });
  if (!sub?.razorpaySubscriptionId) {
    throw new RazorpaySubscriptionError("No active auto-renew mandate to cancel", 404);
  }
  const razorpay = getRazorpay();
  await razorpay.subscriptions.cancel(
    sub.razorpaySubscriptionId,
    opts.atCycleEnd ?? false,
  );
  return { cancelled: true };
}

/** Webhook helper: find our subscription row by the Razorpay subscription id. */
export async function findSubByRazorpayId(rzpSubId: string) {
  return prisma.subscription.findFirst({
    where: { razorpaySubscriptionId: rzpSubId },
  });
}
