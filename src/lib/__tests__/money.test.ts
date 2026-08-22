import { describe, expect, it } from "vitest";
import { addMonths, formatPaise, paiseToRupees, rupeesToPaise } from "@/lib/money";

/**
 * Units and dates — the two places a quiet arithmetic slip becomes a refund.
 *
 * Plans store rupees, orders store paise, and the ×100 happens exactly once.
 * These tests pin that boundary so a second multiplication anywhere shows up
 * here as a 100× failure rather than on someone's card statement.
 */
describe("rupees → paise", () => {
  it("pins ₹1000 → 100000 paise", () => {
    expect(rupeesToPaise(1000)).toBe(100000);
  });

  it("converts the real plan prices", () => {
    expect(rupeesToPaise(499)).toBe(49900);
    expect(rupeesToPaise(899)).toBe(89900);
    expect(rupeesToPaise(1499)).toBe(149900);
  });

  it("rounds rather than truncates, so a percentage discount can't lose a paisa", () => {
    // 33% off ₹499 is 164.67 rupees — 16467 paise, not 16466.
    expect(rupeesToPaise(164.67)).toBe(16467);
    expect(rupeesToPaise(0.005)).toBe(1);
  });

  it("never returns a negative or non-finite amount", () => {
    expect(rupeesToPaise(-100)).toBe(0);
    expect(rupeesToPaise(Number.NaN)).toBe(0);
    expect(rupeesToPaise(Number.POSITIVE_INFINITY)).toBe(0);
  });

  it("round-trips back to rupees", () => {
    expect(paiseToRupees(rupeesToPaise(1000))).toBe(1000);
    expect(paiseToRupees(100000)).toBe(1000);
  });

  it("converting twice is visibly wrong — the bug this file exists to catch", () => {
    expect(rupeesToPaise(rupeesToPaise(1000))).toBe(10000000);
  });

  it("formats paise for humans", () => {
    expect(formatPaise(100000)).toBe("₹1,000");
    expect(formatPaise(49900)).toBe("₹499");
  });
});

describe("addMonths", () => {
  it("adds whole months", () => {
    expect(addMonths(new Date("2026-08-16T10:00:00Z"), 3).toISOString().slice(0, 10)).toBe("2026-11-16");
    expect(addMonths(new Date("2026-08-16T10:00:00Z"), 12).toISOString().slice(0, 10)).toBe("2027-08-16");
  });

  it("clamps at a short month instead of rolling into the next one", () => {
    // Plain setMonth turns 30 Nov + 3 into 2 March. A pass must end in February.
    expect(addMonths(new Date("2026-11-30T00:00:00Z"), 3).toISOString().slice(0, 10)).toBe("2027-02-28");
    expect(addMonths(new Date("2026-01-31T00:00:00Z"), 1).toISOString().slice(0, 10)).toBe("2026-02-28");
  });

  it("handles a leap February", () => {
    expect(addMonths(new Date("2028-01-31T00:00:00Z"), 1).toISOString().slice(0, 10)).toBe("2028-02-29");
  });

  it("keeps the time of day, so an expiry doesn't drift", () => {
    const from = new Date("2026-08-16T18:30:00Z");
    expect(addMonths(from, 6).toISOString().slice(11, 19)).toBe("18:30:00");
  });

  it("does not mutate its input", () => {
    const from = new Date("2026-08-16T00:00:00Z");
    addMonths(from, 6);
    expect(from.toISOString().slice(0, 10)).toBe("2026-08-16");
  });
});
