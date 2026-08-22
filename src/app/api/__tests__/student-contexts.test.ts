import { describe, expect, it } from "vitest";
import { prismaMock } from "@/test/prisma-mock";
import { bareRequest, jsonRequest, readJson } from "@/test/http";

/**
 * Student board+class contexts — onboarding's only write.
 *
 * Two invariants carry the weight: a context must name a board+class that
 * actually exists (or the student binds themselves to a shelf that can never
 * have content), and exactly one context is primary (or the header opens
 * somewhere arbitrary). Both are enforced in the route, not just the UI.
 */

/** `$transaction(fn)` runs its callback against the same mock client. */
function stubTransaction() {
  prismaMock.$transaction.mockImplementation(
    (async (fn: (tx: typeof prismaMock) => unknown) => fn(prismaMock)) as never,
  );
}

const path = "/api/student/contexts";

describe("POST /api/student/contexts", () => {
  it("rejects a board+class the board doesn't run", async () => {
    const { POST } = await import("@/app/api/student/contexts/route");
    prismaMock.boardClass.findFirst.mockResolvedValue(null);

    const res = await readJson(await POST(jsonRequest(path, { boardId: 1, classId: 999 })));

    expect(res.status).toBe(404);
    expect(prismaMock.studentContext.upsert).not.toHaveBeenCalled();
  });

  it("makes the first context primary without being asked", async () => {
    const { POST } = await import("@/app/api/student/contexts/route");
    prismaMock.boardClass.findFirst.mockResolvedValue({ id: 1 } as never);
    prismaMock.studentContext.count.mockResolvedValue(0);
    prismaMock.studentContext.upsert.mockResolvedValue({ id: 7, isPrimary: true } as never);
    stubTransaction();

    const res = await readJson(await POST(jsonRequest(path, { boardId: 1, classId: 5 })));

    expect(res.status).toBe(201);
    const args = prismaMock.studentContext.upsert.mock.calls[0][0];
    expect((args.create as Record<string, unknown>).isPrimary).toBe(true);
  });

  it("a second context is not primary unless asked", async () => {
    const { POST } = await import("@/app/api/student/contexts/route");
    prismaMock.boardClass.findFirst.mockResolvedValue({ id: 1 } as never);
    prismaMock.studentContext.count.mockResolvedValue(1);
    prismaMock.studentContext.upsert.mockResolvedValue({ id: 8, isPrimary: false } as never);
    stubTransaction();

    await POST(jsonRequest(path, { boardId: 1, classId: 6 }));

    const args = prismaMock.studentContext.upsert.mock.calls[0][0];
    expect((args.create as Record<string, unknown>).isPrimary).toBe(false);
    // Nothing was demoted, because nothing was promoted.
    expect(prismaMock.studentContext.updateMany).not.toHaveBeenCalled();
  });

  it("promoting a context demotes the previous primary in the same transaction", async () => {
    const { POST } = await import("@/app/api/student/contexts/route");
    prismaMock.boardClass.findFirst.mockResolvedValue({ id: 1 } as never);
    prismaMock.studentContext.count.mockResolvedValue(2);
    prismaMock.studentContext.upsert.mockResolvedValue({ id: 9, isPrimary: true } as never);
    stubTransaction();

    await POST(jsonRequest(path, { boardId: 1, classId: 7, isPrimary: true }));

    expect(prismaMock.studentContext.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isPrimary: false } }),
    );
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
  });

  it("re-adding an existing context is idempotent, not an error", async () => {
    const { POST } = await import("@/app/api/student/contexts/route");
    prismaMock.boardClass.findFirst.mockResolvedValue({ id: 1 } as never);
    prismaMock.studentContext.count.mockResolvedValue(1);
    prismaMock.studentContext.upsert.mockResolvedValue({ id: 7, isPrimary: false } as never);
    stubTransaction();

    const res = await readJson(await POST(jsonRequest(path, { boardId: 1, classId: 5 })));

    expect(res.status).toBe(201);
    expect(prismaMock.studentContext.upsert).toHaveBeenCalled();
  });

  it("400s on a malformed payload instead of writing a junk row", async () => {
    const { POST } = await import("@/app/api/student/contexts/route");

    const res = await readJson(await POST(jsonRequest(path, { boardId: 1 })));

    expect(res.status).toBe(400);
    expect(prismaMock.studentContext.upsert).not.toHaveBeenCalled();
  });
});

