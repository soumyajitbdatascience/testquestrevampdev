import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock } from "@/test/prisma-mock";
import { grantClassAccess } from "@/lib/passes";
import { addMonths } from "@/lib/money";

/**
 * Granting a pass — the exactly-once guarantee.
 *
 * Two independent callers race every purchase: the browser verifying its
 * Razorpay signature, and Razorpay's webhook. The `PENDING → PAID` flip is the
 * mutex, and it is the first write *inside* the grant transaction. These tests
 * hold that line, because the two ways to get it wrong are a double grant
 * (free content) and a paid order with no pass (a refund and an angry user).
 */

const PLAN = { id: 7, boardId: 1, classId: 5, durationMonths: 3, price: 999 };
const ORDER = {
  id: 100, studentId: 42, itemType: "B2C_PLAN" as const, planId: PLAN.id,
  status: "PENDING" as const, couponCode: null, amount: 99900, finalAmount: 99900,
};

/**
 * Simulates the atomic flip: only the first transaction to run sees a PENDING
 * order, exactly as `updateMany` with a status predicate behaves in MySQL.
 */
function stubTransaction(opts: { claimedBy?: "first" | "none" } = {}) {
  let claimed = opts.claimedBy === "none";
  prismaMock.$transaction.mockImplementation((async (fn: (tx: typeof prismaMock) => unknown) => {
    prismaMock.order.updateMany.mockImplementation((async () => {
      if (claimed) return { count: 0 };
      claimed = true;
      return { count: 1 };
    }) as never);
    return fn(prismaMock);
  }) as never);
}

beforeEach(() => {
  prismaMock.order.findUnique.mockResolvedValue(ORDER as never);
  prismaMock.b2cPlan.findUnique.mockResolvedValue(PLAN as never);
  prismaMock.classAccess.findFirst.mockResolvedValue(null);
  prismaMock.classAccess.create.mockResolvedValue({ id: 1 } as never);
  prismaMock.studentContext.upsert.mockResolvedValue({ id: 1 } as never);
  prismaMock.event.create.mockResolvedValue({ id: 1 } as never);
});

describe("the happy path", () => {
  it("grants a pass and reports itself the first caller", async () => {
    stubTransaction();

    const result = await grantClassAccess(ORDER.id, { razorpayPaymentId: "pay_x" });

    expect(result).toMatchObject({ granted: true, first: true });
    expect(prismaMock.classAccess.create).toHaveBeenCalledTimes(1);
  });

  it("flips the order to PAID as the FIRST write inside the transaction", async () => {
    // If the flip were a separate pre-commit statement, a crash between the two
    // would leave a PAID order with no access — and the webhook, seeing a
    // settled order, would never retry it.
    const calls: string[] = [];
    prismaMock.$transaction.mockImplementation((async (fn: (tx: typeof prismaMock) => unknown) => {
      prismaMock.order.updateMany.mockImplementation((async () => {
        calls.push("flip"); return { count: 1 };
      }) as never);
      prismaMock.classAccess.create.mockImplementation((async () => {
        calls.push("grant"); return { id: 1 };
      }) as never);
      return fn(prismaMock);
    }) as never);

    await grantClassAccess(ORDER.id);

    expect(calls).toEqual(["flip", "grant"]);
    // Exactly one transaction — the flip is not committed separately.
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
  });

  it("stamps the Razorpay payment reference on the order", async () => {
    stubTransaction();
    await grantClassAccess(ORDER.id, { razorpayPaymentId: "pay_abc", razorpaySignature: "sig" });

    const data = prismaMock.order.updateMany.mock.calls[0][0].data as Record<string, unknown>;
    expect(data).toMatchObject({ status: "PAID", razorpayPaymentId: "pay_abc", razorpaySignature: "sig" });
    const where = prismaMock.order.updateMany.mock.calls[0][0].where as Record<string, unknown>;
    expect(where).toMatchObject({ id: ORDER.id, status: "PENDING" });
  });

  it("creates the browsing context for what was bought", async () => {
    stubTransaction();
    await grantClassAccess(ORDER.id);
    expect(prismaMock.studentContext.upsert).toHaveBeenCalled();
  });
});

