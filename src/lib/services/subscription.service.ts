/**
 * Subscription service — trial expiry, billing-state transitions, plan helpers.
 *
 * Phase 1 / Task 1.11.
 *
 * State machine (driven by Subscription.expiresAt):
 *
 *   TRIAL (created on signup, 14 days)
 *     └─ expiresAt <= now       → GRACE   (7-day grace window after trial ends)
 *     └─ expiresAt <= now - 7d  → EXPIRED (full owner lockout)
 *
 *   ACTIVE
 *     └─ expiresAt <= now       → GRACE
 *     └─ expiresAt <= now - 7d  → EXPIRED
 *
 * `resolveSubscriptionState` is "lazy": call it on any owner page request and
 * it updates the row in place if the wall clock has moved past a threshold.
 * No cron required for Phase 1.
 *
 * Banner copy intent (consumed by the dashboard / billing page):
 *   - TRIAL, daysLeft > 2       → none
 *   - TRIAL, daysLeft <= 2      → "Your trial ends in N days — upgrade now"
 *   - GRACE                     → "Trial ended. New assignments paused."
 *   - EXPIRED                   → "Subscription expired. Contact support."
 */
import { prisma } from "@/lib/db";
import { SubscriptionStatus } from "@/generated/prisma/client";

export const GRACE_DAYS = 7;

export interface BillingState {
  subscriptionId: number | null;
  status: SubscriptionStatus | null;
  planName: string | null;
  seatsPurchased: number;
  seatsUsed: number;
  expiresAt: Date | null;
  /** Positive = days remaining; negative = days since expiry. Null if no sub. */
  daysLeft: number | null;
  /** Owner banner classification. */
  banner: "none" | "trial_ending" | "grace" | "expired";
  /** Are owners allowed to create new assignments? */
  canAssign: boolean;
  /** Are owners locked out of all create/modify? */
  hardLockout: boolean;
}

/**
 * Read the current subscription, transition state in place if needed, and
 * return a snapshot suitable for the UI.
 */
export async function resolveSubscriptionState(orgId: number): Promise<BillingState> {
  const sub = await prisma.subscription.findFirst({
    where: { orgId },
    orderBy: { createdAt: "desc" },
    include: { plan: { select: { name: true } } },
  });

  if (!sub) {
    return {
      subscriptionId: null,
      status: null,
      planName: null,
      seatsPurchased: 0,
      seatsUsed: 0,
      expiresAt: null,
      daysLeft: null,
      banner: "none",
      canAssign: true,
      hardLockout: false,
    };
  }

  const now = Date.now();
  const expiresAtMs = +sub.expiresAt;
  const daysLeft = Math.ceil((expiresAtMs - now) / 86_400_000);

  // Compute desired status given the current clock.
  let target = sub.status;
  if (sub.status === SubscriptionStatus.TRIAL || sub.status === SubscriptionStatus.ACTIVE) {
    if (expiresAtMs <= now - GRACE_DAYS * 86_400_000) {
      target = SubscriptionStatus.EXPIRED;
    } else if (expiresAtMs <= now) {
      target = SubscriptionStatus.GRACE;
    }
  } else if (sub.status === SubscriptionStatus.GRACE) {
    if (expiresAtMs <= now - GRACE_DAYS * 86_400_000) {
      target = SubscriptionStatus.EXPIRED;
    }
  }

  if (target !== sub.status) {
    await prisma.subscription.update({ where: { id: sub.id }, data: { status: target } });
  }

  // Classify banner.
  let banner: BillingState["banner"] = "none";
  let canAssign = true;
  let hardLockout = false;
  if (target === SubscriptionStatus.TRIAL && daysLeft <= 2) banner = "trial_ending";
  if (target === SubscriptionStatus.GRACE) { banner = "grace"; canAssign = false; }
  if (target === SubscriptionStatus.EXPIRED) { banner = "expired"; canAssign = false; hardLockout = true; }
  if (target === SubscriptionStatus.CANCELLED) { banner = "expired"; canAssign = false; hardLockout = true; }

  return {
    subscriptionId: sub.id,
    status: target,
    planName: sub.plan?.name ?? null,
    seatsPurchased: sub.seatsPurchased,
    seatsUsed: sub.seatsUsed,
    expiresAt: sub.expiresAt,
    daysLeft,
    banner,
    canAssign,
    hardLockout,
  };
}

