/**
 * Migrate `main_exam_status` + `practice_exam_status` → tq_attempts (with isLegacy=true).
 * Then migrate `main_exam_result` + `practice_exam_result` → tq_attempt_answers.
 *
 * Attempt grouping key is the legacy `token`.
 */
import "dotenv/config";
import { PrismaClient } from "../../src/generated/prisma/client";

const prisma = new PrismaClient();

interface LegacyStatus {
  id: number;
  exam_id: number;
  student_id: number;
  user_score: string | number | null;
  total_score: string | number | null;
  total_question: number | null;
  correct_answer: number | null;
  wrong_answer: number | null;
  exam_start_time: Date | null;
  exam_finish_time_by_children: Date | null;
  token: string | null;
}

interface LegacyResult {
  exam_result_id: number;
  exam_id: number;
  student_id: number;
  question_id: number;
  user_answer: string | null;
  correct_answer: string | null;
  result: number | null;
  Marks: number | string | null;
  token: string | null;
}

async function main() {
  console.log("=== migrate-09-attempts ===");

  // Maps
  const tests = await prisma.test.findMany({ where: { legacyId: { not: null } }, select: { id: true, legacyId: true, isPractice: true } });
  const mainTestMap = new Map<number, number>();
  const practiceTestMap = new Map<number, number>();
  for (const t of tests) {
    if (t.legacyId === null) continue;
    if (t.isPractice) practiceTestMap.set(t.legacyId - 1_000_000, t.id);
    else mainTestMap.set(t.legacyId, t.id);
  }

  const students = await prisma.student.findMany({ where: { legacyId: { not: null } }, select: { id: true, legacyId: true } });
  const studentMap = new Map<number, number>();
  for (const s of students) if (s.legacyId !== null) studentMap.set(s.legacyId, s.id);

  const qs = await prisma.question.findMany({ where: { legacyId: { not: null } }, select: { id: true, legacyId: true } });
  const qMap = new Map<number, number>();
  for (const q of qs) if (q.legacyId !== null) qMap.set(q.legacyId, q.id);

  console.log(`Maps: tests-main=${mainTestMap.size}, tests-practice=${practiceTestMap.size}, students=${studentMap.size}, questions=${qMap.size}`);

  // Track legacy_token → new attempt id for answer migration
  const tokenToAttempt = new Map<string, number>();

  for (const [statusTable, testMap, isPractice] of [
    ["main_exam_status", mainTestMap, false] as const,
    ["practice_exam_status", practiceTestMap, true] as const,
  ]) {
    console.log(`\n  → attempts from ${statusTable}`);
    const rows = await prisma.$queryRawUnsafe<LegacyStatus[]>(`
      SELECT
        id, exam_id, student_id,
        user_score, total_score, total_question,
        correct_answer, wrong_answer,
        exam_start_time, exam_finish_time_by_children,
        token
      FROM \`${statusTable}\`
      ORDER BY id
    `);
    console.log(`    Found ${rows.length} attempt summaries`);

    let inserted = 0, skipped = 0;
    for (const r of rows) {
      const testId = testMap.get(r.exam_id);
      const studentId = studentMap.get(r.student_id);
      if (!testId || !studentId) { skipped++; continue; }

      const score = Number(r.user_score || 0);
      const totalMarks = Number(r.total_score || 0);
      const percentage = totalMarks > 0 ? Number(((score / totalMarks) * 100).toFixed(2)) : 0;

      const started = r.exam_start_time || new Date();
      const finished = r.exam_finish_time_by_children;
      const timeSec = finished && r.exam_start_time
        ? Math.max(0, Math.round((+finished - +r.exam_start_time) / 1000))
        : 0;

      const legacyKey = `${isPractice ? "practice" : "main"}:${r.id}`;

      try {
        const attempt = await prisma.attempt.upsert({
          where: { legacyKey },
          create: {
            legacyKey,
            studentId,
            testId,
            status: "LEGACY_COMPLETED",
            isPractice,
            isLegacy: true,
            questionOrder: "[]",
            score: Math.round(score),
            totalMarks: Math.round(totalMarks),
            percentage,
            timeSpentSeconds: timeSec,
            startedAt: started,
            finishedAt: finished,
          },
          update: {},
        });
        if (r.token) tokenToAttempt.set(`${isPractice ? "p" : "m"}:${r.token}`, attempt.id);
        inserted++;
        if (inserted % 50 === 0) process.stdout.write(`    inserted ${inserted}…\r`);
      } catch {
        skipped++;
      }
    }
    console.log(`\n    inserted=${inserted}, skipped=${skipped}`);
  }

  // Answers
  for (const [resultTable, isPractice] of [
    ["main_exam_result", false] as const,
    ["practice_exam_result", true] as const,
  ]) {
    console.log(`\n  → answers from ${resultTable}`);
    const rows = await prisma.$queryRawUnsafe<LegacyResult[]>(`
      SELECT
        exam_result_id, exam_id, student_id, question_id,
        user_answer, correct_answer, result, Marks, token
      FROM \`${resultTable}\`
      ORDER BY exam_result_id
    `);
    console.log(`    Found ${rows.length} answer rows`);

    const BATCH = 1000;
    let toInsert: Parameters<typeof prisma.attemptAnswer.createMany>[0]["data"] = [];
    let inserted = 0, skipped = 0;

    for (const r of rows) {
      if (!r.token) { skipped++; continue; }
      const attemptId = tokenToAttempt.get(`${isPractice ? "p" : "m"}:${r.token}`);
      const questionId = qMap.get(r.question_id);
      if (!attemptId || !questionId) { skipped++; continue; }

      const isCorrect = r.result === 1;
      const marksAwarded = isCorrect ? Number(r.Marks || 0) : 0;
      const userAnswer = (r.user_answer || "").trim();

      toInsert.push({
        attemptId,
        questionId,
        selectedOptionId: null, // can't reliably map position → new option id
        fillAnswer: userAnswer || null,
        isCorrect,
        marksAwarded: Math.round(marksAwarded),
      });

      if (toInsert.length >= BATCH) {
        await prisma.attemptAnswer.createMany({ data: toInsert, skipDuplicates: true });
        inserted += toInsert.length;
        process.stdout.write(`    inserted ${inserted}…\r`);
        toInsert = [];
      }
    }
    if (toInsert.length > 0) {
      await prisma.attemptAnswer.createMany({ data: toInsert, skipDuplicates: true });
      inserted += toInsert.length;
    }
    console.log(`\n    inserted=${inserted}, skipped=${skipped}`);
  }
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
