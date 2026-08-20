import { describe, expect, it } from "vitest";
import { prismaMock } from "@/test/prisma-mock";
import { jsonRequest, readJson, routeCtx } from "@/test/http";

/**
 * §3.2.B — the invariants that cause silent corruption.
 *
 * Each one gets a **rejected** test: the app layer must refuse, not the
 * database. A DB constraint that fires as a 500 is not the same as a guard that
 * fires as a clear 4xx, and only the second is safe to rely on.
 */

// ── B1 · Offering uniqueness ─────────────────────────────────────────────
describe("B1 — offering uniqueness (boardId, classId, subjectId)", () => {
  const body = { boardId: 1, classId: 5, subjectId: 1 };

  function stubMasters() {
    prismaMock.board.findUnique.mockResolvedValue({ id: 1 } as never);
    prismaMock.class.findUnique.mockResolvedValue({ id: 5 } as never);
    prismaMock.subject.findUnique.mockResolvedValue({ id: 1 } as never);
  }

  it("rejects a duplicate triple at the app layer with 409", async () => {
    const { POST } = await import("@/app/api/admin/offerings/route");
    stubMasters();
    prismaMock.offering.findUnique.mockResolvedValue({ id: 25 } as never);

    const res = await readJson(await POST(jsonRequest("/api/admin/offerings", body)));

    expect(res.status).toBe(409);
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/already exists/i);
    // The guard must short-circuit — no write may be attempted.
    expect(prismaMock.offering.create).not.toHaveBeenCalled();
  });

  it("creates the offering when the triple is new", async () => {
    const { POST } = await import("@/app/api/admin/offerings/route");
    stubMasters();
    prismaMock.offering.findUnique.mockResolvedValue(null);
    prismaMock.boardClass.upsert.mockResolvedValue({ id: 1 } as never);
    prismaMock.offering.create.mockResolvedValue({
      id: 31, board: { code: "CBSE" }, class: { name: "Class 10" }, subject: { name: "Mathematics" },
    } as never);

    const res = await readJson(await POST(jsonRequest("/api/admin/offerings", body)));

    expect(res.status).toBe(201);
    expect(prismaMock.offering.create).toHaveBeenCalledOnce();
  });

  it("404s when a referenced master does not exist", async () => {
    const { POST } = await import("@/app/api/admin/offerings/route");
    prismaMock.board.findUnique.mockResolvedValue(null);
    prismaMock.class.findUnique.mockResolvedValue({ id: 5 } as never);
    prismaMock.subject.findUnique.mockResolvedValue({ id: 1 } as never);

    const res = await readJson(await POST(jsonRequest("/api/admin/offerings", body)));

    expect(res.status).toBe(404);
    expect(prismaMock.offering.create).not.toHaveBeenCalled();
  });
});

// ── B2 · Subject is a pure master ────────────────────────────────────────
describe("B2 — subject is a pure master (no classId)", () => {
  it("rejects a create that carries classId instead of silently dropping it", async () => {
    const { POST } = await import("@/app/api/admin/taxonomy/subjects/route");

    const res = await readJson(
      await POST(jsonRequest("/api/admin/taxonomy/subjects", { name: "Mathematics", classId: 5 })),
    );

    expect(res.status).toBe(400);
    expect(res.ok).toBe(false);
    // Silently stripping would have written the subject and returned 201 —
    // the caller would never learn their model was wrong.
    expect(prismaMock.subject.create).not.toHaveBeenCalled();
  });

  it("rejects an update that carries classId", async () => {
    const { PATCH } = await import("@/app/api/admin/taxonomy/subjects/[id]/route");

    const res = await readJson(
      await PATCH(
        jsonRequest("/api/admin/taxonomy/subjects/1", { name: "Maths", classId: 5 }, "PATCH"),
        routeCtx({ id: "1" }),
      ),
    );

    expect(res.status).toBe(400);
    expect(prismaMock.subject.update).not.toHaveBeenCalled();
  });

  it("accepts a create with only master fields", async () => {
    const { POST } = await import("@/app/api/admin/taxonomy/subjects/route");
    prismaMock.subject.findFirst.mockResolvedValue({ sortOrder: 7 } as never);
    prismaMock.subject.create.mockResolvedValue({ id: 9, name: "Hindi", sortOrder: 8, isActive: true } as never);

    const res = await readJson(
      await POST(jsonRequest("/api/admin/taxonomy/subjects", { name: "Hindi" })),
    );

    expect(res.status).toBe(201);
    // Whatever was written, it cannot contain a class.
    const written = prismaMock.subject.create.mock.calls[0][0].data as Record<string, unknown>;
    expect(written).not.toHaveProperty("classId");
  });
});

