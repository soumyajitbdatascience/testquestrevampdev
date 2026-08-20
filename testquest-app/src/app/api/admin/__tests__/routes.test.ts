import { describe, expect, it } from "vitest";
import { prismaMock } from "@/test/prisma-mock";
import { bareRequest, getRequest, jsonRequest, readJson, routeCtx } from "@/test/http";

/**
 * §3.2.A — CRUD and validation across the admin resources.
 *
 * Three things per resource: a create that works and a create that is missing a
 * required field, an update that persists and one against an unknown id, and —
 * where the table can grow — proof that the list is bounded.
 */

// ── Boards ───────────────────────────────────────────────────────────────
describe("boards", () => {
  it("creates a board and upper-cases its code", async () => {
    const { POST } = await import("@/app/api/admin/boards/route");
    prismaMock.board.create.mockResolvedValue({ id: 5, name: "Kerala", code: "KL" } as never);

    const res = await readJson(
      await POST(jsonRequest("/api/admin/boards", { name: "Kerala", code: "kl" })),
    );

    expect(res.status).toBe(201);
    expect((prismaMock.board.create.mock.calls[0][0].data as Record<string, unknown>).code).toBe("KL");
  });

  it("400s when a required field is missing", async () => {
    const { POST } = await import("@/app/api/admin/boards/route");

    const res = await readJson(await POST(jsonRequest("/api/admin/boards", { name: "Kerala" })));

    expect(res.status).toBe(400);
    expect(prismaMock.board.create).not.toHaveBeenCalled();
  });

  it("patches a board", async () => {
    const { PATCH } = await import("@/app/api/admin/boards/[id]/route");
    prismaMock.board.update.mockResolvedValue({ id: 1, name: "CBSE Renamed" } as never);

    const res = await readJson(
      await PATCH(jsonRequest("/api/admin/boards/1", { name: "CBSE Renamed" }, "PATCH"), routeCtx({ id: "1" })),
    );

    expect(res.status).toBe(200);
    expect(prismaMock.board.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 1 } }),
    );
  });
});

// ── Classes ──────────────────────────────────────────────────────────────
describe("classes", () => {
  it("lists the clean master with its board mapping", async () => {
    const { GET } = await import("@/app/api/admin/taxonomy/classes/route");
    prismaMock.class.findMany.mockResolvedValue([
      { id: 5, name: "Class 10", sortOrder: 10, isActive: true, legacyId: 45,
        boardClasses: [{ board: { id: 1, code: "CBSE", name: "CBSE" } }],
        _count: { offerings: 6 } },
    ] as never);

    const res = await readJson(await GET());
    const rows = res.data as Array<Record<string, unknown>>;

    expect(res.status).toBe(200);
    expect(rows[0].boards).toEqual([{ id: 1, code: "CBSE", name: "CBSE" }]);
    expect(rows[0]._count).toEqual({ offerings: 6 });
  });

  it("400s on a create with no name", async () => {
    const { POST } = await import("@/app/api/admin/taxonomy/classes/route");

    const res = await readJson(await POST(jsonRequest("/api/admin/taxonomy/classes", {})));

    expect(res.status).toBe(400);
    expect(prismaMock.class.create).not.toHaveBeenCalled();
  });

  it("404s a detail read for an unknown id", async () => {
    const { GET } = await import("@/app/api/admin/taxonomy/classes/[id]/route");
    prismaMock.class.findUnique.mockResolvedValue(null);

    const res = await readJson(await GET(bareRequest("/x", "GET"), routeCtx({ id: "999" })));

    expect(res.status).toBe(404);
  });

  it("deletes softly — the row is deactivated, never removed", async () => {
    const { DELETE } = await import("@/app/api/admin/taxonomy/classes/[id]/route");
    prismaMock.class.update.mockResolvedValue({ id: 5 } as never);

    await DELETE(bareRequest("/x", "DELETE"), routeCtx({ id: "5" }));

    expect(prismaMock.class.delete).not.toHaveBeenCalled();
    expect(prismaMock.class.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isActive: false } }),
    );
  });
});

