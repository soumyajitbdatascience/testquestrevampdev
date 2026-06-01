import { requireAuth } from "@/lib/auth";
import { handleApiError, success, error } from "@/lib/api-utils";
import { getAttemptStatus, pauseAttempt } from "@/lib/legacy-attempts";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  try {
    const session = await requireAuth("student");
    const { id } = await params;
    const attemptId = Number(id);

    const status = await getAttemptStatus(attemptId);
    if (!status || status.studentId !== session.id) return error("Attempt not found", 404);
    if (status.status === 2) return error("Already submitted", 400);

    await pauseAttempt(attemptId);
    return success({ paused: true });
  } catch (err) {
    return handleApiError(err);
  }
}