// ── B3 · Free-sample validity ────────────────────────────────────────────
describe("B3 — free sample must be a test that has questions", () => {
  const path = "/api/admin/offerings/25/free-test";

  it("rejects a test with zero questions", async () => {
    const { PUT } = await import("@/app/api/admin/offerings/[id]/free-test/route");
    prismaMock.offering.findUnique.mockResolvedValue({ id: 25 } as never);
    prismaMock.test.findFirst.mockResolvedValue({ id: 7, _count: { questions: 0 } } as never);

    const res = await readJson(
      await PUT(jsonRequest(path, { testId: 7 }, "PUT"), routeCtx({ id: "25" })),
    );

    expect(res.status).toBe(400);
    expect(res.error).toMatch(/no questions/i);
    expect(prismaMock.freeTest.upsert).not.toHaveBeenCalled();
  });

  it("rejects a test that is not live or not in this offering", async () => {
    const { PUT } = await import("@/app/api/admin/offerings/[id]/free-test/route");
    prismaMock.offering.findUnique.mockResolvedValue({ id: 25 } as never);
    // The query filters on { id, offeringId, isActive } — a miss means one of
    // those failed, and either way the sample must not be set.
    prismaMock.test.findFirst.mockResolvedValue(null);

    const res = await readJson(
      await PUT(jsonRequest(path, { testId: 999 }, "PUT"), routeCtx({ id: "25" })),
    );

    expect(res.status).toBe(400);
    expect(prismaMock.freeTest.upsert).not.toHaveBeenCalled();
  });

  it("accepts a live test with questions", async () => {
    const { PUT } = await import("@/app/api/admin/offerings/[id]/free-test/route");
    prismaMock.offering.findUnique.mockResolvedValue({ id: 25 } as never);
    prismaMock.test.findFirst.mockResolvedValue({ id: 7, _count: { questions: 23 } } as never);
    prismaMock.freeTest.upsert.mockResolvedValue({ id: 1 } as never);

    const res = await readJson(
      await PUT(jsonRequest(path, { testId: 7 }, "PUT"), routeCtx({ id: "25" })),
    );

    expect(res.status).toBe(200);
    expect(prismaMock.freeTest.upsert).toHaveBeenCalledOnce();
  });

  it("clearing the sample needs no test and writes no upsert", async () => {
    const { PUT } = await import("@/app/api/admin/offerings/[id]/free-test/route");
    prismaMock.offering.findUnique.mockResolvedValue({ id: 25 } as never);
    prismaMock.freeTest.deleteMany.mockResolvedValue({ count: 1 } as never);

    const res = await readJson(
      await PUT(jsonRequest(path, { testId: null }, "PUT"), routeCtx({ id: "25" })),
    );

    expect(res.status).toBe(200);
    expect(prismaMock.freeTest.deleteMany).toHaveBeenCalledOnce();
    expect(prismaMock.freeTest.upsert).not.toHaveBeenCalled();
  });
});