// ── Subjects ─────────────────────────────────────────────────────────────
describe("subjects", () => {
  it("lists the master with offering and question counts, and no class", async () => {
    const { GET } = await import("@/app/api/admin/taxonomy/subjects/route");
    prismaMock.subject.findMany.mockResolvedValue([
      { id: 1, name: "Mathematics", sortOrder: 1, isActive: true, _count: { offerings: 5, questions: 1347 } },
    ] as never);

    const res = await readJson(await GET(getRequest("/api/admin/taxonomy/subjects")));
    const rows = res.data as Array<Record<string, unknown>>;

    expect(rows[0]).not.toHaveProperty("classId");
    expect(rows[0]).not.toHaveProperty("class");
    expect(rows[0]._count).toEqual({ offerings: 5, questions: 1347 });
  });

  it("404s a detail read for an unknown id", async () => {
    const { GET } = await import("@/app/api/admin/taxonomy/subjects/[id]/route");
    prismaMock.subject.findUnique.mockResolvedValue(null);

    const res = await readJson(await GET(bareRequest("/x", "GET"), routeCtx({ id: "999" })));

    expect(res.status).toBe(404);
  });
});

// ── Offerings ────────────────────────────────────────────────────────────
describe("offerings", () => {
  it("404s an unknown offering", async () => {
    const { GET } = await import("@/app/api/admin/offerings/[id]/route");
    prismaMock.offering.findUnique.mockResolvedValue(null);

    const res = await readJson(await GET(bareRequest("/x", "GET"), routeCtx({ id: "999" })));

    expect(res.status).toBe(404);
  });

  it("reports the offering's own question count and the wider subject pool separately", async () => {
    const { GET } = await import("@/app/api/admin/offerings/[id]/route");
    prismaMock.offering.findUnique.mockResolvedValue({
      id: 25, isActive: true, subjectId: 1,
      board: { id: 1, name: "CBSE", code: "CBSE" },
      class: { id: 5, name: "Class 10" },
      subject: { id: 1, name: "Mathematics" },
      freeTest: { testId: 2 },
      _count: { chapters: 16, tests: 41, videos: 0 },
    } as never);
    // Called in order: this shelf's own questions, then the shared subject pool
    // that spans every class offering Mathematics.
    prismaMock.question.count.mockResolvedValueOnce(756).mockResolvedValueOnce(1347);

    const res = await readJson(await GET(bareRequest("/x", "GET"), routeCtx({ id: "25" })));
    const data = res.data as { counts: Record<string, number> };

    // These must not be conflated — reporting the pool as the shelf's own was a
    // real bug: Class 10 Maths claimed all 1,347 subject questions.
    expect(data.counts.questions).toBe(756);
    expect(data.counts.subjectBank).toBe(1347);
    expect(data.counts).toMatchObject({ chapters: 16, tests: 41 });
  });

  it("refuses to archive an offering that still holds content", async () => {
    const { DELETE } = await import("@/app/api/admin/offerings/[id]/route");
    prismaMock.offering.findUnique.mockResolvedValue({
      _count: { chapters: 16, tests: 41, videos: 0 },
    } as never);

    const res = await readJson(await DELETE(bareRequest("/x", "DELETE"), routeCtx({ id: "25" })));

    expect(res.status).toBe(409);
    expect(prismaMock.offering.update).not.toHaveBeenCalled();
  });
});

