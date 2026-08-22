import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError, success, error } from "@/lib/api-utils";
import { pauseAttempt } from "@/lib/attempts";

type Params = { params: Promise<{ id: string }> };

/** Banks the elapsed time so a pause doesn't burn the student's clock. */
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

    await pauseAttempt(attemptId);
    return success({ paused: true });
  } catch (err) {
    return handleApiError(err);
  }
}