/**
 * Quote a price for converting / renewing a subscription. Returns the amount
 * in INR to charge via Razorpay + the period the payment covers.
 *
 * For Phase 1 we keep the math simple: planBasePrice × seats × monthsForCycle.
 * Pricing tiers like discounts come later.
 */
export interface PriceQuote {
  amount: number;
  months: number;
  seats: number;
  planName: string;
}

export async function quoteUpgrade(orgId: number, planId: number): Promise<PriceQuote | null> {
  const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
  if (!plan || !plan.isActive) return null;
  const sub = await prisma.subscription.findFirst({
    where: { orgId },
    orderBy: { createdAt: "desc" },
  });
  const seats = Math.max(1, sub?.seatsPurchased ?? 50);
  const months = Math.max(1, Math.round(plan.durationDays / 30));
  // Plans are stored as ₹/seat/month for PER_SEAT, or flat ₹ for FLAT.
  const perMonth = plan.pricingModel === "PER_SEAT"
    ? Number(plan.basePrice) * seats
    : Number(plan.basePrice);
  return {
    amount: Math.round(perMonth * months),
    months,
    seats,
    planName: plan.name,
  };
}

/** Days each recurring cycle covers when extending expiresAt. */
const CYCLE_EXTENSION_DAYS: Record<string, number> = {
  MONTHLY: 30,
  QUARTERLY: 90,
  ANNUAL: 365,
};

/**
 * Mark a subscription ACTIVE on successful payment and extend `expiresAt`.
 *
 * Extension length:
 *   - `extendByDays` if explicitly provided (recurring webhook passes the
 *     cycle's days so a monthly charge extends ~30d, not the plan's 365);
 *   - else the plan's `durationDays` (one-time checkout / verify path).
 *
 * Idempotent extension is the CALLER's responsibility (webhook dedupes by
 * event id before calling). This function always extends, so don't call it
 * twice for the same charge.
 */
export async function activateSubscription(input: {
  subscriptionId: number;
  planId: number;
  extendByDays?: number;
}): Promise<void> {
  const sub = await prisma.subscription.findUnique({ where: { id: input.subscriptionId } });
  if (!sub) return;
  const plan = await prisma.subscriptionPlan.findUnique({ where: { id: input.planId } });
  if (!plan) return;

  const days = input.extendByDays ?? plan.durationDays;

  // Extend from the later of: current expiry (so a paid renewal during trial
  // doesn't lose the remaining trial days) or now.
  const baseMs = Math.max(+sub.expiresAt, Date.now());
  const newExpiresAt = new Date(baseMs + days * 86_400_000);

  await prisma.subscription.update({
    where: { id: sub.id },
    data: {
      planId: input.planId,
      status: SubscriptionStatus.ACTIVE,
      expiresAt: newExpiresAt,
    },
  });
}

/** Map a BillingCycle value to the number of days it extends coverage by. */
export function cycleToDays(cycle: string | null | undefined): number {
  return CYCLE_EXTENSION_DAYS[cycle ?? "ANNUAL"] ?? 365;
}

/**
 * A recurring auto-charge failed (Razorpay `subscription.pending`). Move an
 * ACTIVE sub into GRACE so the owner sees the dunning banner; 4.7 owns the
 * retry schedule + notifications. No-op if already GRACE/EXPIRED/CANCELLED.
 */
export async function markChargeFailed(subscriptionId: number): Promise<void> {
  const sub = await prisma.subscription.findUnique({ where: { id: subscriptionId } });
  if (!sub) return;
  if (sub.status === SubscriptionStatus.ACTIVE || sub.status === SubscriptionStatus.TRIAL) {
    await prisma.subscription.update({
      where: { id: sub.id },
      data: { status: SubscriptionStatus.GRACE },
    });
  }
}

/**
 * Force a subscription into a terminal/explicit status (used by the webhook for
 * `subscription.halted` → EXPIRED and `subscription.cancelled` → CANCELLED).
 */
export async function setSubscriptionStatus(
  subscriptionId: number,
  status: SubscriptionStatus,
): Promise<void> {
  await prisma.subscription.update({
    where: { id: subscriptionId },
    data: { status },
  });
}