describe("GET /api/student/contexts", () => {
  it("reports a context as subscribed only while its pass is live", async () => {
    const { GET } = await import("@/app/api/student/contexts/route");
    const past = new Date(Date.now() - 86_400_000);
    const future = new Date(Date.now() + 86_400_000);

    prismaMock.studentContext.findMany.mockResolvedValue([
      { id: 1, boardId: 1, classId: 5, isPrimary: true },
      { id: 2, boardId: 1, classId: 6, isPrimary: false },
    ] as never);
    prismaMock.board.findMany.mockResolvedValue([{ id: 1, name: "CBSE", code: "CBSE" }] as never);
    prismaMock.class.findMany.mockResolvedValue([
      { id: 5, name: "Class 10" }, { id: 6, name: "Class 11" },
    ] as never);
    prismaMock.classAccess.findMany.mockResolvedValue([
      { boardId: 1, classId: 5, expiresAt: future },
      { boardId: 1, classId: 6, expiresAt: past },
    ] as never);

    const rows = (await readJson(await GET())).data as Array<Record<string, unknown>>;

    expect(rows[0]).toMatchObject({ className: "Class 10", subscribed: true });
    // An expired pass is history, not entitlement.
    expect(rows[1]).toMatchObject({ className: "Class 11", subscribed: false });
  });

  it("returns an empty list for a student who hasn't onboarded", async () => {
    const { GET } = await import("@/app/api/student/contexts/route");
    prismaMock.studentContext.findMany.mockResolvedValue([] as never);

    expect((await readJson(await GET())).data).toEqual([]);
  });
});

describe("DELETE /api/student/contexts", () => {
  it("refuses to remove the last context", async () => {
    const { DELETE } = await import("@/app/api/student/contexts/route");
    prismaMock.studentContext.findUnique.mockResolvedValue(
      { id: 1, studentId: 1, isPrimary: true } as never,
    );
    prismaMock.studentContext.count.mockResolvedValue(1);

    const res = await readJson(await DELETE(bareRequest(`${path}?id=1`, "DELETE")));

    expect(res.status).toBe(400);
    expect(prismaMock.studentContext.delete).not.toHaveBeenCalled();
  });

  it("won't let a student delete somebody else's context", async () => {
    const { DELETE } = await import("@/app/api/student/contexts/route");
    prismaMock.studentContext.findUnique.mockResolvedValue(
      { id: 4, studentId: 999, isPrimary: false } as never,
    );

    const res = await readJson(await DELETE(bareRequest(`${path}?id=4`, "DELETE")));

    expect(res.status).toBe(404);
    expect(prismaMock.studentContext.delete).not.toHaveBeenCalled();
  });

  it("hands primary to the oldest survivor when the primary is removed", async () => {
    const { DELETE } = await import("@/app/api/student/contexts/route");
    prismaMock.studentContext.findUnique.mockResolvedValue(
      { id: 1, studentId: 1, isPrimary: true } as never,
    );
    prismaMock.studentContext.count.mockResolvedValue(2);
    prismaMock.studentContext.findFirst.mockResolvedValue({ id: 2 } as never);
    stubTransaction();

    await DELETE(bareRequest(`${path}?id=1`, "DELETE"));

    expect(prismaMock.studentContext.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    expect(prismaMock.studentContext.update).toHaveBeenCalledWith({
      where: { id: 2 }, data: { isPrimary: true },
    });
  });

  it("leaves the primary alone when a non-primary is removed", async () => {
    const { DELETE } = await import("@/app/api/student/contexts/route");
    prismaMock.studentContext.findUnique.mockResolvedValue(
      { id: 2, studentId: 1, isPrimary: false } as never,
    );
    prismaMock.studentContext.count.mockResolvedValue(2);
    stubTransaction();

    await DELETE(bareRequest(`${path}?id=2`, "DELETE"));

    expect(prismaMock.studentContext.delete).toHaveBeenCalledWith({ where: { id: 2 } });
    expect(prismaMock.studentContext.update).not.toHaveBeenCalled();
  });
});

describe("holding a context grants nothing", () => {
  it("adding a class never writes an access row", async () => {
    // Context is browsing scope; entitlement lives only in tq_class_access.
    const { POST } = await import("@/app/api/student/contexts/route");
    prismaMock.boardClass.findFirst.mockResolvedValue({ id: 1 } as never);
    prismaMock.studentContext.count.mockResolvedValue(0);
    prismaMock.studentContext.upsert.mockResolvedValue({ id: 1, isPrimary: true } as never);
    stubTransaction();

    await POST(jsonRequest(path, { boardId: 1, classId: 5 }));

    expect(prismaMock.classAccess.create).not.toHaveBeenCalled();
    expect(prismaMock.classAccess.upsert).not.toHaveBeenCalled();
  });
});
