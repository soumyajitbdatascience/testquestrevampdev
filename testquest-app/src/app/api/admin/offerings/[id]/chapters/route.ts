import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError, parseBody, success, error } from "@/lib/api-utils";

type Params = { params: Promise<{ id: string }> };

const createSchema = z.object({
  name: z.string().min(1).max(300),
});

/** Reorder payload — the full ordered list of chapter ids for this offering. */
const reorderSchema = z.object({
  order: z.array(z.number().int().positive()).min(1),
});

/**
 * Chapters of one offering, in syllabus order, with the counts the list shows:
 * how many questions carry the chapter, and how many tests draw on it.
 */
export async function GET(_request: Request, { params }: Params) {
  try {
    await requireAuth("admin");
    const { id } = await params;
    const offeringId = Number(id);
    if (!Number.isFinite(offeringId)) return error("Invalid offering id", 400);

    const chapters = await prisma.chapter.findMany({
      where: { offeringId, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      include: { _count: { select: { questions: true, videos: true } } },
    });

    // Tests touching each chapter, via the questions they contain. One grouped
    // query — never per-row (the shared DB has a 10s statement ceiling).
    const chapterIds = chapters.map((c) => c.id);
    const testsByChapter = new Map<number, Set<number>>();
    if (chapterIds.length > 0) {
      const links = await prisma.testQuestion.findMany({
        where: { question: { chapterId: { in: chapterIds } } },
        select: { testId: true, question: { select: { chapterId: true } } },
      });
      for (const l of links) {
        const ch = l.question.chapterId;
        if (ch == null) continue;
        const set = testsByChapter.get(ch) ?? new Set<number>();
        set.add(l.testId);
        testsByChapter.set(ch, set);
      }
    }

    return success(chapters.map((c) => ({
      id: c.id,
      name: c.name,
      sortOrder: c.sortOrder,
      legacyId: c.legacyId,
      counts: {
        questions: c._count.questions,
        videos: c._count.videos,
        tests: testsByChapter.get(c.id)?.size ?? 0,
      },
    })));
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    await requireAuth("admin");
    const { id } = await params;
    const offeringId = Number(id);
    const body = await parseBody(request, createSchema);

    const offering = await prisma.offering.findUnique({ where: { id: offeringId }, select: { id: true } });
    if (!offering) return error("Offering not found", 404);

    const last = await prisma.chapter.findFirst({
      where: { offeringId },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });

    const created = await prisma.chapter.create({
      data: { offeringId, name: body.name, sortOrder: (last?.sortOrder ?? 0) + 1 },
    });
    return success({
      id: created.id,
      name: created.name,
      sortOrder: created.sortOrder,
      legacyId: created.legacyId,
      counts: { questions: 0, videos: 0, tests: 0 },
    }, 201);
  } catch (err) {
    return handleApiError(err);
  }
}

/** Drag-to-reorder: rewrite sortOrder for every chapter in one transaction. */
export async function PUT(request: Request, { params }: Params) {
  try {
    await requireAuth("admin");
    const { id } = await params;
    const offeringId = Number(id);
    const body = await parseBody(request, reorderSchema);

    const owned = await prisma.chapter.findMany({
      where: { offeringId, id: { in: body.order } },
      select: { id: true },
    });
    if (owned.length !== body.order.length) {
      return error("Some chapters do not belong to this offering", 400);
    }

    await prisma.$transaction(
      body.order.map((chapterId, index) =>
        prisma.chapter.update({ where: { id: chapterId }, data: { sortOrder: index + 1 } }),
      ),
    );
    return success({ reordered: body.order.length });
  } catch (err) {
    return handleApiError(err);
  }
}
