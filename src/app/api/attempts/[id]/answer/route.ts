import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError, parseBody, success, error } from "@/lib/api-utils";
import { saveAnswer } from "@/lib/attempts";

type Params = { params: Promise<{ id: string }> };

/**
 * The client contract is unchanged: option **ids**, single or multiple.
 *
 * What changed is underneath — the legacy engine converted these ids into
 * 1-based positions and stored a CSV (`",,3,,,"`) because the legacy tables had
 * no room for anything else. `tq_attempt_answers.selectedOptionIds` takes a
 * JSON id array directly, so that translation layer is gone.
 */
const answerSchema = z.object({
  questionId: z.number().int().positive(),
  /** SINGLE_MCQ — the one option chosen (null clears it). */
  selectedOptionId: z.number().int().positive().nullable().optional(),
  /** MULTI_MCQ — every option chosen. */
  selectedOptionIds: z.array(z.number().int().positive()).optional(),
  /** FILL_IN_BLANK — no such question exists in the bank yet; accepted, unused. */
  fillAnswer: z.string().nullable().optional(),
  /** Flags live client-side; there is no column for them. */
  isFlagged: z.boolean().optional(),
});

export async function POST(request: Request, { params }: Params) {
  try {
    const session = await requireAuth("student");
    const { id } = await params;
    const attemptId = Number(id);
    if (!Number.isFinite(attemptId)) return error("Invalid attempt id", 400);

    const attempt = await prisma.attempt.findFirst({
      where: { id: attemptId, studentId: session.id },
      select: { id: true, status: true },
    });
    if (!attempt) return error("Attempt not found", 404);
    if (attempt.status === "COMPLETED") return error("This attempt has been submitted", 400);

    const body = await parseBody(request, answerSchema);

    // Either shape collapses to the same list; `selectedOptionIds` wins when
    // both are sent, and an empty list clears the answer.
    const ids = body.selectedOptionIds
      ?? (body.selectedOptionId != null ? [body.selectedOptionId] : []);

    const saved = await saveAnswer({ attemptId, questionId: body.questionId, selectedOptionIds: ids });
    // A question that isn't on this attempt's pinned paper cannot be answered.
    if (!saved) return error("That question isn't part of this attempt", 400);

    return success({ saved: true });
  } catch (err) {
    return handleApiError(err);
  }
}
