import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { handleApiError, parseBody, success, error } from "@/lib/api-utils";
import { getAttemptStatus, saveAnswer, decodeTestId } from "@/lib/legacy-attempts";
import { prisma } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

const answerSchema = z.object({
  questionId: z.number().int().positive(),
  // For SINGLE_MCQ — option id chosen
  selectedOptionId: z.number().int().positive().nullable().optional(),
  // For MULTI_MCQ — list of option ids
  selectedOptionIds: z.array(z.number().int().positive()).optional(),
  // For FILL_IN_BLANK
  fillAnswer: z.string().nullable().optional(),
  // Reserved (legacy doesn't store this; frontend keeps it local)
  isFlagged: z.boolean().optional(),
});

/**
 * Resolve a list of option IDs back to 1-based positions by looking them up
 * in vw_question_options for this question.
 */
async function optionIdsToPositions(questionId: number, ids: number[]): Promise<number[]> {
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => "?").join(",");
  const rows = await prisma.$queryRawUnsafe<Array<{ id: number; sortOrder: number }>>(
    `SELECT id, sortOrder FROM vw_question_options
     WHERE questionId = ? AND id IN (${placeholders})`,
    questionId, ...ids
  );
  return rows.map(r => Number(r.sortOrder)).filter(n => Number.isFinite(n));
}

export async function POST(request: Request, { params }: Params) {
  try {
    const session = await requireAuth("student");
    const { id } = await params;
    const attemptId = Number(id);
    if (!Number.isFinite(attemptId)) return error("Invalid attempt id", 400);

    const status = await getAttemptStatus(attemptId);
    if (!status || status.studentId !== session.id) return error("Attempt not found", 404);
    if (status.status === 2) return error("This attempt has been submitted", 400);

    const body = await parseBody(request, answerSchema);

    // Resolve to 1-based positions
    let positions: number[] = [];
    if (body.selectedOptionIds && body.selectedOptionIds.length > 0) {
      positions = await optionIdsToPositions(body.questionId, body.selectedOptionIds);
    } else if (body.selectedOptionId) {
      positions = await optionIdsToPositions(body.questionId, [body.selectedOptionId]);
    } else if (body.fillAnswer && body.fillAnswer.trim()) {
      // For FILL_IN_BLANK, store the user's text directly (legacy doesn't have
      // a dedicated column — we put the trimmed answer into user_answer).
      // This won't match the position-based correct_answer, so grading will
      // treat it as wrong. A follow-up improvement: store fillAnswer raw and
      // grade against q.correctText. For MVP, count attempt only.
      positions = [];
    }

    // Get exam db id for the underlying table reference
    const { kind, dbId: examDbId } = decodeTestId(status.testId);

    await saveAnswer({
      kind,
      examDbId,
      studentId: session.id,
      questionId: body.questionId,
      positions,
      token: status.token,
      attemptDbId: status.dbId,
    });

    return success({ saved: true });
  } catch (err) {
    return handleApiError(err);
  }
}
