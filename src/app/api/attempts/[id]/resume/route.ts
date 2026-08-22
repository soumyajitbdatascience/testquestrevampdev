import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError, success, error } from "@/lib/api-utils";
import { resumeAttempt, remainingSeconds } from "@/lib/attempts";

type Params = { params: Promise<{ id: string }> };

/**
 * Restarts the clock where it stopped. Resume never checks access: an attempt
 * already in flight survives an expiring pass by deliberate policy.
 */
export async function POST(_request: Request, { params }: Params) {
  try {
    const session = await requireAuth("student");
    const { id } = await params;
    const attemptId = Number(id);
    if (!Number.isFinite(attemptId)) return error("Invalid attempt id", 400);

    const attempt = await prisma.attempt.findFirst({
      where: { id: attemptId, studentId: session.id },
      select: { status: true, timeSpentSeconds: true, test: { select: { durationMinutes: true, isPractice: true } } },
    });
    if (!attempt) return error("Attempt not found", 404);
    if (attempt.status === "COMPLETED") return error("Already submitted", 400);

    await resumeAttempt(attemptId);

    const restarted = await prisma.attempt.findUnique({
      where: { id: attemptId },
      select: { startedAt: true, timeSpentSeconds: true },
    });

    return success({
      resumed: true,
      remainingSeconds: restarted
        ? remainingSeconds(restarted.startedAt, attempt.test.durationMinutes, attempt.test.isPractice)
        : null,
      timeSpentSeconds: restarted?.timeSpentSeconds ?? attempt.timeSpentSeconds,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
