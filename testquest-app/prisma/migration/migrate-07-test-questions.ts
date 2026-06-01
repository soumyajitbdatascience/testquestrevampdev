/**
 * Migrate `main_exam_to_question` + `practice_exam_to_question` → tq_test_questions.
 * Also enriches per-question marks on tq_questions from the exam-question Marks.
 * Updates tq_tests.totalMarks at the end.
 */
import "dotenv/config";
import { PrismaClient } from "../../src/generated/prisma/client";

const prisma = new PrismaClient();
const BATCH_SIZE = 1000;

interface LegacyEtQ {
  exam_id: number;
  question_id: number;
  Marks: number | null;
}

async function main() {
  console.log("=== migrate-07-test-questions ===");

  // legacy_id maps
  const tests = await prisma.test.findMany({ where: { legacyId: { not: null } }, select: { id: true, legacyId: true, isPractice: true } });
  const mainTestMap = new Map<number, number>();
  const practiceTestMap = new Map<number, number>();
  for (const t of tests) {
    if (t.legacyId === null) continue;
    if (t.isPractice) practiceTestMap.set(t.legacyId - 1_000_000, t.id);
    else mainTestMap.set(t.legacyId, t.id);
  }

  const questions = await prisma.question.findMany({ where: { legacyId: { not: null } }, select: { id: true, legacyId: true } });
  const qMap = new Map<number, number>();
  for (const q of questions) if (q.legacyId !== null) qMap.set(q.legacyId, q.id);

  console.log(`Loaded ${mainTestMap.size} main tests + ${practiceTestMap.size} practice tests, ${qMap.size} questions`);

  let totalInserted = 0;

  for (const [table, map] of [
    ["main_exam_to_question", mainTestMap] as const,
    ["practice_exam_to_question", practiceTestMap] as const,
  ]) {
    console.log(`\n  → ${table}`);
    const rows = await prisma.$queryRawUnsafe<LegacyEtQ[]>(`
      SELECT exam_id, question_id, Marks
      FROM \`${table}\`
      ORDER BY main_exam_to_question_id
    `);
    console.log(`    Found ${rows.length} legacy rows`);

    // Existing pairs to avoid duplicates
    const existing = await prisma.testQuestion.findMany({ select: { testId: true, questionId: true } });
    const existingPairs = new Set(existing.map(e => `${e.testId}|${e.questionId}`));

    let toInsert: Parameters<typeof prisma.testQuestion.createMany>[0]["data"] = [];
    let sortByTest = new Map<number, number>(); // testId → next sortOrder
    let inserted = 0, skipped = 0;

    for (const r of rows) {
      const newTestId = map.get(r.exam_id);
      const newQuestionId = qMap.get(r.question_id);
      if (!newTestId || !newQuestionId) { skipped++; continue; }

      const pairKey = `${newTestId}|${newQuestionId}`;
      if (existingPairs.has(pairKey)) { skipped++; continue; }
      existingPairs.add(pairKey);

      const sortOrder = (sortByTest.get(newTestId) || 0) + 1;
      sortByTest.set(newTestId, sortOrder);

      toInsert.push({ testId: newTestId, questionId: newQuestionId, sortOrder });

      if (toInsert.length >= BATCH_SIZE) {
        await prisma.testQuestion.createMany({ data: toInsert, skipDuplicates: true });
        inserted += toInsert.length;
        process.stdout.write(`    inserted ${inserted}…\r`);
        toInsert = [];
      }
    }
    if (toInsert.length > 0) {
      await prisma.testQuestion.createMany({ data: toInsert, skipDuplicates: true });
      inserted += toInsert.length;
    }
    console.log(`\n    inserted=${inserted}, skipped=${skipped}`);
    totalInserted += inserted;
  }

  // Recompute totalMarks on tests
  console.log("\n  → recomputing tq_tests.totalMarks");
  await prisma.$executeRaw`
    UPDATE tq_tests t
    SET totalMarks = COALESCE((
      SELECT SUM(q.marks)
      FROM tq_test_questions tq
      JOIN tq_questions q ON q.id = tq.questionId
      WHERE tq.testId = t.id
    ), 0)
    WHERE t.isLegacy = true
  `;
  console.log("    ✔ done");

  console.log(`\n✔ total inserted = ${totalInserted}`);
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
