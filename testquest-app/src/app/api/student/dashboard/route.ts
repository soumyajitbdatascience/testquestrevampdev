import { requireAuth } from "@/lib/auth";
import { handleApiError, success } from "@/lib/api-utils";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const session = await requireAuth("student");
    const studentId = session.id;

    // Recent attempts
    const recent = await prisma.$queryRaw<Array<{
      id: number; testId: number; score: unknown; totalMarks: unknown; percentage: unknown;
      startedAt: Date | null; finishedAt: Date | null; testName: string | null; subjectName: string | null;
    }>>`
      SELECT
        a.id, a.testId, a.score, a.totalMarks, a.percentage,
        a.startedAt, a.finishedAt,
        t.name AS testName,
        s.name AS subjectName
      FROM vw_attempts_legacy a
      LEFT JOIN vw_tests t ON t.id = a.testId
      LEFT JOIN vw_subjects s ON s.id = t.subjectId
      WHERE a.studentId = ${studentId}
      ORDER BY a.startedAt DESC
      LIMIT 10
    `;

    // Totals
    const stats = await prisma.$queryRaw<Array<{
      totalAttempts: bigint; completed: bigint;
      avgPct: number | null; testsAvailable: bigint;
    }>>`
      SELECT
        (SELECT COUNT(*) FROM vw_attempts_legacy WHERE studentId = ${studentId}) AS totalAttempts,
        (SELECT COUNT(*) FROM vw_attempts_legacy WHERE studentId = ${studentId} AND finishedAt IS NOT NULL) AS completed,
        (SELECT ROUND(AVG(percentage), 1) FROM vw_attempts_legacy
           WHERE studentId = ${studentId} AND finishedAt IS NOT NULL AND totalMarks > 0) AS avgPct,
        (SELECT COUNT(*) FROM vw_tests WHERE isActive = TRUE) AS testsAvailable
    `;
    const s = stats[0] || { totalAttempts: BigInt(0), completed: BigInt(0), avgPct: null, testsAvailable: BigInt(0) };

    // Subject breakdown
    const subjects = await prisma.$queryRaw<Array<{
      subjectName: string | null; avgPct: number | null; cnt: bigint;
    }>>`
      SELECT
        s.name AS subjectName,
        ROUND(AVG(a.percentage), 1) AS avgPct,
        COUNT(a.id) AS cnt
      FROM vw_attempts_legacy a
      LEFT JOIN vw_tests t ON t.id = a.testId
      LEFT JOIN vw_subjects s ON s.id = t.subjectId
      WHERE a.studentId = ${studentId}
        AND a.finishedAt IS NOT NULL
        AND a.totalMarks > 0
        AND s.name IS NOT NULL
      GROUP BY s.id, s.name
      ORDER BY avgPct DESC
      LIMIT 10
    `;

    // Score trend = last 10 percentages
    const trendRows = await prisma.$queryRaw<Array<{ percentage: unknown; subjectName: string | null }>>`
      SELECT a.percentage, s.name AS subjectName
      FROM vw_attempts_legacy a
      LEFT JOIN vw_tests t ON t.id = a.testId
      LEFT JOIN vw_subjects s ON s.id = t.subjectId
      WHERE a.studentId = ${studentId} AND a.finishedAt IS NOT NULL AND a.totalMarks > 0
      ORDER BY a.startedAt DESC
      LIMIT 10
    `;

    return success({
      recentAttempts: recent.map(r => ({
        id: Number(r.id),
        status: r.finishedAt ? "LEGACY_COMPLETED" : "IN_PROGRESS",
        score: Number(r.score ?? 0),
        totalMarks: Number(r.totalMarks ?? 0),
        percentage: Number(r.percentage ?? 0),
        startedAt: r.startedAt,
        finishedAt: r.finishedAt,
        test: {
          id: Number(r.testId),
          name: r.testName ?? `Test ${Number(r.testId)}`,
          subject: { name: r.subjectName ?? "" },
        },
      })),
      stats: {
        totalAttempts: Number(s.totalAttempts),
        completedTests: Number(s.completed),
        testsAvailable: Number(s.testsAvailable),
        overallAverage: s.avgPct === null ? null : Number(s.avgPct),
      },
      subjectBreakdown: subjects.map(r => ({
        subject: r.subjectName ?? "Unknown",
        avgPercentage: Number(r.avgPct ?? 0),
        attemptCount: Number(r.cnt),
      })),
      scoreTrend: trendRows.reverse().map(r => ({
        percentage: Number(r.percentage ?? 0),
        subject: r.subjectName ?? "",
      })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
