/** Verify migration counts + run spot-checks. */
import "dotenv/config";
import { PrismaClient } from "../../src/generated/prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== migrate-10-verify ===\n");

  const counts = {
    classes:        await prisma.class.count(),
    subjects:       await prisma.subject.count(),
    questions:      await prisma.question.count({ where: { isLegacy: true } }),
    options:        await prisma.questionOption.count(),
    tests:          await prisma.test.count({ where: { isLegacy: true } }),
    testQuestions:  await prisma.testQuestion.count(),
    students:       await prisma.student.count({ where: { legacyId: { not: null } } }),
    attempts:       await prisma.attempt.count({ where: { isLegacy: true } }),
    answers:        await prisma.attemptAnswer.count(),
  };
  console.log("New table counts (legacy-tagged where applicable):");
  for (const [k, v] of Object.entries(counts)) {
    console.log(`  ${k.padEnd(15)} ${v.toLocaleString()}`);
  }

  console.log("\n--- Spot check: question types distribution ---");
  const typeDist = await prisma.question.groupBy({
    by: ["type"],
    where: { isLegacy: true },
    _count: true,
    orderBy: { _count: { id: "desc" } },
  });
  for (const t of typeDist) console.log(`  ${t.type.padEnd(15)} ${t._count.toLocaleString()}`);

  console.log("\n--- Spot check: 3 random questions with options ---");
  const sample = await prisma.question.findMany({
    where: { isLegacy: true, type: { in: ["SINGLE_MCQ", "MULTI_MCQ"] } },
    include: { options: true, subject: true },
    take: 3,
    orderBy: { id: "asc" },
  });
  for (const q of sample) {
    console.log(`\n  [#${q.id}] ${q.subject.name} · ${q.type}`);
    console.log(`    Q: ${q.text.slice(0, 100)}`);
    for (const o of q.options) console.log(`    ${o.label}. ${o.text.slice(0, 60)}${o.isCorrect ? " ✓" : ""}`);
  }

  console.log("\n--- Spot check: 3 fill-in-blank questions ---");
  const fills = await prisma.question.findMany({
    where: { isLegacy: true, type: "FILL_IN_BLANK" },
    take: 3,
  });
  for (const q of fills) {
    console.log(`  [#${q.id}] ${q.text.slice(0, 80)}`);
    console.log(`    Answer: ${q.correctText}`);
  }

  console.log("\n--- Spot check: 5 students ---");
  const students = await prisma.student.findMany({
    where: { isLegacy: false, legacyId: { not: null } },
    take: 5,
    select: { id: true, name: true, email: true, classId: true, _count: { select: { attempts: true } } },
  });
  for (const s of students) {
    console.log(`  [#${s.id}] ${s.name} (${s.email}) · class=${s.classId ?? "—"} · attempts=${s._count.attempts}`);
  }

  console.log("\n--- Tests with questions ---");
  const testsWithQs = await prisma.test.findMany({
    where: { isLegacy: true },
    take: 5,
    select: { id: true, name: true, totalMarks: true, _count: { select: { questions: true, attempts: true } } },
    orderBy: { id: "asc" },
  });
  for (const t of testsWithQs) {
    console.log(`  [#${t.id}] ${t.name.slice(0, 60)} · ${t._count.questions} Qs · ${t.totalMarks} marks · ${t._count.attempts} attempts`);
  }

  console.log("\n--- Health checks ---");
  const orphanQs = await prisma.question.count({
    where: { isLegacy: true, options: { none: {} }, type: { in: ["SINGLE_MCQ", "MULTI_MCQ"] } },
  });
  console.log(`  MCQ questions with NO options: ${orphanQs.toLocaleString()} ${orphanQs > 0 ? "⚠" : "✓"}`);

  const noCorrect = await prisma.question.count({
    where: { isLegacy: true, type: { in: ["SINGLE_MCQ", "MULTI_MCQ"] }, options: { every: { isCorrect: false } } },
  });
  console.log(`  MCQ questions with NO correct option: ${noCorrect.toLocaleString()} ${noCorrect > 0 ? "⚠" : "✓"}`);

  const testsNoQs = await prisma.test.count({ where: { isLegacy: true, questions: { none: {} } } });
  console.log(`  Tests with NO questions: ${testsNoQs.toLocaleString()} ${testsNoQs > 0 ? "⚠" : "✓"}`);

  console.log("\nDone.");
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
