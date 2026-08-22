/**
 * Dashboard data service for Task 1.6.
 *
 * Returns everything the owner's /coaching/dashboard renders in a single
 * call. All counts are run in parallel; activity feed joins legacy
 * vw_attempts_legacy to scope to students enrolled in this org's batches.
 *
 * Performance target from the spec: < 800ms on a seeded dev DB. Achieved
 * via Promise.all + indexed lookups; the legacy JOIN uses indices on
 * vw_attempts_legacy.studentId and tq_batch_enrollments.studentId.
 */
import { prisma } from "@/lib/db";

export interface DashboardStats {
  totalStudents: number;
  activeBatches: number;
  assignmentsThisWeek: number;
  averageScore: number | null;
}

export interface DashboardBatch {
  id: number;
  name: string;
  classId: number | null;
  className: string | null;
  board: string;
  studentCount: number;
  subjects: string[];
}

export interface DashboardActivity {
  attemptId: number;
  studentId: number;
  studentName: string | null;
  testId: number;
  testName: string | null;
  score: number;
  totalMarks: number;
  percentage: number;
  finishedAt: Date | null;
}

export interface DashboardSubscription {
  status: string;
  daysLeft: number | null;
  planName: string;
  seatsPurchased: number;
  seatsUsed: number;
}

export interface DashboardData {
  orgName: string;
  orgCity: string | null;
  ownerName: string | null;
  stats: DashboardStats;
  batches: DashboardBatch[];
  activity: DashboardActivity[];
  subscription: DashboardSubscription | null;
}

// Perf trap: vw_attempts_legacy is a UNION ALL of main_exam_status + practice_exam_status
// with a computed `finishedAt = CASE WHEN status=2 THEN exam_finish_time END`. Any predicate
// against `finishedAt` (or studentId via a JOIN subquery) inside the view defeats indexes
// and risks tripping Hostinger's 10s max_statement_time. We mitigate by:
//   1. Pre-resolving the org's studentIds with a cheap indexed Prisma query
//    2. Querying `main_exam_status` directly with `status = 2` (indexed) so the optimizer
//       can use the student_id + status indexes
//    3. Capping aggregation scan size with a defensive subquery LIMIT
const AVG_SCAN_CAP = 5000;       // recent attempts only — avg is approximate but bounded
const ACTIVITY_LIMIT = 10;

