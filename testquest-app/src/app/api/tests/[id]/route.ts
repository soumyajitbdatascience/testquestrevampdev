import { getSession } from "@/lib/auth";
import { handleApiError, success, error } from "@/lib/api-utils";
import { getTest } from "@/lib/legacy-content";
import { prisma } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const testId = Number(id);
    if (!Number.isFinite(testId)) return error("Invalid test id", 400);

    const test = await getTest(testId);
    if (!test || !test.isActive) return error("Test not found", 404);

    const session = await getSession();
    const studentId = session?.role === "student" ? session.id : null;

    // Phase 2 / Task 2.2 — org-privacy guard. If this test is private to
    // some org, only members of that org may load its detail. Public
    // visitors and members of other orgs get a 404 (same shape as inactive).
    const orgMapping = await prisma.orgTest.findFirst({
      where: { legacyTestId: testId, isActive: true },
      select: { orgId: true },
    });
    if (orgMapping && session?.orgId !== orgMapping.orgId) {
      return error("Test not found", 404);
    }

    let hasAccess = test.isFree;
    let attemptCount = 0;
    let lastAttempt: { id: number; status: string; score: number; percentage: number; startedAt: Date | null; finishedAt: Date | null } | null = null;

    if (studentId) {
      const access = await prisma.studentAccess.findUnique({
        where: { studentId_testId: { studentId, testId } },
      });
      if (access) hasAccess = !access.expiresAt || access.expiresAt > new Date();

      const attempts = await prisma.$queryRaw<Array<{
        id: number; score: unknown; percentage: unknown;
        startedAt: Date | null; finishedAt: Date | null;
      }>>`
        SELECT id, score, percentage, startedAt, finishedAt
        FROM vw_attempts_legacy
        WHERE studentId = ${studentId} AND testId = ${testId}
        ORDER BY finishedAt DESC
        LIMIT 10
      `;
      attemptCount = attempts.length;
      if (attempts[0]) {
        lastAttempt = {
          id: attempts[0].id,
          status: "LEGACY_COMPLETED",
          score: Number(attempts[0].score ?? 0),
          percentage: Number(attempts[0].percentage ?? 0),
          startedAt: attempts[0].startedAt,
          finishedAt: attempts[0].finishedAt,
        };
      }
    }

    return success({
      id: test.id,
      name: test.name,
      description: test.description,
      durationMinutes: test.durationMinutes,
      totalMarks: test.totalMarks,
      isFree: test.isFree,
      price: test.price,
      isPractice: test.isPractice,
      randomizeQuestions: true,
      randomizeOptions: true,
      retakeCooldownDays: test.retakeCooldownDays,
      questionCount: test.questionCount,
      class: test.classId ? { id: test.classId, name: test.className || `Class ${test.classId}` } : null,
      subject: test.subjectId ? { id: test.subjectId, name: test.subjectName || `Subject ${test.subjectId}` } : null,
      hasAccess,
      attemptCount,
      lastAttempt,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