// ── B4 · Chapters and tests belong to an offering ────────────────────────
describe("B4 — chapters and tests require a real offering", () => {
  it("rejects a chapter created under an unknown offering", async () => {
    const { POST } = await import("@/app/api/admin/offerings/[id]/chapters/route");
    prismaMock.offering.findUnique.mockResolvedValue(null);

    const res = await readJson(
      await POST(jsonRequest("/api/admin/offerings/999/chapters", { name: "Algebra" }), routeCtx({ id: "999" })),
    );

    expect(res.status).toBe(404);
    expect(prismaMock.chapter.create).not.toHaveBeenCalled();
  });

  it("rejects a test created under an unknown offering", async () => {
    const { POST } = await import("@/app/api/admin/offerings/[id]/tests/route");
    prismaMock.offering.findUnique.mockResolvedValue(null);

    const res = await readJson(
      await POST(
        jsonRequest("/api/admin/offerings/999/tests", { name: "Set 1", durationMinutes: 30 }),
        routeCtx({ id: "999" }),
      ),
    );

    expect(res.status).toBe(404);
    expect(prismaMock.test.create).not.toHaveBeenCalled();
  });

  it("attaches a created chapter to the offering from the path", async () => {
    const { POST } = await import("@/app/api/admin/offerings/[id]/chapters/route");
    prismaMock.offering.findUnique.mockResolvedValue({ id: 25 } as never);
    prismaMock.chapter.findFirst.mockResolvedValue({ sortOrder: 3 } as never);
    prismaMock.chapter.create.mockResolvedValue({ id: 90, name: "Algebra", sortOrder: 4, legacyId: null } as never);

    const res = await readJson(
      await POST(jsonRequest("/api/admin/offerings/25/chapters", { name: "Algebra" }), routeCtx({ id: "25" })),
    );

    expect(res.status).toBe(201);
    const data = prismaMock.chapter.create.mock.calls[0][0].data as Record<string, unknown>;
    expect(data.offeringId).toBe(25);
    // Content never attaches to a bare subject.
    expect(data).not.toHaveProperty("subjectId");
  });

  it("attaches a created test to the offering and starts it as a draft", async () => {
    const { POST } = await import("@/app/api/admin/offerings/[id]/tests/route");
    prismaMock.offering.findUnique.mockResolvedValue({ id: 25 } as never);
    prismaMock.test.create.mockResolvedValue({ id: 271, name: "Set 1" } as never);

    await POST(
      jsonRequest("/api/admin/offerings/25/tests", { name: "Set 1", durationMinutes: 30, isActive: true }),
      routeCtx({ id: "25" }),
    );

    const data = prismaMock.test.create.mock.calls[0][0].data as Record<string, unknown>;
    expect(data.offeringId).toBe(25);
    // A brand-new test has no questions, so it cannot be born live even if asked.
    expect(data.isActive).toBe(false);
    expect(data.totalMarks).toBe(0);
  });
});

