import { describe, expect, it } from "vitest";
import { prismaMock } from "@/test/prisma-mock";
import { hasClassAccess, resolveAccessForTests, resolveTestAccess } from "@/lib/access";

/**
 * Access resolution — the gate between a student and paid content.
 *
 * Every test here asks the same question from a different angle: *can this
 * resolve to "open" when it shouldn't?* A false negative annoys someone; a
 * false positive gives the catalogue away. So the assertions are deliberately
 * paranoid about the closed direction, and the last group guards the cutover
 * itself — no legacy table may ever be consulted again.
 */

/** No samples, no passes, no tests — the emptiest possible world. */
function stubEmpty() {
  prismaMock.freeTest.findMany.mockResolvedValue([] as never);
  prismaMock.classAccess.findMany.mockResolvedValue([] as never);
  prismaMock.test.findMany.mockResolvedValue([] as never);
}

const sample = (testId: number) => ({ testId });
const pass = (boardId: number, classId: number) => ({ boardId, classId });
const testInScope = (id: number, boardId: number, classId: number) =>
  ({ id, offering: { boardId, classId } });

describe("resolveAccessForTests — the open cases", () => {
  it("a free sample is open to a signed-out visitor", async () => {
    stubEmpty();
    prismaMock.freeTest.findMany.mockResolvedValue([sample(10)] as never);

    const map = await resolveAccessForTests(null, [10]);

    expect(map.get(10)).toEqual({ access: true, reason: "FREE_SAMPLE" });
  });

  it("a live pass on the test's board+class opens it", async () => {
    stubEmpty();
    prismaMock.classAccess.findMany.mockResolvedValue([pass(1, 5)] as never);
    prismaMock.test.findMany.mockResolvedValue([testInScope(77, 1, 5)] as never);

    const map = await resolveAccessForTests(42, [77]);

    expect(map.get(77)).toEqual({ access: true, reason: "CLASS_PASS" });
  });

  it("one pass covers every subject in that board+class", async () => {
    // The locked decision: we sell the class, never a single test.
    stubEmpty();
    prismaMock.classAccess.findMany.mockResolvedValue([pass(1, 5)] as never);
    prismaMock.test.findMany.mockResolvedValue([
      testInScope(1, 1, 5), testInScope(2, 1, 5), testInScope(3, 1, 5),
    ] as never);

    const map = await resolveAccessForTests(42, [1, 2, 3]);

    expect([...map.values()].every((v) => v.access)).toBe(true);
  });
});

