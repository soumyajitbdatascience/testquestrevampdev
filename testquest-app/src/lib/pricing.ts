/**
 * Pricing / access resolution for prepaid Board+Class passes.
 *
 * A class pass is sold in three terms — 3, 6 and 12 months — priced per
 * board+class in `tq_b2c_plans`. This module is the single answer to "what does
 * this cost, and can it be bought at all?", so the paywall, the admin pricing
 * grid and Launch Readiness cannot drift apart.
 *
 * The safety rule that matters: **absence of pricing means locked, never free.**
 * An offering with no active plan is not purchasable. Treating "no price" as
 * "free" would give away paid content, so every path here fails closed.
 */

export const PLAN_DURATIONS = [3, 6, 12] as const;
export type PlanDuration = (typeof PLAN_DURATIONS)[number];

export interface PlanRow {
  boardId: number;
  classId: number;
  durationMonths: number;
  price: number;
  isActive: boolean;
}

export interface PricingResolution {
  /** Price per term; null where that term is unpriced, inactive or non-positive. */
  byDuration: Record<PlanDuration, number | null>;
  /** True only when at least one term is genuinely buyable. */
  purchasable: boolean;
  /** Cheapest buyable term, for "from ₹X" copy. Null when locked. */
  minPrice: number | null;
  /** All three terms priced and active — the gate Launch Readiness checks. */
  complete: boolean;
  /** Terms actually on sale, ascending. */
  availableDurations: PlanDuration[];
}

function isDuration(n: number): n is PlanDuration {
  return (PLAN_DURATIONS as readonly number[]).includes(n);
}

/**
 * A plan only counts when it is active AND carries a positive price. The admin
 * grid deactivates a term rather than deleting it when its price is cleared, so
 * an inactive row with a stale price must never resurface as sellable — and a
 * zero price is "not for sale", not "free".
 */
function isSellable(p: PlanRow): boolean {
  return p.isActive === true && Number.isFinite(p.price) && p.price > 0;
}

/**
 * Resolves pricing for one board+class from a set of plan rows.
 *
 * `scope` filters the rows when the caller passes an unfiltered set; omit it
 * when the rows are already scoped. When several rows exist for the same term
 * (which the unique constraint should prevent, but data drifts), the cheapest
 * sellable one wins — a student is never charged more than a price we published.
 */
export function resolvePlanPricing(
  plans: PlanRow[],
  scope?: { boardId: number; classId: number },
): PricingResolution {
  const scoped = scope
    ? plans.filter((p) => p.boardId === scope.boardId && p.classId === scope.classId)
    : plans;

  const byDuration = { 3: null, 6: null, 12: null } as Record<PlanDuration, number | null>;

  for (const p of scoped) {
    if (!isDuration(p.durationMonths) || !isSellable(p)) continue;
    const current = byDuration[p.durationMonths];
    byDuration[p.durationMonths] = current == null ? p.price : Math.min(current, p.price);
  }

  const availableDurations = PLAN_DURATIONS.filter((d) => byDuration[d] != null);
  const prices = availableDurations.map((d) => byDuration[d] as number);

  return {
    byDuration,
    purchasable: availableDurations.length > 0,
    minPrice: prices.length > 0 ? Math.min(...prices) : null,
    complete: availableDurations.length === PLAN_DURATIONS.length,
    availableDurations: [...availableDurations],
  };
}

/**
 * Whether a board+class is fully priced — all three terms on sale. This is the
 * "plan priced & active" gate on Launch Readiness.
 */
export function isFullyPriced(plans: PlanRow[], scope?: { boardId: number; classId: number }): boolean {
  return resolvePlanPricing(plans, scope).complete;
}