// ── B5 · Plan durations and prices ───────────────────────────────────────
describe("B5 — plan durations are 3/6/12 and prices are non-negative", () => {
  const path = "/api/admin/plans";

  it("rejects an unsupported duration key instead of ignoring it", async () => {
    const { PUT } = await import("@/app/api/admin/plans/route");

    const res = await readJson(
      await PUT(jsonRequest(path, {
        boardId: 1, classId: 5,
        prices: { "3": 499, "6": 899, "12": 1499, "9": 1200 },
      }, "PUT")),
    );

    expect(res.status).toBe(400);
    expect(prismaMock.b2cPlan.create).not.toHaveBeenCalled();
    expect(prismaMock.b2cPlan.update).not.toHaveBeenCalled();
  });

  it("rejects a negative price", async () => {
    const { PUT } = await import("@/app/api/admin/plans/route");

    const res = await readJson(
      await PUT(jsonRequest(path, {
        boardId: 1, classId: 5,
        prices: { "3": -1, "6": 899, "12": 1499 },
      }, "PUT")),
    );

    expect(res.status).toBe(400);
    expect(prismaMock.b2cPlan.create).not.toHaveBeenCalled();
  });

  it("rejects an unknown top-level field", async () => {
    const { PUT } = await import("@/app/api/admin/plans/route");

    const res = await readJson(
      await PUT(jsonRequest(path, {
        boardId: 1, classId: 5, subjectId: 3,
        prices: { "3": 499, "6": 899, "12": 1499 },
      }, "PUT")),
    );

    expect(res.status).toBe(400);
  });

  it("rejects a fractional price — the column stores whole units", async () => {
    const { PUT } = await import("@/app/api/admin/plans/route");

    const res = await readJson(
      await PUT(jsonRequest(path, {
        boardId: 1, classId: 5,
        prices: { "3": 499.5, "6": 899, "12": 1499 },
      }, "PUT")),
    );

    expect(res.status).toBe(400);
    expect(prismaMock.b2cPlan.create).not.toHaveBeenCalled();
  });

  it("saves all three terms when the payload is valid", async () => {
    const { PUT } = await import("@/app/api/admin/plans/route");
    prismaMock.b2cPlan.findMany.mockResolvedValue([] as never);
    prismaMock.b2cPlan.create.mockResolvedValue({ id: 1 } as never);

    const res = await readJson(
      await PUT(jsonRequest(path, {
        boardId: 1, classId: 5,
        prices: { "3": 499, "6": 899, "12": 1499 },
      }, "PUT")),
    );

    expect(res.status).toBe(200);
    expect(prismaMock.b2cPlan.create).toHaveBeenCalledTimes(3);
    const durations = prismaMock.b2cPlan.create.mock.calls
      .map((c) => (c[0].data as Record<string, unknown>).durationMonths);
    expect(durations).toEqual([3, 6, 12]);
  });

  it("a positive price activates the term — pricing something never leaves it off", async () => {
    // The readiness trap: a plan with a price but isActive=false is not on sale,
    // so the write path has to switch it on rather than leave it to a toggle.
    const { PUT } = await import("@/app/api/admin/plans/route");
    prismaMock.b2cPlan.findMany.mockResolvedValue([
      { id: 12, boardId: 1, classId: 5, durationMonths: 3 },
    ] as never);
    prismaMock.b2cPlan.update.mockResolvedValue({ id: 12 } as never);
    prismaMock.b2cPlan.create.mockResolvedValue({ id: 13 } as never);

    await PUT(jsonRequest(path, {
      boardId: 1, classId: 5,
      prices: { "3": 499, "6": 899, "12": 1499 },
    }, "PUT"));

    expect(prismaMock.b2cPlan.update).toHaveBeenCalledWith({
      where: { id: 12 }, data: { price: 499, isActive: true },
    });
    const created = prismaMock.b2cPlan.create.mock.calls
      .map((c) => c[0].data as Record<string, unknown>);
    // A brand-new plan relies on the column default for isActive.
    expect(created.every((d) => d.isActive === undefined)).toBe(true);
  });

  it("a null or zero price deactivates that term rather than deleting history", async () => {
    const { PUT } = await import("@/app/api/admin/plans/route");
    prismaMock.b2cPlan.findMany.mockResolvedValue([
      { id: 12, boardId: 1, classId: 5, durationMonths: 3 },
      { id: 13, boardId: 1, classId: 5, durationMonths: 6 },
      { id: 14, boardId: 1, classId: 5, durationMonths: 12 },
    ] as never);
    prismaMock.b2cPlan.update.mockResolvedValue({ id: 12 } as never);

    await PUT(jsonRequest(path, {
      boardId: 1, classId: 5,
      prices: { "3": 0, "6": null, "12": 1499 },
    }, "PUT"));

    expect(prismaMock.b2cPlan.delete).not.toHaveBeenCalled();
    const deactivations = prismaMock.b2cPlan.update.mock.calls
      .filter((c) => (c[0].data as Record<string, unknown>).isActive === false);
    expect(deactivations).toHaveLength(2); // the 3- and 6-month terms
  });
});