describe("concurrent verify + webhook", () => {
  it("two simultaneous callers grant exactly one pass", async () => {
    stubTransaction();

    const [a, b] = await Promise.all([
      grantClassAccess(ORDER.id, { razorpayPaymentId: "pay_verify" }),
      grantClassAccess(ORDER.id, { razorpayPaymentId: "pay_webhook" }),
    ]);

    // Exactly one wrote; both report the student is unlocked.
    expect([a.first, b.first].filter(Boolean)).toHaveLength(1);
    expect(prismaMock.classAccess.create).toHaveBeenCalledTimes(1);
    expect(a.granted || b.granted).toBe(true);
  });

  it("the loser rolls back having written nothing", async () => {
    stubTransaction({ claimedBy: "none" }); // every flip returns count 0

    const result = await grantClassAccess(ORDER.id);

    expect(result).toMatchObject({ first: false, reason: "lost_race" });
    expect(prismaMock.classAccess.create).not.toHaveBeenCalled();
    expect(prismaMock.couponUsage.create).not.toHaveBeenCalled();
    expect(prismaMock.studentContext.upsert).not.toHaveBeenCalled();
  });

  it("a second call after the pass exists reports success without re-granting", async () => {
    const expiresAt = addMonths(new Date(), 3);
    prismaMock.order.findUnique.mockResolvedValue({ ...ORDER, status: "PAID" } as never);
    prismaMock.classAccess.findFirst.mockResolvedValue({ expiresAt } as never);

    const result = await grantClassAccess(ORDER.id);

    expect(result).toMatchObject({ granted: true, first: false, reason: "already_paid" });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});

describe("nothing is granted without a settled payment", () => {
  it("a FAILED order grants nothing", async () => {
    prismaMock.order.findUnique.mockResolvedValue({ ...ORDER, status: "FAILED" } as never);

    expect(await grantClassAccess(ORDER.id)).toMatchObject({ granted: false, reason: "order_failed" });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("an unknown order grants nothing", async () => {
    prismaMock.order.findUnique.mockResolvedValue(null);
    expect(await grantClassAccess(999)).toMatchObject({ granted: false, reason: "order_not_found" });
  });

  it("an order whose plan has vanished grants nothing", async () => {
    prismaMock.b2cPlan.findUnique.mockResolvedValue(null);
    expect(await grantClassAccess(ORDER.id)).toMatchObject({ granted: false, reason: "plan_missing" });
  });
});

describe("the extension rule (Phase 4 renew shares this)", () => {
  it("a first purchase starts now", async () => {
    stubTransaction();
    const before = Date.now();

    await grantClassAccess(ORDER.id);

    const data = prismaMock.classAccess.create.mock.calls[0][0].data as { startsAt: Date; expiresAt: Date };
    expect(data.startsAt.getTime()).toBeGreaterThanOrEqual(before - 1000);
    expect(data.expiresAt.getTime()).toBe(addMonths(data.startsAt, 3).getTime());
  });

  it("buying while active extends from the current expiry, never losing days", async () => {
    const currentExpiry = addMonths(new Date(), 2);
    stubTransaction();
    prismaMock.classAccess.findFirst.mockResolvedValue({ expiresAt: currentExpiry } as never);

    await grantClassAccess(ORDER.id);

    const data = prismaMock.classAccess.create.mock.calls[0][0].data as { startsAt: Date; expiresAt: Date };
    expect(data.startsAt.getTime()).toBe(currentExpiry.getTime());
    expect(data.expiresAt.getTime()).toBe(addMonths(currentExpiry, 3).getTime());
  });

  it("an expired pass does not extend — the new one starts now", async () => {
    const expired = new Date(Date.now() - 86_400_000);
    stubTransaction();
    prismaMock.classAccess.findFirst.mockResolvedValue({ expiresAt: expired } as never);
    const before = Date.now();

    await grantClassAccess(ORDER.id);

    const data = prismaMock.classAccess.create.mock.calls[0][0].data as { startsAt: Date };
    expect(data.startsAt.getTime()).toBeGreaterThanOrEqual(before - 1000);
  });
});

describe("coupon redemption is counted inside the mutex", () => {
  const COUPON = { id: 3, code: "LAUNCH50", totalLimit: 1, perUserLimit: 1 };

  beforeEach(() => {
    prismaMock.order.findUnique.mockResolvedValue({ ...ORDER, couponCode: "LAUNCH50" } as never);
    prismaMock.coupon.findFirst.mockResolvedValue(COUPON as never);
    prismaMock.couponUsage.create.mockResolvedValue({ id: 1 } as never);
  });

  it("records the redemption once", async () => {
    stubTransaction();
    prismaMock.couponUsage.count.mockResolvedValue(0);

    await grantClassAccess(ORDER.id);

    expect(prismaMock.couponUsage.create).toHaveBeenCalledTimes(1);
  });

  it("two simultaneous redemptions of the same order grant one pass and count once", async () => {
    stubTransaction();
    prismaMock.couponUsage.count.mockResolvedValue(0);

    await Promise.all([grantClassAccess(ORDER.id), grantClassAccess(ORDER.id)]);

    expect(prismaMock.classAccess.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.couponUsage.create).toHaveBeenCalledTimes(1);
  });

  it("locks the coupon row before counting redemptions", async () => {
    // Two *different* students hold two different orders, so the order-status
    // mutex does not serialise them. Under REPEATABLE READ both transactions
    // would count against their own snapshot, read "0 used", and both redeem a
    // one-use coupon — observed happening against the real database before the
    // lock existed. A mock cannot reproduce isolation, so what this test can
    // hold is that the lock is actually taken, on the coupon, before the count.
    stubTransaction();
    prismaMock.couponUsage.count.mockResolvedValue(0);

    await grantClassAccess(ORDER.id);

    expect(prismaMock.$queryRaw).toHaveBeenCalled();
    const sql = prismaMock.$queryRaw.mock.calls[0][0] as unknown as { strings?: string[] };
    const text = Array.isArray(sql) ? sql.join("?") : (sql.strings ?? []).join("?");
    expect(text).toMatch(/tq_coupons/);
    expect(text).toMatch(/FOR UPDATE/);
  });

  it("refuses when the limit was consumed between quote and commit", async () => {
    // The check that matters runs inside the transaction, not at quote time.
    stubTransaction();
    prismaMock.couponUsage.count.mockResolvedValue(1); // limit already reached

    const result = await grantClassAccess(ORDER.id);

    expect(result).toMatchObject({ granted: false, reason: "coupon_exhausted" });
    expect(prismaMock.classAccess.create).not.toHaveBeenCalled();
  });

  it("does not double-record if a usage row already exists for this order", async () => {
    stubTransaction();
    prismaMock.couponUsage.count.mockImplementation((async (args: { where: Record<string, unknown> }) =>
      args.where.orderId != null ? 1 : 0) as never);

    await grantClassAccess(ORDER.id);

    expect(prismaMock.couponUsage.create).not.toHaveBeenCalled();
    expect(prismaMock.classAccess.create).toHaveBeenCalledTimes(1);
  });
});

vi.mock("@/lib/events", () => ({ track: vi.fn(async () => {}) }));