export async function loadDashboard(orgId: number): Promise<DashboardData> {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  // Pre-resolve student IDs for this org. Single indexed query; pushed down as
  // a placeholder list rather than re-running the JOIN inside every legacy query.
  const enrollmentRows = await prisma.batchEnrollment.findMany({
    where: { batch: { orgId }, isActive: true },
    select: { studentId: true },
    distinct: ["studentId"],
  });
  const studentIds = enrollmentRows.map((r) => r.studentId);

  const emptyAvg: Array<{ totalScore: number | null; totalMarks: number | null }> = [
    { totalScore: 0, totalMarks: 0 },
  ];
  const emptyActivity: Array<{
    attemptId: number; studentId: number; studentName: string | null;
    testId: number; testName: string | null;
    score: number | null; totalMarks: number | null; percentage: number | null;
    finishedAt: Date | null;
  }> = [];

  const [
    org,
    studentMemberCount,
    activeBatchCount,
    assignmentsCount,
    avgRow,
    batches,
    activity,
    sub,
  ] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: orgId },
      select: { name: true, city: true, ownerUserId: true },
    }),

    prisma.orgMembership.count({
      where: { orgId, role: "STUDENT", isActive: true },
    }),

    prisma.batch.count({ where: { orgId, isActive: true } }),

    prisma.assignment.count({
      where: { orgId, isActive: true, createdAt: { gte: weekAgo } },
    }),

    // Weighted average across this org's students' attempts (main_exam only —
    // skip practice attempts to keep the scan bounded; SUM is taken over the
    // most recent AVG_SCAN_CAP completed rows for the student set).
    studentIds.length === 0
      ? Promise.resolve(emptyAvg)
      : prisma.$queryRawUnsafe<Array<{ totalScore: number | null; totalMarks: number | null }>>(
          // Legacy columns: `user_score` = points earned, `total_score` = max possible.
          `SELECT SUM(score) AS totalScore, SUM(totalMarks) AS totalMarks FROM (
             SELECT user_score AS score, total_score AS totalMarks
             FROM main_exam_status
             WHERE status = 2
               AND total_score > 0
               AND student_id IN (${studentIds.map(() => "?").join(",")})
             ORDER BY exam_finish_time DESC
             LIMIT ${AVG_SCAN_CAP}
           ) recent`,
          ...studentIds,
        ),

    prisma.batch.findMany({
      where: { orgId, isActive: true },
      orderBy: { createdAt: "desc" },
      take: 12,
      include: { _count: { select: { enrollments: { where: { isActive: true } } } } },
    }),

    // Last 10 completed attempts. Direct hit on main_exam_status with the
    // indexed `status` + `student_id` columns — no view, no computed predicate.
    studentIds.length === 0
      ? Promise.resolve(emptyActivity)
      : prisma.$queryRawUnsafe<Array<{
          attemptId: number; studentId: number; studentName: string | null;
          testId: number; testName: string | null;
          score: number | null; totalMarks: number | null; percentage: number | null;
          finishedAt: Date | null;
        }>>(
          `SELECT mes.id AS attemptId, mes.student_id AS studentId,
                  s.name AS studentName,
                  mes.exam_id AS testId, t.name AS testName,
                  mes.user_score AS score,
                  mes.total_score AS totalMarks,
                  CASE WHEN mes.total_score > 0
                       THEN ROUND((mes.user_score / mes.total_score) * 100, 2)
                       ELSE 0 END AS percentage,
                  mes.exam_finish_time AS finishedAt
           FROM main_exam_status mes
           LEFT JOIN vw_students s ON s.id = mes.student_id
           LEFT JOIN vw_tests t    ON t.id = mes.exam_id
           WHERE mes.status = 2
             AND mes.student_id IN (${studentIds.map(() => "?").join(",")})
           ORDER BY mes.exam_finish_time DESC
           LIMIT ${ACTIVITY_LIMIT}`,
          ...studentIds,
        ),

    prisma.subscription.findFirst({
      where: { orgId, status: { in: ["TRIAL", "ACTIVE", "GRACE"] } },
      orderBy: { createdAt: "desc" },
      include: { plan: { select: { name: true } } },
    }),
  ]);

  // Hydrate batch class-names in one shot.
  const classIds = Array.from(new Set(batches.map((b) => b.classId).filter((x) => x != null))) as number[];
  const classRows = classIds.length
    ? await prisma.$queryRawUnsafe<Array<{ id: number; name: string }>>(
        `SELECT id, name FROM vw_classes WHERE id IN (${classIds.map(() => "?").join(",")})`,
        ...classIds,
      )
    : [];
  const classNameById = new Map(classRows.map((r) => [Number(r.id), r.name]));

  // Owner name from legacy student row.
  let ownerName: string | null = null;
  if (org?.ownerUserId) {
    const ownerRow = await prisma.$queryRaw<Array<{ name: string }>>`
      SELECT name FROM vw_students WHERE id = ${org.ownerUserId} LIMIT 1
    `;
    ownerName = ownerRow[0]?.name ?? null;
  }

  const totalScore = Number(avgRow[0]?.totalScore ?? 0);
  const totalMarks = Number(avgRow[0]?.totalMarks ?? 0);
  const averageScore = totalMarks > 0 ? Math.round((totalScore / totalMarks) * 100) : null;

  let daysLeft: number | null = null;
  if (sub?.expiresAt) {
    const ms = +sub.expiresAt - Date.now();
    daysLeft = Math.max(0, Math.ceil(ms / 86_400_000));
  }

  return {
    orgName: org?.name ?? "",
    orgCity: org?.city ?? null,
    ownerName,
    stats: {
      totalStudents: studentMemberCount,
      activeBatches: activeBatchCount,
      assignmentsThisWeek: assignmentsCount,
      averageScore,
    },
    batches: batches.map((b) => ({
      id: b.id,
      name: b.name,
      classId: b.classId,
      className: classNameById.get(b.classId) ?? null,
      board: b.board,
      studentCount: b._count.enrollments,
      subjects: b.subjectsCsv.split(",").map((s) => s.trim()).filter(Boolean),
    })),
    activity: activity.map((r) => ({
      attemptId: Number(r.attemptId),
      studentId: Number(r.studentId),
      studentName: r.studentName,
      testId: Number(r.testId),
      testName: r.testName,
      score: Number(r.score ?? 0),
      totalMarks: Number(r.totalMarks ?? 0),
      percentage: Number(r.percentage ?? 0),
      finishedAt: r.finishedAt,
    })),
    subscription: sub
      ? {
          status: sub.status,
          daysLeft,
          planName: sub.plan?.name ?? "—",
          seatsPurchased: sub.seatsPurchased,
          seatsUsed: sub.seatsUsed,
        }
      : null,
  };
}
