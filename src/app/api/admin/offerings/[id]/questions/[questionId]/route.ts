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
    // `type` and `correctText` come along for the shape check below: a PATCH
    // may omit either, and the rule that applies depends on what the question
    // will be *after* the patch, not on what this request happens to carry.
    select: { id: true, type: true, correctText: true },
  });
}

/**
 * The importer's four rules, enforced on edit as well as on create.
 *
 * `createSchema` expresses these as Zod refinements, but this route's schema is
 * partial — `type` can be absent while `options` is present — so the same rules
 * cannot be written as field refinements here. They are applied against the
 * *merged* question instead: incoming values where sent, stored values where
 * not. Without this the route accepted a single-answer question with two
 * correct options, which the importer would have rejected outright.
 *
 * Returns a message when the merged question is invalid, or null when it is fine.
 */
function shapeError(
  merged: {
    type: "SINGLE_MCQ" | "MULTI_MCQ" | "FILL_IN_BLANK";
    correctText: string | null;
    options?: Array<{ isCorrect: boolean }>;
  },
): string | null {
  if (merged.type === "FILL_IN_BLANK") {
    return merged.correctText && merged.correctText.trim()
      ? null
      : "An accepted answer is required for fill-in-the-blank";
  }

  // For MCQ the option set is only checked when this request replaces it —
  // a scalar-only patch (a typo fix in the text) must not have to resend it.
  if (merged.options === undefined) return null;

  if (merged.options.length < 2) return "MCQ questions need at least 2 options";
  const correct = merged.options.filter((o) => o.isCorrect).length;
  if (merged.type === "SINGLE_MCQ" && correct !== 1) {
    return "A single-answer MCQ needs exactly 1 correct option";
  }
  if (merged.type === "MULTI_MCQ" && correct < 2) {
    return "A multi-answer MCQ needs at least 2 correct options";
  }
  return null;
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

    const invalid = shapeError({
      type: body.type ?? question.type as "SINGLE_MCQ" | "MULTI_MCQ" | "FILL_IN_BLANK",
      correctText: body.correctText !== undefined ? body.correctText : question.correctText,
      options,
    });
    if (invalid) return error(invalid, 422);

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
