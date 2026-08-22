/**
 * GET /api/coaching/assignments/[id]
 *
 * Returns the assignment's full context for the student intro screen.
 * Authorisation: the caller must be either
 *   - any active org member of the assignment's parent org (Owner / Admin /
 *     Teacher view it for management), OR
 *   - a STUDENT actively enrolled in the assignment's batch.
 *
 * Side-channel: also returns the caller's own latest attempt token for this
 * assignment (if any) so the intro page can render "Continue test" vs
 * "Start test".
 */
import { prisma } from "@/lib/db";
import { requireOrgRole } from "@/lib/auth";
import { handleApiError, success, error } from "@/lib/api-utils";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const session = await requireOrgRole(["OWNER", "ADMIN", "TEACHER", "STUDENT", "PARENT"]);
    const { id } = await params;
    const assignmentId = Number(id);
    if (!Number.isFinite(assignmentId)) return error("Bad assignment id", 400);

    const a = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: {
        batch: { select: { id: true, name: true, classId: true } },
        org:   { select: { id: true, name: true, logoUrl: true } },
      },
    });
    if (!a || a.orgId !== session.orgId) return error("Assignment not found", 404);

    // For STUDENT role: confirm enrollment in this batch.
    if (session.orgRole === "STUDENT") {
      const enrolled = await prisma.batchEnrollment.findUnique({
        where: { batchId_studentId: { batchId: a.batchId, studentId: session.id } },
      });
      if (!enrolled || !enrolled.isActive) return error("You're not enrolled in this batch", 403);
    }

    // Test metadata via vw_tests.
    const test = await prisma.$queryRaw<Array<{
      id: number; name: string; durationMinutes: number;
    }>>`
      SELECT id, name, durationMinutes FROM vw_tests WHERE id = ${a.testId} LIMIT 1
    `;
    const totalMarksRow = await prisma.$queryRaw<Array<{ marks: number | null; q: bigint }>>`
      SELECT SUM(marks) AS marks, COUNT(*) AS q FROM vw_test_questions WHERE testId = ${a.testId}
    `;
    const totalMarks = Number(totalMarksRow[0]?.marks ?? 0);
    const questionCount = Number(totalMarksRow[0]?.q ?? 0);

    // Caller's own most-recent attempt for this assignment (if any).
    const myAttempt = await prisma.assignmentAttempt.findFirst({
      where: { assignmentId, studentId: session.id },
      orderBy: { startedAt: "desc" },
    });

    return success({
      id: a.id,
      title: a.title,
      instructions: a.instructions,
      dueAt: a.dueAt,
      createdAt: a.createdAt,
      isActive: a.isActive,
      org: a.org,
      batch: a.batch,
      test: test[0]
        ? {
            id: Number(test[0].id),
            name: test[0].name,
            durationMinutes: Number(test[0].durationMinutes ?? 0),
            totalMarks,
            questionCount,
          }
        : null,
      myAttempt: myAttempt
        ? { token: myAttempt.attemptToken, startedAt: myAttempt.startedAt, completedAt: myAttempt.completedAt }
        : null,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
