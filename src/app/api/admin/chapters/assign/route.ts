import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError, parseBody, success, error } from "@/lib/api-utils";
import { findOfferingId } from "@/lib/offerings";

/**
 * Bulk move (design 2b): move testIds into a chapter within its context —
 * within one board+class+subject a test lives in exactly ONE chapter
 * (enforced here in app code), while cross-board tagging stays additive.
 * `chapterId: null` untags the tests from the context instead (the undo path).
 */
const assignSchema = z.object({
  boardId: z.number().int().positive(),
  classId: z.number().int().positive(),
  subjectId: z.number().int().positive(),
  testIds: z.array(z.number().int().positive()).min(1).max(500),
  chapterId: z.number().int().positive().nullable(),
});

export async function POST(request: Request) {
  try {
    await requireAuth("admin");
    const body = await parseBody(request, assignSchema);

    // Chapters of this context — the scope within which the move is exclusive
    const offeringId = await findOfferingId(body.boardId, body.classId, body.subjectId);
    const ctxChapters = offeringId
      ? await prisma.chapter.findMany({ where: { offeringId }, select: { id: true } })
      : [];
    const ctxChapterIds = ctxChapters.map((c) => c.id);

    if (body.chapterId != null && !ctxChapterIds.includes(body.chapterId)) {
      return error("Chapter does not belong to this context", 400);
    }

    // Remove any existing tagging of these tests within the context
    if (ctxChapterIds.length > 0) {
      await prisma.chapterTest.deleteMany({
        where: { chapterId: { in: ctxChapterIds }, testId: { in: body.testIds } },
      });
    }

    if (body.chapterId != null) {
      const last = await prisma.chapterTest.findFirst({
        where: { chapterId: body.chapterId },
        orderBy: { sortOrder: "desc" },
      });
      let sort = (last?.sortOrder ?? 0);
      await prisma.chapterTest.createMany({
        data: body.testIds.map((testId) => ({ chapterId: body.chapterId!, testId, sortOrder: ++sort })),
        skipDuplicates: true,
      });
    }

    return success({ moved: body.testIds.length, chapterId: body.chapterId });
  } catch (err) {
    return handleApiError(err);
  }
}