// ── Chapters ─────────────────────────────────────────────────────────────
describe("chapters", () => {
  it("404s a patch for a chapter that belongs to another offering", async () => {
    const { PATCH } = await import("@/app/api/admin/offerings/[id]/chapters/[chapterId]/route");
    prismaMock.chapter.findFirst.mockResolvedValue(null);

    const res = await readJson(
      await PATCH(
        jsonRequest("/x", { name: "Renamed" }, "PATCH"),
        routeCtx({ id: "25", chapterId: "999" }),
      ),
    );

    expect(res.status).toBe(404);
    expect(prismaMock.chapter.update).not.toHaveBeenCalled();
  });

  it("refuses to archive a chapter that still has questions tagged", async () => {
    const { DELETE } = await import("@/app/api/admin/offerings/[id]/chapters/[chapterId]/route");
    prismaMock.chapter.findFirst.mockResolvedValue({ id: 75 } as never);
    prismaMock.question.count.mockResolvedValue(47);

    const res = await readJson(
      await DELETE(bareRequest("/x", "DELETE"), routeCtx({ id: "25", chapterId: "75" })),
    );

    expect(res.status).toBe(409);
    expect(res.error).toMatch(/47 question/i);
    expect(prismaMock.chapter.update).not.toHaveBeenCalled();
  });

  it("rejects a reorder containing a chapter from another offering", async () => {
    const { PUT } = await import("@/app/api/admin/offerings/[id]/chapters/route");
    // Only two of the three ids belong to this offering.
    prismaMock.chapter.findMany.mockResolvedValue([{ id: 75 }, { id: 76 }] as never);

    const res = await readJson(
      await PUT(jsonRequest("/x", { order: [75, 76, 999] }, "PUT"), routeCtx({ id: "25" })),
    );

    expect(res.status).toBe(400);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});

// ── Questions ────────────────────────────────────────────────────────────
describe("questions", () => {
  function stubOffering() {
    prismaMock.offering.findUnique.mockResolvedValue({ id: 25, subjectId: 1 } as never);
  }

  it("never lists the bank unbounded — take and skip are always passed", async () => {
    const { GET } = await import("@/app/api/admin/offerings/[id]/questions/route");
    stubOffering();
    prismaMock.question.count.mockResolvedValue(5473);
    prismaMock.question.findMany.mockResolvedValue([] as never);

    await GET(getRequest("/api/admin/offerings/25/questions"), routeCtx({ id: "25" }));

    const args = prismaMock.question.findMany.mock.calls[0][0] as { take?: number; skip?: number };
    expect(args.take).toBeGreaterThan(0);
    expect(args.take).toBeLessThanOrEqual(100);
    expect(args.skip).toBe(0);
  });

  it("pages with skip = (page - 1) * limit", async () => {
    const { GET } = await import("@/app/api/admin/offerings/[id]/questions/route");
    stubOffering();
    prismaMock.question.count.mockResolvedValue(5473);
    prismaMock.question.findMany.mockResolvedValue([] as never);

    await GET(getRequest("/api/admin/offerings/25/questions?page=4&limit=25"), routeCtx({ id: "25" }));

    const args = prismaMock.question.findMany.mock.calls[0][0] as { take?: number; skip?: number };
    expect(args).toMatchObject({ take: 25, skip: 75 });
  });

  it("caps an oversized limit rather than honouring it", async () => {
    const { GET } = await import("@/app/api/admin/offerings/[id]/questions/route");
    stubOffering();
    prismaMock.question.count.mockResolvedValue(5473);
    prismaMock.question.findMany.mockResolvedValue([] as never);

    await GET(getRequest("/api/admin/offerings/25/questions?limit=99999"), routeCtx({ id: "25" }));

    const args = prismaMock.question.findMany.mock.calls[0][0] as { take?: number };
    expect(args.take).toBeLessThanOrEqual(100);
  });

  it("defaults to this offering's own questions, not the whole subject pool", async () => {
    const { GET } = await import("@/app/api/admin/offerings/[id]/questions/route");
    stubOffering();
    prismaMock.question.count.mockResolvedValue(756);
    prismaMock.question.findMany.mockResolvedValue([] as never);

    await GET(getRequest("/api/admin/offerings/25/questions"), routeCtx({ id: "25" }));

    const where = (prismaMock.question.findMany.mock.calls[0][0] as { where: Record<string, unknown> }).where;
    expect(where.chapter).toEqual({ offeringId: 25 });
    expect(where).not.toHaveProperty("subjectId");
  });

  it("widens to the shared pool only when scope=subject is asked for", async () => {
    const { GET } = await import("@/app/api/admin/offerings/[id]/questions/route");
    stubOffering();
    prismaMock.question.count.mockResolvedValue(1347);
    prismaMock.question.findMany.mockResolvedValue([] as never);

    await GET(getRequest("/api/admin/offerings/25/questions?scope=subject"), routeCtx({ id: "25" }));

    const where = (prismaMock.question.findMany.mock.calls[0][0] as { where: Record<string, unknown> }).where;
    expect(where.subjectId).toBe(1);
  });

  it("404s when the offering does not exist", async () => {
    const { GET } = await import("@/app/api/admin/offerings/[id]/questions/route");
    prismaMock.offering.findUnique.mockResolvedValue(null);

    const res = await readJson(
      await GET(getRequest("/api/admin/offerings/999/questions"), routeCtx({ id: "999" })),
    );

    expect(res.status).toBe(404);
  });

  it("rejects a single-answer MCQ that has two correct options", async () => {
    const { POST } = await import("@/app/api/admin/offerings/[id]/questions/route");
    stubOffering();

    const res = await readJson(
      await POST(jsonRequest("/x", {
        type: "SINGLE_MCQ", text: "2 + 2?",
        options: [
          { label: "A", text: "3", isCorrect: true },
          { label: "B", text: "4", isCorrect: true },
        ],
      }), routeCtx({ id: "25" })),
    );

    expect(res.status).toBe(400);
    expect(prismaMock.question.create).not.toHaveBeenCalled();
  });

  it("rejects a fill-in-the-blank with no accepted answer", async () => {
    const { POST } = await import("@/app/api/admin/offerings/[id]/questions/route");
    stubOffering();

    const res = await readJson(
      await POST(jsonRequest("/x", { type: "FILL_IN_BLANK", text: "√144 = ___" }), routeCtx({ id: "25" })),
    );

    expect(res.status).toBe(400);
    expect(prismaMock.question.create).not.toHaveBeenCalled();
  });

  it("rejects a chapter from another offering when creating", async () => {
    const { POST } = await import("@/app/api/admin/offerings/[id]/questions/route");
    stubOffering();
    prismaMock.chapter.findFirst.mockResolvedValue(null);

    const res = await readJson(
      await POST(jsonRequest("/x", {
        type: "SINGLE_MCQ", text: "q", chapterId: 999,
        options: [
          { label: "A", text: "3", isCorrect: true },
          { label: "B", text: "4", isCorrect: false },
        ],
      }), routeCtx({ id: "25" })),
    );

    expect(res.status).toBe(400);
    expect(prismaMock.question.create).not.toHaveBeenCalled();
  });
});

// ── Tests ────────────────────────────────────────────────────────────────
describe("tests", () => {
  it("refuses to make a test live while it has no questions", async () => {
    const { PATCH } = await import("@/app/api/admin/offerings/[id]/tests/[testId]/route");
    prismaMock.test.findFirst.mockResolvedValue({ id: 271 } as never);
    prismaMock.testQuestion.count.mockResolvedValue(0);

    const res = await readJson(
      await PATCH(jsonRequest("/x", { isActive: true }, "PATCH"), routeCtx({ id: "25", testId: "271" })),
    );

    expect(res.status).toBe(409);
    expect(prismaMock.test.update).not.toHaveBeenCalled();
  });

  it("refuses to archive the test that is the free sample", async () => {
    const { DELETE } = await import("@/app/api/admin/offerings/[id]/tests/[testId]/route");
    prismaMock.test.findFirst.mockResolvedValue({ id: 2 } as never);
    prismaMock.freeTest.findFirst.mockResolvedValue({ id: 1 } as never);

    const res = await readJson(
      await DELETE(bareRequest("/x", "DELETE"), routeCtx({ id: "25", testId: "2" })),
    );

    expect(res.status).toBe(409);
    expect(prismaMock.test.update).not.toHaveBeenCalled();
  });

  it("rejects a question set drawn from another offering's bank", async () => {
    const { PUT } = await import("@/app/api/admin/offerings/[id]/tests/[testId]/questions/route");
    prismaMock.test.findFirst.mockResolvedValue({ id: 271 } as never);
    // Only one of the two requested ids is on this shelf.
    prismaMock.question.findMany.mockResolvedValue([{ id: 100, marks: 1 }] as never);

    const res = await readJson(
      await PUT(jsonRequest("/x", { questionIds: [100, 999] }, "PUT"), routeCtx({ id: "25", testId: "271" })),
    );

    expect(res.status).toBe(400);
    expect(res.error).toMatch(/not in this offering/i);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("derives totalMarks from the questions rather than trusting the client", async () => {
    const { PUT } = await import("@/app/api/admin/offerings/[id]/tests/[testId]/questions/route");
    prismaMock.test.findFirst.mockResolvedValue({ id: 271 } as never);
    prismaMock.question.findMany.mockResolvedValue([
      { id: 100, marks: 2 }, { id: 101, marks: 3 },
    ] as never);
    prismaMock.$transaction.mockImplementation(async (fn: unknown) => {
      if (typeof fn === "function") return (fn as (tx: unknown) => unknown)(prismaMock);
      return undefined;
    });

    const res = await readJson(
      await PUT(jsonRequest("/x", { questionIds: [100, 101] }, "PUT"), routeCtx({ id: "25", testId: "271" })),
    );

    expect(res.status).toBe(200);
    expect(res.data).toMatchObject({ count: 2, totalMarks: 5 });
  });
});
