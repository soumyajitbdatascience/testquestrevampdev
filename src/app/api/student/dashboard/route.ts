import { requireAuth } from "@/lib/auth";
import { handleApiError, success } from "@/lib/api-utils";
import { prisma } from "@/lib/db";
import { attemptScopeFor, resolveActiveContext } from "@/lib/student-context";

/**
 * Progress — score trend, per-subject standing, and the chapters worth
 * revisiting, from `tq_attempts` / `tq_attempt_answers`.
 *
 * Every query is scoped to `session.id` and reads only that student's own
 * attempts; nothing here can surface another student's answers or scores.
 *
 * It is scoped a second time, to the active board+class from `tq_ctx`, so a
 * student holding two classes sees the progress of the one they are actually
 * looking at rather than a blend of both.
 *
 * Percentage is **derived**, never stored: `score / totalMarks`, with
 * `totalMarks` snapshotted on the attempt when it started. A test whose marks
 * were edited afterwards therefore still reports the percentage the student
 * actually earned.
 *
 * Cost: four statements, all grouped or limited, none per-row — the shared
 * host enforces a 10-second ceiling and a per-attempt lookup across a growing
 * history would eventually cross it. The weak-chapters scan is the widest and
 * is driven by `idx_attempt_student` → `uq_attempt_question` → two primary-key
 * lookups, so it walks one student's answers rather than the answer table.
 */
export async function GET() {
  try {
    const session = await requireAuth("student");
    const studentId = session.id;

    const ctx = await resolveActiveContext(studentId);
    if (!ctx) {
      return success({
        recentAttempts: [], stats: { totalAttempts: 0, completedTests: 0, testsAvailable: 0, overallAverage: null },
        subjectBreakdown: [], scoreTrend: [], weakChapters: [],
      });
    }
    const scope = attemptScopeFor(ctx);

    const [recent, completed, weakRows, testsAvailable, totalAttempts] = await Promise.all([
      // Recent attempts, for the list and the trend.
      prisma.attempt.findMany({
        where: { studentId, ...scope },
        orderBy: { startedAt: "desc" },
        take: 10,
        select: {
          id: true, testId: true, status: true, score: true, totalMarks: true,
          startedAt: true, finishedAt: true,
          test: {
            select: {
              name: true,
              offering: { select: { subject: { select: { id: true, name: true } } } },
            },
          },
        },
      }),

      // Every completed attempt, for totals and the per-subject breakdown.
      // Bounded in practice by how many tests a student sits; select only what
      // the aggregation needs.
      prisma.attempt.findMany({
        where: { studentId, status: "COMPLETED", ...scope },
        select: {
          testId: true, score: true, totalMarks: true,
          test: { select: { offering: { select: { id: true, subject: { select: { id: true, name: true } } } } } },
        },
      }),

      // Weak chapters: one grouped scan over this student's answers, joined
      // out to the chapter each question belongs to.
      prisma.$queryRaw<Array<{ chapterId: number; chapterName: string; answered: bigint; correct: bigint | null }>>`
        SELECT ch.id   AS chapterId,
               ch.name AS chapterName,
               COUNT(*)            AS answered,
               SUM(aa.isCorrect = 1) AS correct
        FROM tq_attempt_answers aa
        JOIN tq_attempts a  ON a.id = aa.attemptId
                           AND a.studentId = ${studentId}
                           AND a.status = 'COMPLETED'
        JOIN tq_tests t     ON t.id = a.testId
        JOIN tq_offerings o ON o.id = t.offeringId
                           AND o.boardId = ${ctx.boardId}
                           AND o.classId = ${ctx.classId}
        JOIN tq_questions q ON q.id = aa.questionId
        JOIN tq_chapters ch ON ch.id = q.chapterId
        WHERE aa.selectedOptionIds IS NOT NULL
        GROUP BY ch.id, ch.name`,

      prisma.test.count({
        where: { isActive: true, offering: { boardId: ctx.boardId, classId: ctx.classId, isActive: true } },
      }),

      prisma.attempt.count({ where: { studentId, ...scope } }),
    ]);

    const pct = (score: number, total: number) =>
      total > 0 ? Number(((score / total) * 100).toFixed(2)) : 0;

    // Per-subject standing.
    //
    // `offeringId` rides along because /offerings/[id] is keyed by offering,
    // not subject: without it the page had to match a subject by *name*
    // against the home payload, which silently breaks the "Practice" deep link
    // the moment two subjects share a name or one gets renamed.
    const bySubject = new Map<number, { name: string; offeringId: number; sum: number; count: number; tests: Set<number> }>();
    for (const a of completed) {
      const subject = a.test.offering.subject;
      const entry = bySubject.get(subject.id)
        ?? { name: subject.name, offeringId: a.test.offering.id, sum: 0, count: 0, tests: new Set<number>() };
      entry.tests.add(a.testId);
      if (a.totalMarks > 0) {
        entry.sum += pct(a.score, a.totalMarks);
        entry.count++;
      }
      bySubject.set(subject.id, entry);
    }

    const scored = completed.filter((a) => a.totalMarks > 0);
    const overallAverage = scored.length
      ? Number((scored.reduce((n, a) => n + pct(a.score, a.totalMarks), 0) / scored.length).toFixed(1))
      : null;

    // A chapter needs a little evidence before it is called weak — one wrong
    // answer is noise, and telling someone to revise a whole chapter on that
    // basis is worse than saying nothing.
    const weakChapters = weakRows
      .map((r) => ({
        chapterId: Number(r.chapterId),
        chapter: r.chapterName,
        answered: Number(r.answered),
        correct: Number(r.correct ?? 0),
        accuracy: Number(r.answered) > 0
          ? Math.round((Number(r.correct ?? 0) / Number(r.answered)) * 100)
          : 0,
      }))
      .filter((c) => c.answered >= 5 && c.accuracy < 70)
      .sort((a, b) => a.accuracy - b.accuracy)
      .slice(0, 5);

    return success({
      recentAttempts: recent.map((r) => ({
        id: r.id,
        status: r.status,
        score: r.score,
        totalMarks: r.totalMarks,
        percentage: pct(r.score, r.totalMarks),
        startedAt: r.startedAt,
        finishedAt: r.finishedAt,
        test: {
          id: r.testId,
          name: r.test.name,
          subject: { name: r.test.offering.subject.name },
        },
      })),
      stats: {
        totalAttempts,
        completedTests: new Set(completed.map((a) => a.testId)).size,
        testsAvailable,
        overallAverage,
      },
      subjectBreakdown: [...bySubject.entries()]
        .map(([id, s]) => ({
          subjectId: id,
          offeringId: s.offeringId,
          subject: s.name,
          avgPercentage: s.count > 0 ? Number((s.sum / s.count).toFixed(1)) : 0,
          attemptCount: s.count,
          testsCompleted: s.tests.size,
        }))
        .sort((a, b) => b.avgPercentage - a.avgPercentage)
        .slice(0, 10),
      // Oldest → newest, so the chart reads left to right.
      scoreTrend: recent
        .filter((r) => r.status === "COMPLETED" && r.totalMarks > 0)
        .reverse()
        .map((r) => ({
          percentage: pct(r.score, r.totalMarks),
          subject: r.test.offering.subject.name,
          testName: r.test.name,
          finishedAt: r.finishedAt,
        })),
      weakChapters,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