describe("resolveAccessForTests — fails closed", () => {
  it("no pass, no sample → locked", async () => {
    stubEmpty();

    expect(await resolveTestAccess(42, 77)).toEqual({ access: false, reason: "NONE" });
  });

  it("a signed-out visitor gets nothing beyond the sample", async () => {
    stubEmpty();
    prismaMock.freeTest.findMany.mockResolvedValue([sample(10)] as never);

    const map = await resolveAccessForTests(null, [10, 11]);

    expect(map.get(10)?.access).toBe(true);
    expect(map.get(11)).toEqual({ access: false, reason: "NONE" });
  });

  it("a pass for a different class does not open this one", async () => {
    stubEmpty();
    prismaMock.classAccess.findMany.mockResolvedValue([pass(1, 9)] as never);
    prismaMock.test.findMany.mockResolvedValue([testInScope(77, 1, 5)] as never);

    expect(await resolveTestAccess(42, 77)).toEqual({ access: false, reason: "NONE" });
  });

  it("a pass on the same class but a different board does not open it", async () => {
    // CBSE Class 9 and ICSE Class 9 are different shelves sold separately.
    stubEmpty();
    prismaMock.classAccess.findMany.mockResolvedValue([pass(2, 5)] as never);
    prismaMock.test.findMany.mockResolvedValue([testInScope(77, 1, 5)] as never);

    expect(await resolveTestAccess(42, 77)).toEqual({ access: false, reason: "NONE" });
  });

  it("an unknown or inactive test id resolves to locked, not to missing", async () => {
    // A caller reading a missing key as "no opinion" would default it open.
    stubEmpty();
    prismaMock.classAccess.findMany.mockResolvedValue([pass(1, 5)] as never);
    prismaMock.test.findMany.mockResolvedValue([] as never);

    const map = await resolveAccessForTests(42, [999]);

    expect(map.has(999)).toBe(true);
    expect(map.get(999)).toEqual({ access: false, reason: "NONE" });
  });

  it("every requested id gets an entry", async () => {
    stubEmpty();
    prismaMock.freeTest.findMany.mockResolvedValue([sample(2)] as never);

    const map = await resolveAccessForTests(42, [1, 2, 3, 4]);

    expect([...map.keys()].sort()).toEqual([1, 2, 3, 4]);
  });

  it("only counts passes inside their validity window", async () => {
    // The mock cannot enforce a WHERE clause, so assert the query itself
    // carries the window — that filter is the whole expiry policy.
    stubEmpty();
    await resolveAccessForTests(42, [77]);

    const where = prismaMock.classAccess.findMany.mock.calls[0][0]?.where as Record<string, unknown>;
    expect(where.studentId).toBe(42);
    expect(where.startsAt).toEqual({ lte: expect.any(Date) });
    expect(where.expiresAt).toEqual({ gt: expect.any(Date) });
  });

  it("does not consult tq_tests.isFree — the migration set it on every row", async () => {
    // All 270 migrated tests carry isFree = true. Honouring it would unlock
    // the catalogue, so "free" may only ever mean the offering's sample.
    stubEmpty();
    prismaMock.classAccess.findMany.mockResolvedValue([pass(1, 5)] as never);
    prismaMock.test.findMany.mockResolvedValue([testInScope(77, 9, 9)] as never);

    expect((await resolveTestAccess(42, 77)).access).toBe(false);

    const select = prismaMock.test.findMany.mock.calls[0][0]?.select as Record<string, unknown>;
    expect(select.isFree).toBeUndefined();
  });

  it("resolves nothing for an empty request rather than inventing entries", async () => {
    expect((await resolveAccessForTests(42, [])).size).toBe(0);
    expect(prismaMock.freeTest.findMany).not.toHaveBeenCalled();
  });
});

describe("hasClassAccess", () => {
  it("true only when a live pass covers that board+class", async () => {
    prismaMock.classAccess.findFirst.mockResolvedValue({ id: 1 } as never);
    expect(await hasClassAccess(42, 1, 5)).toBe(true);
  });

  it("false when no row matches", async () => {
    prismaMock.classAccess.findFirst.mockResolvedValue(null);
    expect(await hasClassAccess(42, 1, 5)).toBe(false);
  });

  it("false for a signed-out visitor, without touching the database", async () => {
    expect(await hasClassAccess(null, 1, 5)).toBe(false);
    expect(prismaMock.classAccess.findFirst).not.toHaveBeenCalled();
  });

  it("scopes the lookup to the student and the validity window", async () => {
    prismaMock.classAccess.findFirst.mockResolvedValue(null);
    await hasClassAccess(42, 1, 5);

    const where = prismaMock.classAccess.findFirst.mock.calls[0][0]?.where as Record<string, unknown>;
    expect(where).toMatchObject({ studentId: 42, boardId: 1, classId: 5 });
    expect(where.startsAt).toEqual({ lte: expect.any(Date) });
    expect(where.expiresAt).toEqual({ gt: expect.any(Date) });
  });
});

describe("no legacy table is reachable from access resolution", () => {
  // The cutover guard: these models have no table in this database, so a
  // single call would 500 the paywall, the test player and the home page.
  it("resolves without querying studentAccess, batchEnrollment or assignment", async () => {
    stubEmpty();
    prismaMock.classAccess.findMany.mockResolvedValue([pass(1, 5)] as never);
    prismaMock.test.findMany.mockResolvedValue([testInScope(77, 1, 5)] as never);

    await resolveAccessForTests(42, [77]);
    await hasClassAccess(42, 1, 5);

    expect(prismaMock.studentAccess.findMany).not.toHaveBeenCalled();
    expect(prismaMock.batchEnrollment.findMany).not.toHaveBeenCalled();
    expect(prismaMock.assignment.findMany).not.toHaveBeenCalled();
  });
});
