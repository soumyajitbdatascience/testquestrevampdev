import { beforeEach, describe, expect, it } from "vitest";
import { prismaMock } from "@/test/prisma-mock";
import { hasClassAccess } from "@/lib/access";

/**
 * Video gating.
 *
 * Videos are unlisted YouTube uploads, so the id **is** the access control:
 * anyone holding it can watch, forever, without ever touching this app. That
 * makes `videoRef` the single most leakable thing in the payload — and the
 * reason a locked response carries no thumbnail either, since a YouTube
 * thumbnail URL simply contains the id.
 *
 * The route delegates to `hasClassAccess` rather than querying passes itself.
 * It used to run its own check that tested `expiresAt > now` but not
 * `startsAt <= now`, so a renewal bought early — whose window opens when the
 * current pass ends — would have unlocked videos immediately.
 */
const OFFERING = { boardId: 1, classId: 5 };

function pass(startsAt: Date, expiresAt: Date) {
  // The mock cannot evaluate a WHERE clause, so model the real predicate:
  // a row comes back only when it is inside its validity window.
  prismaMock.classAccess.findFirst.mockImplementation((async (args: {
    where: { startsAt?: { lte: Date }; expiresAt?: { gt: Date } };
  }) => {
    const nowLte = args.where.startsAt?.lte;
    const nowGt = args.where.expiresAt?.gt;
    if (!nowLte || !nowGt) return null;
    return startsAt <= nowLte && expiresAt > nowGt ? { id: 1 } : null;
  }) as never);
}

const days = (n: number) => new Date(Date.now() + n * 86_400_000);

beforeEach(() => {
  prismaMock.classAccess.findFirst.mockResolvedValue(null);
});

describe("who may receive a video id", () => {
  it("a live pass covers it", async () => {
    pass(days(-10), days(20));
    expect(await hasClassAccess(42, OFFERING.boardId, OFFERING.classId)).toBe(true);
  });

  it("a signed-out visitor never does", async () => {
    expect(await hasClassAccess(null, OFFERING.boardId, OFFERING.classId)).toBe(false);
    expect(prismaMock.classAccess.findFirst).not.toHaveBeenCalled();
  });

  it("an expired pass does not", async () => {
    pass(days(-90), days(-1));
    expect(await hasClassAccess(42, OFFERING.boardId, OFFERING.classId)).toBe(false);
  });

  it("a pass that has not started yet does not — the bound the route was missing", async () => {
    // Exactly the renewal case: bought today, starts when the current pass
    // ends. Real content must stay locked until the window opens.
    pass(days(30), days(120));
    expect(await hasClassAccess(42, OFFERING.boardId, OFFERING.classId)).toBe(false);
  });

  it("asks the database for both bounds", async () => {
    await hasClassAccess(42, 1, 5);
    const where = prismaMock.classAccess.findFirst.mock.calls[0][0]?.where as Record<string, unknown>;
    expect(where).toMatchObject({ studentId: 42, boardId: 1, classId: 5 });
    expect(where.startsAt).toEqual({ lte: expect.any(Date) });
    expect(where.expiresAt).toEqual({ gt: expect.any(Date) });
  });

  it("a pass for another class does not leak across", async () => {
    // The scope is part of the query, so a covering pass elsewhere is irrelevant.
    prismaMock.classAccess.findFirst.mockResolvedValue(null);
    expect(await hasClassAccess(42, 2, 9)).toBe(false);
  });
});
