import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError, parseBody, success, error } from "@/lib/api-utils";
import { startAttempt, findActiveAttempt, getAttempt } from "@/lib/attempts";
import { resolveTestAccess } from "@/lib/access";

const startSchema = z.object({
  testId: z.number().int().positive(),
});

/**
 * Starts (or resumes) an attempt.
 *
 * Test ids are plain `tq_tests.id` now — the +1,000,000 practice offset was a
 * legacy device for telling `main_exam` and `practice_exam` apart, and one
 * table with an `isPractice` flag has no such ambiguity.
 */
export async function POST(request: Request) {
  try {
    const session = await requireAuth("student");
    const { testId } = await parseBody(request, startSchema);

    const test = await prisma.test.findFirst({
      where: { id: testId, isActive: true },
      select: { id: true, name: true, durationMinutes: true, isPractice: true },
    });
    if (!test) return error("Test not found", 404);

    // Resume first: an in-flight attempt is returned as-is, with the paper in
    // the order it was pinned.
    const active = await findActiveAttempt(session.id, testId);
    if (active) {
      const loaded = await getAttempt(active.id, session.id);
      return success({
        attemptId: active.id,
        testName: test.name,
        durationMinutes: test.durationMinutes,
        isPractice: test.isPractice,
        totalMarks: active.totalMarks,
        questionIds: loaded?.questions.map((q) => q.id) ?? [],
        startedAt: active.startedAt,
        resumed: true,
      }, 200);
    }

    // POLICY: the resume check above intentionally precedes this access check —
    // in-flight attempts survive access expiry (a student mid-test never gets
    // locked out). Access itself resolves through the single helper, which
    // fails closed: free sample → active class pass → locked.
    const { access } = await resolveTestAccess(session.id, testId);
    if (!access) {
      return error("You don't have access to this test", 403);
    }

    const attempt = await startAttempt(session.id, testId);

    return success({
      attemptId: attempt.attemptId,
      testName: attempt.testName,
      durationMinutes: attempt.durationMinutes,
      isPractice: attempt.isPractice,
      totalMarks: attempt.totalMarks,
      questionIds: attempt.questionIds,
      startedAt: attempt.startedAt,
    }, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
