import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError, parseBody, success, error } from "@/lib/api-utils";

type Params = { params: Promise<{ id: string }> };

/**
 * Bulk chapter tagging — the workhorse of the Questions tab.
 *
 * Select rows, pick a chapter, done. `chapterId: null` untags instead, which
 * is also the undo path for a mis-tag.
 *
 * Both ends are validated against this offering: the chapter must belong to
 * it, and the questions must belong to its subject. Without that check a
 * mis-scoped call could pull another board's questions onto this shelf.
 */
const assignSchema = z.object({
  questionIds: z.array(z.number().int().positive()).min(1).max(1000),
  chapterId: z.number().int().positive().nullable(),
});

export async function POST(request: Request, { params }: Params) {
  try {
    await requireAuth("admin");
    const { id } = await params;
    const offeringId = Number(id);

    const offering = await prisma.offering.findUnique({
      where: { id: offeringId },
      select: { id: true, subjectId: true },
    });
    if (!offering) return error("Offering not found", 404);

    const body = await parseBody(request, assignSchema);

    if (body.chapterId != null) {
      const chapter = await prisma.chapter.findFirst({
        where: { id: body.chapterId, offeringId, isActive: true },
        select: { id: true },
      });
      if (!chapter) return error("That chapter is not in this offering", 400);
    }

    // Only touch questions that actually belong to this offering's subject.
    const eligible = await prisma.question.findMany({
      where: { id: { in: body.questionIds }, subjectId: offering.subjectId, isActive: true },
      select: { id: true },
    });
    const eligibleIds = eligible.map((q) => q.id);
    const rejected = body.questionIds.length - eligibleIds.length;

    if (eligibleIds.length === 0) {
      return error("None of those questions belong to this offering's subject", 400);
    }

    const result = await prisma.question.updateMany({
      where: { id: { in: eligibleIds } },
      data: { chapterId: body.chapterId },
    });

    return success({
      updated: result.count,
      skipped: rejected,
      chapterId: body.chapterId,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
