import { requireAuth } from "@/lib/auth";
import { handleApiError, success, error } from "@/lib/api-utils";
import { getAttempt, remainingSeconds } from "@/lib/attempts";

type Params = { params: Promise<{ id: string }> };

/**
 * The attempt the player renders: the paper as it was pinned at start, in its
 * pinned order, with whatever has been answered so far.
 *
 * The legacy position↔id translation is gone — answers are stored as option
 * ids, which is what the client speaks, so nothing needs converting.
 */
export async function GET(_request: Request, { params }: Params) {
  try {
    const session = await requireAuth("student");
    const { id } = await params;
    const attemptId = Number(id);
    if (!Number.isFinite(attemptId)) return error("Invalid attempt id", 400);

    const loaded = await getAttempt(attemptId, session.id);
    if (!loaded) return error("Attempt not found", 404);
    const { attempt, questions, answeredCount } = loaded;

    return success({
      id: attempt.id,
      status: attempt.status,
      test: {
        id: attempt.test.id,
        name: attempt.test.name,
        durationMinutes: attempt.test.durationMinutes,
        isPractice: attempt.test.isPractice,
      },
      totalMarks: attempt.totalMarks,
      startedAt: attempt.startedAt,
      remainingSeconds: remainingSeconds(
        attempt.startedAt, attempt.test.durationMinutes, attempt.test.isPractice,
      ),
      questions,
      answeredCount,
      flaggedCount: 0,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
