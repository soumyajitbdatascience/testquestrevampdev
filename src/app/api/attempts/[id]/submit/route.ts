import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError, success, error } from "@/lib/api-utils";
import { submitAttempt } from "@/lib/attempts";

type Params = { params: Promise<{ id: string }> };

/**
 * Submits and scores in one step. Scoring walks the attempt's pinned rows, so
 * the result always reflects the paper the student actually sat.
 */
export async function POST(_request: Request, { params }: Params) {
  try {
    const session = await requireAuth("student");
    const { id } = await params;
    const attemptId = Number(id);
    if (!Number.isFinite(attemptId)) return error("Invalid attempt id", 400);

    const attempt = await prisma.attempt.findFirst({
      where: { id: attemptId, studentId: session.id },
      select: { status: true },
    });
    if (!attempt) return error("Attempt not found", 404);
    if (attempt.status === "COMPLETED") return error("Already submitted", 400);

    const result = await submitAttempt(attemptId);
    const final = await prisma.attempt.findUnique({
      where: { id: attemptId },
      select: { timeSpentSeconds: true },
    });

    return success({
      submitted: true,
      status: "COMPLETED",
      score: result.score,
      totalMarks: result.totalMarks,
      percentage: result.percentage,
      correctCount: result.correctCount,
      wrongCount: result.wrongCount,
      unansweredCount: result.unansweredCount,
      timeSpentSeconds: final?.timeSpentSeconds ?? 0,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
