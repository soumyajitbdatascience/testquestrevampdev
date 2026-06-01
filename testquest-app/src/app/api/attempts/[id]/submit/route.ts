import { requireAuth } from "@/lib/auth";
import { handleApiError, success, error } from "@/lib/api-utils";
import { getAttemptStatus, submitAttempt } from "@/lib/legacy-attempts";
import { prisma } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  try {
    const session = await requireAuth("student");
    const { id } = await params;
    const attemptId = Number(id);

    const status = await getAttemptStatus(attemptId);
    if (!status || status.studentId !== session.id) return error("Attempt not found", 404);
    if (status.status === 2) return error("Already submitted", 400);

    await submitAttempt(attemptId);

    const final = await getAttemptStatus(attemptId);
    if (!final) return error("Submit failed", 500);

    // If this attempt is linked to an assignment, mark the mapping row done.
    if (final.token) {
      await prisma.assignmentAttempt.updateMany({
        where: { attemptToken: final.token, completedAt: null },
        data: { completedAt: final.finishedAt ?? new Date() },
      });
    }

    const percentage = final.totalMarks > 0
      ? Number(((final.userScore / final.totalMarks) * 100).toFixed(2))
      : 0;

    return success({
      submitted: true,
      status: "COMPLETED",
      score: final.userScore,
      totalMarks: final.totalMarks,
      percentage,
      timeSpentSeconds: final.timeSpentSeconds,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
