import { z } from "zod";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError, parseBody, success, error } from "@/lib/api-utils";
import { ensureOfferingId, findOfferingId } from "@/lib/offerings";

/**
 * Chapters & tagging (design 2b), scoped to board+class+subject.
 * GET  ?boardId&classId&subjectId[&chapterId|untagged=1][&search][&page]
 *      → chapter list with counts + the requested test pane (server-paginated)
 * POST → create chapter in the context
 *
 * TODO(phase 2): this screen is retired as a standalone and moves inside the
 * offering workspace. The chapter/video reads below are already offering-scoped;
 * the test-tagging half still reads legacy `vw_*` views and `tq_chapter_tests`,
 * which do not exist in the new DB — it is replaced wholesale in phase 2.
 */
const createSchema = z.object({
  boardId: z.number().int().positive(),
  classId: z.number().int().positive(),
  subjectId: z.number().int().positive(),
  name: z.string().min(1).max(200),
});

const PAGE_SIZE = 50;

export async function GET(request: NextRequest) {
  try {
    await requireAuth("admin");
    const p = request.nextUrl.searchParams;
    const boardId = Number(p.get("boardId"));
    const classId = Number(p.get("classId"));
    const subjectId = Number(p.get("subjectId"));
    if (!boardId || !classId || !subjectId) return error("boardId, classId, subjectId required", 400);

    const offeringId = await findOfferingId(boardId, classId, subjectId);
    const chapters = offeringId
      ? await prisma.chapter.findMany({
          where: { offeringId, isActive: true },
          orderBy: { sortOrder: "asc" },
        })
      : [];
    const chapterIds = chapters.map((c) => c.id);

    // All tests of the subject (id, name, meta) — the tagging universe
    const tests = await prisma.$queryRawUnsafe<Array<{
      id: number; name: string; durationMinutes: number; isFree: number | boolean;
    }>>(
      `SELECT id, name, durationMinutes, isFree FROM vw_tests
       WHERE subjectId = ? AND isActive = 1 ORDER BY name`, subjectId,
    );
    const qCounts = new Map<number, number>();
    if (tests.length > 0) {
      const qc = await prisma.$queryRawUnsafe<Array<{ testId: number; n: bigint }>>(
        `SELECT testId, COUNT(*) AS n FROM vw_test_questions
         WHERE testId IN (${tests.map(() => "?").join(",")}) GROUP BY testId`,
        ...tests.map((t) => Number(t.id)),
      );
      for (const r of qc) qCounts.set(Number(r.testId), Number(r.n));
    }

    // Tagging state within this context + cross-board chips
    const taggings = chapterIds.length
      ? await prisma.chapterTest.findMany({ where: { chapterId: { in: chapterIds } }, orderBy: { sortOrder: "asc" } })
      : [];
    const taggedHere = new Map<number, number>(); // testId -> chapterId (this context)
    for (const t of taggings) taggedHere.set(t.testId, t.chapterId);

    const testIds = tests.map((t) => Number(t.id));
    const elsewhere = new Map<number, Array<{ boardCode: string; className: string }>>();
    if (testIds.length > 0) {
      const rows = await prisma.$queryRawUnsafe<Array<{ testId: number; code: string; classId: number }>>(
        `SELECT ct.testId, b.code, c.classId
         FROM tq_chapter_tests ct
         JOIN tq_chapters c ON c.id = ct.chapterId
         JOIN tq_boards b ON b.id = c.boardId
         WHERE ct.testId IN (${testIds.map(() => "?").join(",")})
           AND NOT (c.boardId = ? AND c.classId = ? AND c.subjectId = ?)`,
        ...testIds, boardId, classId, subjectId,
      );
      const classNames = new Map(
        (await prisma.$queryRawUnsafe<Array<{ id: number; name: string }>>(`SELECT id, name FROM vw_classes`))
          .map((c) => [Number(c.id), c.name]),
      );
      for (const r of rows) {
        const list = elsewhere.get(Number(r.testId)) ?? [];
        list.push({ boardCode: r.code, className: classNames.get(Number(r.classId)) ?? String(r.classId) });
        elsewhere.set(Number(r.testId), list);
      }
    }

    const videoCounts = new Map<number, number>();
    const vids = offeringId
      ? await prisma.video.findMany({
          where: { offeringId, isActive: true, chapterId: { not: null } },
          select: { chapterId: true },
        })
      : [];
    for (const v of vids) {
      if (v.chapterId != null) videoCounts.set(v.chapterId, (videoCounts.get(v.chapterId) ?? 0) + 1);
    }

    const chapterCounts = new Map<number, number>();
    for (const t of taggings) chapterCounts.set(t.chapterId, (chapterCounts.get(t.chapterId) ?? 0) + 1);

    // Requested pane: a chapter's tests or the untagged pool
    const chapterId = Number(p.get("chapterId")) || null;
    const search = (p.get("search") ?? "").trim().toLowerCase();
    const freeFilter = p.get("free"); // "1" | "0" | null
    const page = Math.max(1, Number(p.get("page") || "1"));

    const rowFor = (t: (typeof tests)[number]) => ({
      id: Number(t.id),
      name: t.name,
      questionCount: qCounts.get(Number(t.id)) ?? 0,
      durationMinutes: Number(t.durationMinutes),
      isFree: !!t.isFree,
      chapterId: taggedHere.get(Number(t.id)) ?? null,
      elsewhere: elsewhere.get(Number(t.id)) ?? [],
    });

    let pool = chapterId
      ? tests.filter((t) => taggedHere.get(Number(t.id)) === chapterId)
      : tests.filter((t) => !taggedHere.has(Number(t.id)));
    if (search) pool = pool.filter((t) => t.name.toLowerCase().includes(search));
    if (freeFilter === "1") pool = pool.filter((t) => !!t.isFree);
    if (freeFilter === "0") pool = pool.filter((t) => !t.isFree);

    const total = pool.length;
    const pageRows = pool.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map(rowFor);

    return success({
      chapters: chapters.map((c) => ({
        id: c.id,
        name: c.name,
        sortOrder: c.sortOrder,
        testCount: chapterCounts.get(c.id) ?? 0,
        videoCount: videoCounts.get(c.id) ?? 0,
      })),
      untaggedCount: tests.filter((t) => !taggedHere.has(Number(t.id))).length,
      totalTests: tests.length,
      pane: { rows: pageRows, total, page, pageSize: PAGE_SIZE },
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: Request) {
  try {
    await requireAuth("admin");
    const body = await parseBody(request, createSchema);
    const offeringId = await ensureOfferingId(body.boardId, body.classId, body.subjectId);
    const last = await prisma.chapter.findFirst({
      where: { offeringId },
      orderBy: { sortOrder: "desc" },
    });
    const chapter = await prisma.chapter.create({
      data: { offeringId, name: body.name, sortOrder: (last?.sortOrder ?? 0) + 1 },
    });
    return success(chapter, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
