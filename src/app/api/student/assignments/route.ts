/**
 * GET /api/student/assignments
 *
 * Lists assignments visible to the calling student — i.e. assignments on any
 * active batch they're enrolled in. Used by the "Assigned to me" section on
 * /tests for org-member students.
 *
 * Returns active assignments first (no completed mapping), then completed.
 * For Phase 1 we cap at 25 — the dashboard banner only needs the recent few.
 */
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError, success } from "@/lib/api-utils";

export async function GET() {
  try {
    const session = await requireAuth("student");

    // Find every active batch this student is enrolled in.
    const enrollments = await prisma.batchEnrollment.findMany({
      where: { studentId: session.id, isActive: true },
      select: { batchId: true },
    });
    const batchIds = enrollments.map((e) => e.batchId);
    if (batchIds.length === 0) return success({ assignments: [] });

    const assignments = await prisma.assignment.findMany({
      where: { batchId: { in: batchIds }, isActive: true },
      orderBy: { createdAt: "desc" },
      take: 25,
      include: {
        batch: { select: { id: true, name: true } },
        org:   { select: { id: true, name: true } },
        attempts: {
          where: { studentId: session.id },
          orderBy: { startedAt: "desc" },
          take: 1,
          select: { attemptToken: true, completedAt: true },
        },
      },
    });
    if (assignments.length === 0) return success({ assignments: [] });

    // Pull test names from vw_tests in one shot.
    const testIds = Array.from(new Set(assignments.map((a) => a.testId)));
    const tests = await prisma.$queryRawUnsafe<Array<{ id: number; name: string }>>(
      `SELECT id, name FROM vw_tests WHERE id IN (${testIds.map(() => "?").join(",")})`,
      ...testIds,
    );
    const testNameById = new Map(tests.map((t) => [Number(t.id), t.name]));

    const rows = assignments.map((a) => {
      const mine = a.attempts[0];
      const status = mine?.completedAt
        ? "completed"
        : mine
          ? "in_progress"
          : "not_started";
      return {
        id: a.id,
        title: a.title ?? testNameById.get(a.testId) ?? "Untitled",
        testId: a.testId,
        testName: testNameById.get(a.testId) ?? null,
        instructions: a.instructions,
        dueAt: a.dueAt,
        createdAt: a.createdAt,
        org: a.org,
        batch: a.batch,
        status,
        completedAt: mine?.completedAt ?? null,
      };
    });

    // Active (not completed) first, then completed.
    rows.sort((x, y) => {
      if (x.status === "completed" && y.status !== "completed") return 1;
      if (x.status !== "completed" && y.status === "completed") return -1;
      return +new Date(y.createdAt) - +new Date(x.createdAt);
    });

    return success({ assignments: rows });
  } catch (err) {
    return handleApiError(err);
  }
}
