import { z } from "zod";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError, parseBody, success, error } from "@/lib/api-utils";

/**
 * Offerings hub — the shelves.
 *
 * One row per real Board + Class + Subject. This is the keystone the whole
 * content spine hangs off: chapters, tests, videos and the free sample all
 * belong to an offering, never to a bare subject.
 *
 * GET  ?boardId&classId&subjectId&search  → shelves with their content counts
 * POST                                    → create a shelf
 */
const createSchema = z.object({
  boardId: z.number().int().positive(),
  classId: z.number().int().positive(),
  subjectId: z.number().int().positive(),
});

export async function GET(request: NextRequest) {
  try {
    await requireAuth("admin");
    const p = request.nextUrl.searchParams;
    const boardId = Number(p.get("boardId")) || undefined;
    const classId = Number(p.get("classId")) || undefined;
    const subjectId = Number(p.get("subjectId")) || undefined;
    const search = (p.get("search") ?? "").trim();

    const offerings = await prisma.offering.findMany({
      where: {
        boardId,
        classId,
        subjectId,
        ...(search ? { subject: { name: { contains: search } } } : {}),
      },
      include: {
        board: { select: { id: true, name: true, code: true } },
        class: { select: { id: true, name: true, sortOrder: true } },
        subject: { select: { id: true, name: true } },
        freeTest: { select: { testId: true } },
        _count: { select: { chapters: true, tests: true, videos: true } },
      },
      orderBy: [{ board: { sortOrder: "asc" } }, { class: { sortOrder: "asc" } }, { subject: { name: "asc" } }],
    });

    // A question belongs to THIS shelf when it carries one of this offering's
    // chapters. Counting by subject instead would be badly misleading: the
    // bank is shared, so Class 10 Maths would advertise every Class 6–12 Maths
    // question as its own. One query, summed per offering.
    const offeringIds = offerings.map((o) => o.id);
    const qCounts = new Map<number, number>();
    if (offeringIds.length > 0) {
      const chapterCounts = await prisma.chapter.findMany({
        where: { offeringId: { in: offeringIds }, isActive: true },
        select: { offeringId: true, _count: { select: { questions: { where: { isActive: true } } } } },
      });
      for (const c of chapterCounts) {
        qCounts.set(c.offeringId, (qCounts.get(c.offeringId) ?? 0) + c._count.questions);
      }
    }

    // Tests that have no questions at all — a shelf-level warning.
    const emptyTests = await prisma.test.findMany({
      where: { isActive: true, questions: { none: {} } },
      select: { offeringId: true },
    });
    const emptyByOffering = new Map<number, number>();
    for (const t of emptyTests) {
      emptyByOffering.set(t.offeringId, (emptyByOffering.get(t.offeringId) ?? 0) + 1);
    }

    return success(offerings.map((o) => ({
      id: o.id,
      isActive: o.isActive,
      board: o.board,
      class: o.class,
      subject: o.subject,
      label: `${o.board.code} ▸ ${o.class.name} ▸ ${o.subject.name}`,
      counts: {
        chapters: o._count.chapters,
        tests: o._count.tests,
        videos: o._count.videos,
        questions: qCounts.get(o.id) ?? 0,
        emptyTests: emptyByOffering.get(o.id) ?? 0,
      },
      hasFreeSample: !!o.freeTest,
    })));
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: Request) {
  try {
    await requireAuth("admin");
    const body = await parseBody(request, createSchema);

    const [board, cls, subject] = await Promise.all([
      prisma.board.findUnique({ where: { id: body.boardId }, select: { id: true } }),
      prisma.class.findUnique({ where: { id: body.classId }, select: { id: true } }),
      prisma.subject.findUnique({ where: { id: body.subjectId }, select: { id: true } }),
    ]);
    if (!board) return error("Board not found", 404);
    if (!cls) return error("Class not found", 404);
    if (!subject) return error("Subject not found", 404);

    const existing = await prisma.offering.findUnique({
      where: { boardId_classId_subjectId: { boardId: body.boardId, classId: body.classId, subjectId: body.subjectId } },
      select: { id: true },
    });
    if (existing) return error("That offering already exists", 409);

    // Creating a shelf implies the board offers the class — keep the map honest.
    await prisma.boardClass.upsert({
      where: { boardId_classId: { boardId: body.boardId, classId: body.classId } },
      create: { boardId: body.boardId, classId: body.classId },
      update: {},
    });

    const created = await prisma.offering.create({
      data: { boardId: body.boardId, classId: body.classId, subjectId: body.subjectId },
      include: {
        board: { select: { id: true, name: true, code: true } },
        class: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true } },
      },
    });

    return success({
      id: created.id,
      label: `${created.board.code} ▸ ${created.class.name} ▸ ${created.subject.name}`,
    }, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