// ── B5b · Bulk pricing ───────────────────────────────────────────────────
describe("B5b — bulk pricing applies many rows under the same rules", () => {
  const path = "/api/admin/plans/bulk";

  it("prices every row it was given and reports the count", async () => {
    const { POST } = await import("@/app/api/admin/plans/bulk/route");
    prismaMock.b2cPlan.findMany.mockResolvedValue([] as never);
    prismaMock.b2cPlan.create.mockResolvedValue({ id: 1 } as never);

    const rows = [4, 5, 6].map((classId) => ({
      boardId: 1, classId, prices: { "3": 499, "6": 899, "12": 1499 },
    }));
    const res = await readJson(await POST(jsonRequest(path, { rows })));

    expect(res.status).toBe(200);
    expect(res.data).toEqual({ applied: 3 });
    // Three rows × three terms, and all of it in one transaction rather than
    // nine round trips against the shared host.
    expect(prismaMock.b2cPlan.create).toHaveBeenCalledTimes(9);
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
  });

  it("reads existing plans once, not once per cell", async () => {
    const { POST } = await import("@/app/api/admin/plans/bulk/route");
    prismaMock.b2cPlan.findMany.mockResolvedValue([] as never);
    prismaMock.b2cPlan.create.mockResolvedValue({ id: 1 } as never);

    await POST(jsonRequest(path, {
      rows: [4, 5, 6, 7].map((classId) => ({
        boardId: 1, classId, prices: { "3": 499, "6": 899, "12": 1499 },
      })),
    }));

    expect(prismaMock.b2cPlan.findMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.b2cPlan.findFirst).not.toHaveBeenCalled();
  });

  it("rejects the whole batch when any row is invalid", async () => {
    const { POST } = await import("@/app/api/admin/plans/bulk/route");

    const res = await readJson(await POST(jsonRequest(path, {
      rows: [
        { boardId: 1, classId: 5, prices: { "3": 499, "6": 899, "12": 1499 } },
        { boardId: 1, classId: 6, prices: { "3": -1, "6": 899, "12": 1499 } },
      ],
    })));

    expect(res.status).toBe(400);
    expect(prismaMock.b2cPlan.create).not.toHaveBeenCalled();
    expect(prismaMock.b2cPlan.update).not.toHaveBeenCalled();
  });

  it("rejects an empty batch instead of reporting a no-op as success", async () => {
    const { POST } = await import("@/app/api/admin/plans/bulk/route");

    const res = await readJson(await POST(jsonRequest(path, { rows: [] })));

    expect(res.status).toBe(400);
  });

  it("collapses a repeated board+class so one cell is not written twice", async () => {
    const { POST } = await import("@/app/api/admin/plans/bulk/route");
    prismaMock.b2cPlan.findMany.mockResolvedValue([] as never);
    prismaMock.b2cPlan.create.mockResolvedValue({ id: 1 } as never);

    const res = await readJson(await POST(jsonRequest(path, {
      rows: [
        { boardId: 1, classId: 5, prices: { "3": 499, "6": 899, "12": 1499 } },
        { boardId: 1, classId: 5, prices: { "3": 599, "6": 999, "12": 1799 } },
      ],
    })));

    expect(res.data).toEqual({ applied: 1 });
    expect(prismaMock.b2cPlan.create).toHaveBeenCalledTimes(3);
    // Last one wins — it is what the grid was showing when Apply was pressed.
    const prices = prismaMock.b2cPlan.create.mock.calls
      .map((c) => (c[0].data as Record<string, unknown>).price);
    expect(prices).toEqual([599, 999, 1799]);
  });

  it("an undo payload of nulls deactivates without deleting", async () => {
    const { POST } = await import("@/app/api/admin/plans/bulk/route");
    prismaMock.b2cPlan.findMany.mockResolvedValue([
      { id: 21, boardId: 1, classId: 5, durationMonths: 3 },
      { id: 22, boardId: 1, classId: 5, durationMonths: 6 },
      { id: 23, boardId: 1, classId: 5, durationMonths: 12 },
    ] as never);
    prismaMock.b2cPlan.update.mockResolvedValue({ id: 21 } as never);

    await POST(jsonRequest(path, {
      rows: [{ boardId: 1, classId: 5, prices: { "3": null, "6": null, "12": null } }],
    }));

    expect(prismaMock.b2cPlan.delete).not.toHaveBeenCalled();
    expect(prismaMock.b2cPlan.create).not.toHaveBeenCalled();
    expect(prismaMock.b2cPlan.update.mock.calls.map((c) => c[0].data)).toEqual([
      { isActive: false }, { isActive: false }, { isActive: false },
    ]);
  });
});
