import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { handleApiError, success, error } from "@/lib/api-utils";
import { resolveTestAccess } from "@/lib/access";

type Params = { params: Promise<{ id: string }> };

/**
 * Test detail — the pre-start screen.
 *
 * Ids are plain `tq_tests.id`; the +1,000,000 practice offset is gone with the
 * legacy tables it disambiguated.
 *
 * `randomizeQuestions` is now *true in fact*: `startAttempt` shuffles the paper
 * per attempt. `randomizeOptions` is honestly **false** — 189 questions have
 * options that refer to each other ("both A and B", "all of the above"), so
 * shuffling them would corrupt the question. Neither flag has a column; they
 * describe what the engine actually does.
 */
export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const testId = Number(id);
    if (!Number.isFinite(testId)) return error("Invalid test id", 400);

    const session = await getSession();
    const studentId = session?.role === "student" ? session.id : null;

    const test = await prisma.test.findFirst({
      where: { id: testId, isActive: true },
      select: {
        id: true, name: true, description: true, durationMinutes: true,
        totalMarks: true, isPractice: true,
        _count: { select: { questions: true } },
        offering: {
          select: {
            id: true,
            subject: { select: { id: true, name: true } },
            class: { select: { id: true, name: true } },
            board: { select: { id: true, name: true, code: true } },
          },
        },
        freeTests: { select: { id: true } },
      },
    });
    if (!test) return error("Test not found", 404);

    const { access: hasAccess, reason: accessReason } = await resolveTestAccess(studentId, testId);

    let attemptCount = 0;
    let lastAttempt: {
      id: number; status: string; score: number; percentage: number;
      startedAt: Date; finishedAt: Date | null;
    } | null = null;

    if (studentId) {
      const attempts = await prisma.attempt.findMany({
        where: { studentId, testId },
        orderBy: { startedAt: "desc" },
        take: 10,
        select: {
          id: true, status: true, score: true, totalMarks: true,
          startedAt: true, finishedAt: true,
        },
      });
      attemptCount = attempts.length;
      const a = attempts[0];
      if (a) {
        lastAttempt = {
          id: a.id,
          status: a.status,
          score: a.score,
          percentage: a.totalMarks > 0 ? Number(((a.score / a.totalMarks) * 100).toFixed(2)) : 0,
          startedAt: a.startedAt,
          finishedAt: a.finishedAt,
        };
      }
    }

    return success({
      id: test.id,
      name: test.name,
      description: test.description,
      durationMinutes: test.durationMinutes,
      totalMarks: test.totalMarks,
      isPractice: test.isPractice,
      isFreeSample: test.freeTests.length > 0,
      randomizeQuestions: true,
      randomizeOptions: false,
      retakeCooldownDays: 0,
      questionCount: test._count.questions,
      offeringId: test.offering.id,
      board: test.offering.board,
      class: test.offering.class,
      subject: test.offering.subject,
      hasAccess,
      accessReason,
      attemptCount,
      lastAttempt,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
