/**
 * GET /api/coaching/assignments/[id]/results
 *
 * Owner / Admin / Teacher monitoring endpoint (UI_PLAN §5.1.7).
 *
 * Returns:
 *   - summary:    enrolledTotal, started, completed, averageScore, dueAt
 *   - students:   one row per enrolled student with status, score, finishTime
 *   - topics:     subject × difficulty buckets with avg %-correct (rolled up
 *                 from main_exam_result via vw_questions)
 *   - questions:  per-question stats — text, correctPct, attemptedPct
 *
 * Reads from legacy tables via raw SQL because that's the source of truth
 * for completions and answers (the mobile app also writes here).
 */
import { prisma } from "@/lib/db";
import { requireOrgRole } from "@/lib/auth";
import { handleApiError, success, error } from "@/lib/api-utils";

type Params = { params: Promise<{ id: string }> };

interface StudentRow {
  studentId: number;
  name: string;
  mobile: string | null;
  status: "not_started" | "in_progress" | "completed";
  score: number | null;
  totalMarks: number | null;
  percentage: number | null;
  startedAt: Date | null;
  completedAt: Date | null;
}

export async function GET(_req: Request, { params }: Params) {
  try {
    const session = await requireOrgRole(["OWNER", "ADMIN", "TEACHER"]);
    const { id } = await params;
    const assignmentId = Number(id);
    if (!Number.isFinite(assignmentId)) return error("Bad id", 400);

    const a = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      select: { id: true, orgId: true, batchId: true, testId: true, title: true, dueAt: true, isActive: true, createdAt: true },
    });
    if (!a || a.orgId !== session.orgId) return error("Assignment not found", 404);

    // Enrolled students in the batch.
    const enrollments = await prisma.batchEnrollment.findMany({
      where: { batchId: a.batchId, isActive: true },
      select: { studentId: true },
    });
    const studentIds = enrollments.map((e) => e.studentId);

    // Mapping rows for this assignment.
    const mappings = await prisma.assignmentAttempt.findMany({
      where: { assignmentId },
      select: { studentId: true, attemptToken: true, startedAt: true, completedAt: true },
    });
    const mapByStudent = new Map(mappings.map((m) => [m.studentId, m]));

    // Hydrate legacy attempt rows for tokens, plus score from main_exam_status.
    const tokens = mappings.map((m) => m.attemptToken);
    const legacyRows = tokens.length
      ? await prisma.$queryRawUnsafe<Array<{
          token: string; status: number; user_score: number | null; total_score: number | null;
          exam_finish_time_by_children: Date | null;
        }>>(
          `SELECT token, status, user_score, total_score, exam_finish_time_by_children
           FROM main_exam_status WHERE token IN (${tokens.map(() => "?").join(",")})
           UNION ALL
           SELECT token, status, user_score, total_score, exam_finish_time_by_children
           FROM practice_exam_status WHERE token IN (${tokens.map(() => "?").join(",")})`,
          ...tokens, ...tokens,
        )
      : [];
    const legacyByToken = new Map(legacyRows.map((r) => [r.token, r]));

    // Student metadata in one shot.
    const studentMeta = studentIds.length
      ? await prisma.$queryRawUnsafe<Array<{ id: number; name: string; mobile: string | null }>>(
          `SELECT id, name, mobile FROM vw_students WHERE id IN (${studentIds.map(() => "?").join(",")})`,
          ...studentIds,
        )
      : [];
    const metaById = new Map(studentMeta.map((s) => [Number(s.id), s]));

    const students: StudentRow[] = studentIds.map((sid) => {
      const meta = metaById.get(sid);
      const m = mapByStudent.get(sid);
      let status: StudentRow["status"] = "not_started";
      let score: number | null = null;
      let totalMarks: number | null = null;
      let percentage: number | null = null;
      let startedAt: Date | null = null;
      let completedAt: Date | null = null;
      if (m) {
        startedAt = m.startedAt;
        const l = legacyByToken.get(m.attemptToken);
        if (m.completedAt || (l && l.status === 2)) {
          status = "completed";
          completedAt = m.completedAt ?? l?.exam_finish_time_by_children ?? null;
          score = Number(l?.user_score ?? 0);
          totalMarks = Number(l?.total_score ?? 0);
          percentage = totalMarks > 0 ? Math.round((score / totalMarks) * 100) : null;
        } else {
          status = "in_progress";
        }
      }
      return {
        studentId: sid,
        name: meta?.name ?? "Unknown",
        mobile: meta?.mobile ?? null,
        status, score, totalMarks, percentage, startedAt, completedAt,
      };
    });

    const completedStudents = students.filter((s) => s.status === "completed");
    const startedStudents = students.filter((s) => s.status !== "not_started");

    const avgRow = await (async () => {
      if (completedStudents.length === 0) return { totalScore: 0, totalMarks: 0 };
      const totalScore = completedStudents.reduce((acc, s) => acc + (s.score ?? 0), 0);
      const totalMarks = completedStudents.reduce((acc, s) => acc + (s.totalMarks ?? 0), 0);
      return { totalScore, totalMarks };
    })();
    const averageScore = avgRow.totalMarks > 0 ? Math.round((avgRow.totalScore / avgRow.totalMarks) * 100) : null;

    // Per-question + topic insights (only meaningful once at least one attempt completed).
    let questions: Array<{
      questionId: number;
      text: string | null;
      subjectId: number | null;
      difficulty: string | null;
      attemptedCount: number;
      correctCount: number;
      attemptedPct: number;
      correctPct: number;
    }> = [];
    let topics: Array<{
      subjectId: number | null;
      subjectName: string | null;
      difficulty: string | null;
      questionCount: number;
      correctPct: number;
    }> = [];

    const completedMappings = mappings.filter((m) => {
      const l = legacyByToken.get(m.attemptToken);
      return m.completedAt || (l && l.status === 2);
    });
    if (completedMappings.length > 0) {
      // legacy main_exam_result is keyed by status row id; we need the status ids for our tokens.
      const completedTokens = completedMappings.map((m) => m.attemptToken);
      const statusIdRows = await prisma.$queryRawUnsafe<Array<{ id: number; token: string; source: string }>>(
        `SELECT id, token, 'main' AS source FROM main_exam_status WHERE token IN (${completedTokens.map(() => "?").join(",")})
         UNION ALL
         SELECT id, token, 'practice' AS source FROM practice_exam_status WHERE token IN (${completedTokens.map(() => "?").join(",")})`,
        ...completedTokens, ...completedTokens,
      );
      const mainStatusIds = statusIdRows.filter((r) => r.source === "main").map((r) => r.id);
      const pracStatusIds = statusIdRows.filter((r) => r.source === "practice").map((r) => r.id);

      // Per-question correctness counts. result = 1 (correct), 2 (wrong), 0 (unanswered).
      const qStats = await prisma.$queryRawUnsafe<Array<{
        questionId: number; attempted: bigint; correct: bigint;
      }>>(
        // We UNION the main and practice result tables, then aggregate.
        `SELECT question_id AS questionId,
                SUM(CASE WHEN result IN (1, 2) THEN 1 ELSE 0 END) AS attempted,
                SUM(CASE WHEN result = 1 THEN 1 ELSE 0 END) AS correct
         FROM (
           ${mainStatusIds.length ? `SELECT question_id, result FROM main_exam_result WHERE main_exam_status_id IN (${mainStatusIds.map(() => "?").join(",")})` : ""}
           ${mainStatusIds.length && pracStatusIds.length ? "UNION ALL" : ""}
           ${pracStatusIds.length ? `SELECT question_id, result FROM practice_exam_result WHERE practice_exam_status_id IN (${pracStatusIds.map(() => "?").join(",")})` : ""}
         ) r
         GROUP BY question_id`,
        ...mainStatusIds, ...pracStatusIds,
      );

      const questionIds = qStats.map((r) => Number(r.questionId));
      const qMeta = questionIds.length
        ? await prisma.$queryRawUnsafe<Array<{
            id: number; subjectId: number | null; subjectName: string | null;
            difficulty: string | null; text: string | null;
          }>>(
            `SELECT q.id, q.subjectId, s.name AS subjectName, q.difficulty, q.text
             FROM vw_questions q
             LEFT JOIN vw_subjects s ON s.id = q.subjectId
             WHERE q.id IN (${questionIds.map(() => "?").join(",")})`,
            ...questionIds,
          )
        : [];
      const metaByQ = new Map(qMeta.map((m) => [Number(m.id), m]));

      const completedCount = completedStudents.length;
      questions = qStats.map((r) => {
        const m = metaByQ.get(Number(r.questionId));
        const attempted = Number(r.attempted);
        const correct = Number(r.correct);
        return {
          questionId: Number(r.questionId),
          text: m?.text ? stripHtml(m.text).slice(0, 240) : null,
          subjectId: m?.subjectId ?? null,
          difficulty: m?.difficulty ?? null,
          attemptedCount: attempted,
          correctCount: correct,
          attemptedPct: completedCount > 0 ? Math.round((attempted / completedCount) * 100) : 0,
          correctPct: attempted > 0 ? Math.round((correct / attempted) * 100) : 0,
        };
      });

      // Roll up to subject × difficulty buckets.
      const buckets = new Map<string, {
        subjectId: number | null; subjectName: string | null; difficulty: string | null;
        attempted: number; correct: number; qCount: number;
      }>();
      for (const q of questions) {
        const m = metaByQ.get(q.questionId);
        const key = `${m?.subjectId ?? "x"}-${m?.difficulty ?? "MEDIUM"}`;
        const cur = buckets.get(key) ?? {
          subjectId: m?.subjectId ?? null,
          subjectName: m?.subjectName ?? null,
          difficulty: m?.difficulty ?? "MEDIUM",
          attempted: 0, correct: 0, qCount: 0,
        };
        cur.attempted += q.attemptedCount;
        cur.correct += q.correctCount;
        cur.qCount += 1;
        buckets.set(key, cur);
      }
      topics = Array.from(buckets.values())
        .map((b) => ({
          subjectId: b.subjectId,
          subjectName: b.subjectName,
          difficulty: b.difficulty,
          questionCount: b.qCount,
          correctPct: b.attempted > 0 ? Math.round((b.correct / b.attempted) * 100) : 0,
        }))
        .sort((x, y) => x.correctPct - y.correctPct); // weakest first
    }

    return success({
      assignment: {
        id: a.id,
        title: a.title,
        batchId: a.batchId,
        dueAt: a.dueAt,
        createdAt: a.createdAt,
      },
      summary: {
        enrolledTotal: studentIds.length,
        startedCount: startedStudents.length,
        completedCount: completedStudents.length,
        averageScore,
        sufficientForInsights: completedStudents.length >= 1,
      },
      students,
      topics,
      questions,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
