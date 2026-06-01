import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { handleApiError, parseBody, success, error } from "@/lib/api-utils";
import { getTest, getTestQuestions } from "@/lib/legacy-content";
import { startAttempt, findActiveAttemptForStudent } from "@/lib/legacy-attempts";
import { prisma } from "@/lib/db";

const startSchema = z.object({
  testId: z.number().int().positive(),
  // Optional: when a student starts a test as part of an assignment, we record
  // the link in tq_assignment_attempts so the owner can see who has started /
  // completed which assignment without scanning legacy tables.
  assignmentId: z.number().int().positive().optional(),
});

export async function POST(request: Request) {
  try {
    const session = await requireAuth("student");
    const { testId, assignmentId } = await parseBody(request, startSchema);

    const test = await getTest(testId);
    if (!test || !test.isActive) return error("Test not found", 404);

    // If an assignmentId was supplied, sanity-check it: must belong to the
    // student's org, target this test, and the student must be enrolled in
    // the batch. Failures degrade silently — we still let the attempt go
    // through, just without the assignment-link.
    let validAssignmentId: number | null = null;
    if (assignmentId && session.orgId) {
      const a = await prisma.assignment.findUnique({
        where: { id: assignmentId },
        select: { id: true, orgId: true, batchId: true, testId: true, isActive: true },
      });
      if (a && a.isActive && a.orgId === session.orgId && a.testId === testId) {
        const enrolled = await prisma.batchEnrollment.findUnique({
          where: { batchId_studentId: { batchId: a.batchId, studentId: session.id } },
        });
        if (enrolled && enrolled.isActive) validAssignmentId = a.id;
      }
    }

    // If student has an existing in-progress attempt for this test, resume it
    const active = await findActiveAttemptForStudent(session.id, testId);
    if (active) {
      if (validAssignmentId) {
        await prisma.assignmentAttempt.upsert({
          where: { attemptToken: active.token },
          create: { assignmentId: validAssignmentId, studentId: session.id, attemptToken: active.token },
          update: {},
        });
      }
      return success({
        attemptId: active.attemptId,
        testName: test.name,
        durationMinutes: test.durationMinutes,
        isPractice: test.isPractice,
        totalMarks: active.totalMarks,
        resumed: true,
      }, 200);
    }

    // (Access check is handled in /api/tests/[id] before student gets here.
    //  Free tests are open to all. Paid tests require tq_student_access.)
    if (!test.isFree) {
      const access = await prisma.studentAccess.findUnique({
        where: { studentId_testId: { studentId: session.id, testId } },
      });
      if (!access || (access.expiresAt && access.expiresAt < new Date())) {
        return error("You don't have access to this test", 403);
      }
    }

    const questions = await getTestQuestions(testId);
    if (questions.length === 0) return error("This test has no questions yet", 400);

    const attempt = await startAttempt(session.id, testId);

    if (validAssignmentId) {
      await prisma.assignmentAttempt.upsert({
        where: { attemptToken: attempt.token },
        create: { assignmentId: validAssignmentId, studentId: session.id, attemptToken: attempt.token },
        update: {},
      });
    }

    return success({
      attemptId: attempt.attemptId,
      testName: test.name,
      durationMinutes: test.durationMinutes,
      isPractice: test.isPractice,
      totalMarks: attempt.totalMarks,
      questionIds: questions.map(q => q.id),
      startedAt: attempt.startedAt,
      assignmentId: validAssignmentId,
    }, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
