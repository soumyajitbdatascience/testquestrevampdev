import { describe, expect, it } from "vitest";
import { isFullyPriced, resolvePlanPricing, type PlanRow } from "@/lib/pricing";
import { BOARD, CLASS_9, CLASS_10, fullPlans } from "@/test/factories";

/**
 * §3.2.D — pricing / access resolution.
 *
 * The expensive mistake here is failing open: resolving an unpriced offering to
 * "free" would hand paid content away. Every absence-of-price case below
 * asserts `purchasable: false`, and none of them asserts a price of 0.
 */
const scope = { boardId: BOARD.id, classId: CLASS_10.id };

function plan(over: Partial<PlanRow> = {}): PlanRow {
  return { boardId: BOARD.id, classId: CLASS_10.id, durationMonths: 3, price: 499, isActive: true, ...over };
}

describe("resolvePlanPricing — the happy path", () => {
  it("returns the right price for each term", () => {
    const r = resolvePlanPricing(fullPlans(), scope);

    expect(r.byDuration).toEqual({ 3: 499, 6: 899, 12: 1499 });
    expect(r.availableDurations).toEqual([3, 6, 12]);
    expect(r.purchasable).toBe(true);
    expect(r.complete).toBe(true);
    expect(r.minPrice).toBe(499);
  });

  it("scopes to the requested board+class and ignores other rows", () => {
    const mixed = [...fullPlans(BOARD.id, CLASS_10.id), ...fullPlans(BOARD.id, CLASS_9.id).map((p) => ({ ...p, price: 1 }))];
    const r = resolvePlanPricing(mixed, scope);

    expect(r.byDuration[3]).toBe(499);
    expect(r.minPrice).toBe(499); // not the ₹1 rows from Class 9
  });

  it("works on a pre-scoped list when no scope is given", () => {
    expect(resolvePlanPricing(fullPlans()).complete).toBe(true);
  });
});

describe("resolvePlanPricing — locked states (must never resolve to free)", () => {
  it("no plans at all → locked, not purchasable, no price", () => {
    const r = resolvePlanPricing([], scope);

    expect(r.purchasable).toBe(false);
    expect(r.complete).toBe(false);
    expect(r.minPrice).toBeNull();
    expect(r.minPrice).not.toBe(0);
    expect(r.byDuration).toEqual({ 3: null, 6: null, 12: null });
    expect(r.availableDurations).toEqual([]);
  });

  it("plans exist for another class only → this class is locked", () => {
    const r = resolvePlanPricing(fullPlans(BOARD.id, CLASS_9.id), scope);

    expect(r.purchasable).toBe(false);
    expect(r.minPrice).toBeNull();
  });

  it("an inactive plan is not sellable even though it carries a price", () => {
    const r = resolvePlanPricing([plan({ isActive: false, price: 499 })], scope);

    expect(r.byDuration[3]).toBeNull();
    expect(r.purchasable).toBe(false);
    expect(r.minPrice).toBeNull();
  });

  it("a zero price means 'not for sale', never free", () => {
    const r = resolvePlanPricing([plan({ price: 0 })], scope);

    expect(r.byDuration[3]).toBeNull();
    expect(r.purchasable).toBe(false);
    expect(r.minPrice).toBeNull();
  });

  it("a negative price is rejected rather than treated as a discount", () => {
    const r = resolvePlanPricing([plan({ price: -100 })], scope);

    expect(r.byDuration[3]).toBeNull();
    expect(r.purchasable).toBe(false);
  });

  it("a non-finite price cannot make an offering purchasable", () => {
    const r = resolvePlanPricing([plan({ price: Number.NaN })], scope);

    expect(r.byDuration[3]).toBeNull();
    expect(r.purchasable).toBe(false);
  });
});

describe("resolvePlanPricing — partial and malformed data", () => {
  it("one priced term makes it purchasable but not complete", () => {
    const r = resolvePlanPricing([plan({ durationMonths: 6, price: 899 })], scope);

    expect(r.purchasable).toBe(true);
    expect(r.complete).toBe(false);
    expect(r.availableDurations).toEqual([6]);
    expect(r.minPrice).toBe(899);
    expect(r.byDuration).toEqual({ 3: null, 6: 899, 12: null });
  });

  it("ignores a term that is not 3, 6 or 12", () => {
    const r = resolvePlanPricing([plan({ durationMonths: 9, price: 1200 }), ...fullPlans()], scope);

    expect(r.availableDurations).toEqual([3, 6, 12]);
    expect(Object.values(r.byDuration)).not.toContain(1200);
  });

  it("when a term is duplicated, the cheapest sellable row wins", () => {
    // The unique constraint should prevent this, but a student must never be
    // charged more than a price we published.
    const r = resolvePlanPricing([plan({ price: 799 }), plan({ price: 499 })], scope);

    expect(r.byDuration[3]).toBe(499);
    expect(r.minPrice).toBe(499);
  });

  it("a duplicate that is inactive does not shadow the active one", () => {
    const r = resolvePlanPricing([plan({ price: 99, isActive: false }), plan({ price: 499 })], scope);

    expect(r.byDuration[3]).toBe(499);
  });

  it("minPrice is the cheapest across terms, not the shortest term", () => {
    const r = resolvePlanPricing(
      [plan({ durationMonths: 3, price: 900 }), plan({ durationMonths: 12, price: 400 })],
      scope,
    );

    expect(r.minPrice).toBe(400);
  });
});

describe("isFullyPriced — the Launch Readiness gate", () => {
  it("is true only when all three terms are on sale", () => {
    expect(isFullyPriced(fullPlans(), scope)).toBe(true);
  });

  it("is false when any term is missing", () => {
    expect(isFullyPriced(fullPlans().filter((p) => p.durationMonths !== 6), scope)).toBe(false);
  });

  it("is false when a term exists but is deactivated", () => {
    const withInactive = fullPlans().map((p) => (p.durationMonths === 12 ? { ...p, isActive: false } : p));
    expect(isFullyPriced(withInactive, scope)).toBe(false);
  });

  it("is false for an unpriced board+class", () => {
    expect(isFullyPriced([], scope)).toBe(false);
  });
});
