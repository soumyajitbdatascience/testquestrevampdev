import { beforeEach, describe, expect, it } from "vitest";
import { prismaMock } from "@/test/prisma-mock";
import { computeDiscount, quoteOrder, QuoteError } from "@/lib/commerce";

/**
 * Quoting — the server-side price authority.
 *
 * The client sends a plan id and maybe a coupon code, never an amount. Every
 * test here is a way someone might try to pay less than the published price,
 * or to buy something that isn't for sale.
 */

const PLAN = { id: 7, boardId: 1, classId: 5, durationMonths: 3 };
const row = (durationMonths: number, price: number, isActive = true) =>
  ({ boardId: 1, classId: 5, durationMonths, price, isActive });

/** The board+class priced normally: ₹499 / ₹899 / ₹1499. */
function stubPricedScope() {
  prismaMock.b2cPlan.findFirst.mockResolvedValue(PLAN as never);
  prismaMock.b2cPlan.findMany.mockResolvedValue([
    row(3, 499), row(6, 899), row(12, 1499),
  ] as never);
}

beforeEach(stubPricedScope);

describe("price comes from the resolver, never the client", () => {
  it("quotes the published price in paise", async () => {
    const q = await quoteOrder(7, 42);

    expect(q.amount).toBe(49900);
    expect(q.finalAmount).toBe(49900);
    expect(q).toMatchObject({ planId: 7, boardId: 1, classId: 5, durationMonths: 3 });
  });

  it("ignores a plan row's own price in favour of the resolved one", async () => {
    // Data drift: two rows for the same term. The resolver takes the cheaper,
    // so a student is never charged more than a price we published.
    prismaMock.b2cPlan.findMany.mockResolvedValue([
      row(3, 499), row(3, 799), row(6, 899), row(12, 1499),
    ] as never);

    expect((await quoteOrder(7, 42)).amount).toBe(49900);
  });

  it("refuses a term that is priced but deactivated", async () => {
    prismaMock.b2cPlan.findMany.mockResolvedValue([
      row(3, 499, false), row(6, 899), row(12, 1499),
    ] as never);

    await expect(quoteOrder(7, 42)).rejects.toThrow(QuoteError);
  });

  it("refuses a zero-priced term — 'not for sale', not 'free'", async () => {
    prismaMock.b2cPlan.findMany.mockResolvedValue([row(3, 0), row(6, 899)] as never);

    await expect(quoteOrder(7, 42)).rejects.toThrow(/isn't on sale/);
  });

  it("404s an unknown or inactive plan", async () => {
    prismaMock.b2cPlan.findFirst.mockResolvedValue(null);

    await expect(quoteOrder(999, 42)).rejects.toMatchObject({ status: 404 });
  });
});

describe("coupons", () => {
  const baseCoupon = {
    id: 3, code: "LAUNCH50", discountType: "PERCENT", discountValue: 50,
    minOrder: 0, maxDiscount: null, validFrom: null, validUntil: null,
    totalLimit: null, perUserLimit: null, scope: "ALL", isActive: true,
  };

  beforeEach(() => {
    prismaMock.coupon.findFirst.mockResolvedValue(baseCoupon as never);
    prismaMock.couponUsage.count.mockResolvedValue(0);
    prismaMock.order.count.mockResolvedValue(0);
  });

  it("applies a percentage discount in paise", async () => {
    const q = await quoteOrder(7, 42, "LAUNCH50");

    expect(q.discount).toBe(24950);
    expect(q.finalAmount).toBe(24950);
    expect(q.couponCode).toBe("LAUNCH50");
  });

  it("accepts a lower-case code", async () => {
    await quoteOrder(7, 42, "launch50");
    expect(prismaMock.coupon.findFirst.mock.calls[0][0]?.where).toMatchObject({ code: "LAUNCH50" });
  });

  it("honours a maximum-discount cap", async () => {
    prismaMock.coupon.findFirst.mockResolvedValue({ ...baseCoupon, maxDiscount: 100 } as never);

    expect((await quoteOrder(7, 42, "LAUNCH50")).discount).toBe(10000);
  });

  it("a 100% coupon quotes to zero, which is a legitimate order", async () => {
    prismaMock.coupon.findFirst.mockResolvedValue({ ...baseCoupon, discountValue: 100 } as never);

    const q = await quoteOrder(7, 42, "LAUNCH50");
    expect(q.finalAmount).toBe(0);
    expect(q.discount).toBe(49900);
  });

  it("rejects an expired coupon", async () => {
    prismaMock.coupon.findFirst.mockResolvedValue(
      { ...baseCoupon, validUntil: new Date(Date.now() - 86_400_000) } as never,
    );

    await expect(quoteOrder(7, 42, "LAUNCH50")).rejects.toThrow(/expired/);
  });

  it("rejects an unknown code rather than silently charging full price", async () => {
    prismaMock.coupon.findFirst.mockResolvedValue(null);

    await expect(quoteOrder(7, 42, "NOPE")).rejects.toThrow(/Invalid coupon/);
  });

  it("enforces the minimum order value in the same unit", async () => {
    prismaMock.coupon.findFirst.mockResolvedValue({ ...baseCoupon, minOrder: 1000 } as never);

    await expect(quoteOrder(7, 42, "LAUNCH50")).rejects.toThrow(/Minimum order value/);
  });

  it("enforces the per-user limit", async () => {
    prismaMock.coupon.findFirst.mockResolvedValue({ ...baseCoupon, perUserLimit: 1 } as never);
    prismaMock.couponUsage.count.mockResolvedValue(1);

    await expect(quoteOrder(7, 42, "LAUNCH50")).rejects.toThrow(/already used/);
  });

  it("enforces FIRST_TIME scope against paid history", async () => {
    prismaMock.coupon.findFirst.mockResolvedValue({ ...baseCoupon, scope: "FIRST_TIME" } as never);
    prismaMock.order.count.mockResolvedValue(2);

    await expect(quoteOrder(7, 42, "LAUNCH50")).rejects.toThrow(/first-time/);
  });

  it("an empty code is not a coupon attempt", async () => {
    const q = await quoteOrder(7, 42, "   ");
    expect(q.couponCode).toBeNull();
    expect(q.discount).toBe(0);
  });
});

describe("computeDiscount", () => {
  it("never exceeds the order value, so a total can't go negative", () => {
    expect(computeDiscount({ discountType: "FLAT", discountValue: 9999, maxDiscount: null }, 49900))
      .toBe(49900);
  });

  it("never returns a negative discount", () => {
    expect(computeDiscount({ discountType: "FLAT", discountValue: -50, maxDiscount: null }, 49900))
      .toBe(0);
  });

  it("converts a flat rupee discount into paise once", () => {
    expect(computeDiscount({ discountType: "FLAT", discountValue: 100, maxDiscount: null }, 49900))
      .toBe(10000);
  });
});
