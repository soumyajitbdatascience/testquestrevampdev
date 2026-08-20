import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError, parseBody, success, error } from "@/lib/api-utils";

type Params = { params: Promise<{ id: string; questionId: string }> };

const optionSchema = z.object({
  label: z.string().min(1).max(10),
  text: z.string().min(1),
  isCorrect: z.boolean(),
});

const updateSchema = z.object({
  chapterId: z.number().int().positive().nullable().optional(),
  type: z.enum(["SINGLE_MCQ", "MULTI_MCQ", "FILL_IN_BLANK"]).optional(),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).optional(),
  text: z.string().min(1).optional(),
  explanation: z.string().nullable().optional(),
  correctText: z.string().nullable().optional(),
  marks: z.number().int().positive().optional(),
  /** When present, replaces the option set wholesale. */
  options: z.array(optionSchema).optional(),
});

/** Loads the question and proves it belongs to this offering's subject. */
async function ownedQuestion(offeringId: number, questionId: number) {
  if (!Number.isFinite(offeringId) || !Number.isFinite(questionId)) return null;
  const offering = await prisma.offering.findUnique({
    where: { id: offeringId },
    select: { subjectId: true },
  });
  if (!offering) return null;
  return prisma.question.findFirst({
    where: { id: questionId, subjectId: offering.subjectId },
    select: { id: true },
  });
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    await requireAuth("admin");
    const { id, questionId } = await params;
    const offeringId = Number(id);
    const question = await ownedQuestion(offeringId, Number(questionId));
    if (!question) return error("Question not found in this offering", 404);

    const body = await parseBody(request, updateSchema);

    if (body.chapterId != null) {
      const chapter = await prisma.chapter.findFirst({
        where: { id: body.chapterId, offeringId },
        select: { id: true },
      });
      if (!chapter) return error("That chapter is not in this offering", 400);
    }

    const { options, ...scalars } = body;

    const updated = await prisma.$transaction(async (tx) => {
      if (options) {
        // Replace the set rather than diffing: option identity carries no
        // meaning of its own, and attempt answers reference option ids only
        // for attempts already taken (which keep their own rows).
        await tx.questionOption.deleteMany({ where: { questionId: question.id } });
        await tx.questionOption.createMany({
          data: options.map((o, i) => ({
            questionId: question.id, label: o.label, text: o.text,
            isCorrect: o.isCorrect, sortOrder: i + 1,
          })),
        });
      }
      return tx.question.update({ where: { id: question.id }, data: scalars, select: { id: true } });
    });

    return success(updated);
  } catch (err) {
    return handleApiError(err);
  }
}

/**
 * Archive, not delete — a question already used by a test must keep its row so
 * past attempts still resolve. Refuses while any test still contains it.
 */
export async function DELETE(_request: Request, { params }: Params) {
  try {
    await requireAuth("admin");
    const { id, questionId } = await params;
    const question = await ownedQuestion(Number(id), Number(questionId));
    if (!question) return error("Question not found in this offering", 404);

    const usedIn = await prisma.testQuestion.count({ where: { questionId: question.id } });
    if (usedIn > 0) {
      return error(`This question is used by ${usedIn} test(s). Remove it from them first.`, 409);
    }

    await prisma.question.update({ where: { id: question.id }, data: { isActive: false } });
    return success({ archived: true });
  } catch (err) {
    return handleApiError(err);
  }
}
