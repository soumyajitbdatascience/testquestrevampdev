/**
 * Rolls back what migrate-01/02b/04/05 inserted into tq_* tables.
 * - DELETE rows (never DROP tables)
 * - Touches ONLY tq_* tables — legacy tables stay 100% intact
 * - Preserves: tq_admins, tq_settings, the schema additions (legacyId columns, enum extensions)
 *
 * After this runs, tq_classes / tq_subjects / tq_questions / tq_question_options
 * are empty, ready for the views-based architecture.
 */
import "dotenv/config";
import { PrismaClient } from "../../src/generated/prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== Rolling back partial content migration ===");
  console.log("(DELETE only — no DROP statements, legacy tables untouched)\n");

  // FK-safe order
  const optsCount = await prisma.questionOption.count();
  await prisma.questionOption.deleteMany();
  console.log(`✔ tq_question_options: deleted ${optsCount.toLocaleString()}`);

  const tqCount = await prisma.testQuestion.count();
  await prisma.testQuestion.deleteMany();
  console.log(`✔ tq_test_questions: deleted ${tqCount.toLocaleString()}`);

  const ansCount = await prisma.attemptAnswer.count();
  await prisma.attemptAnswer.deleteMany();
  console.log(`✔ tq_attempt_answers: deleted ${ansCount.toLocaleString()}`);

  const atCount = await prisma.attempt.count();
  await prisma.attempt.deleteMany();
  console.log(`✔ tq_attempts: deleted ${atCount.toLocaleString()}`);

  const accCount = await prisma.studentAccess.count();
  await prisma.studentAccess.deleteMany();
  console.log(`✔ tq_student_access: deleted ${accCount.toLocaleString()}`);

  const qCount = await prisma.question.count();
  await prisma.question.deleteMany();
  console.log(`✔ tq_questions: deleted ${qCount.toLocaleString()}`);

  const testCount = await prisma.test.count();
  await prisma.test.deleteMany();
  console.log(`✔ tq_tests: deleted ${testCount.toLocaleString()}`);

  const chapCount = await prisma.chapter.count();
  await prisma.chapter.deleteMany();
  console.log(`✔ tq_chapters: deleted ${chapCount.toLocaleString()}`);

  const subjCount = await prisma.subject.count();
  await prisma.subject.deleteMany();
  console.log(`✔ tq_subjects: deleted ${subjCount.toLocaleString()}`);

  const studCount = await prisma.student.count();
  await prisma.student.deleteMany();
  console.log(`✔ tq_students: deleted ${studCount.toLocaleString()}`);

  const clsCount = await prisma.class.count();
  await prisma.class.deleteMany();
  console.log(`✔ tq_classes: deleted ${clsCount.toLocaleString()}`);

  // Keep admins, settings, bundles, coupons (no entries anyway but safe)
  const admins = await prisma.admin.count();
  console.log(`\nAdmins preserved: ${admins}`);

  // Spot check: legacy tables still intact
  const legacy = await prisma.$queryRaw<Array<{ cnt: bigint }>>`
    SELECT COUNT(*) as cnt FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME NOT LIKE 'tq\\_%'
  `;
  console.log(`Legacy tables intact: ${Number(legacy[0].cnt)}`);

  const qLegacy = await prisma.$queryRaw<Array<{ cnt: bigint }>>`SELECT COUNT(*) as cnt FROM question`;
  console.log(`Legacy question count: ${Number(qLegacy[0].cnt).toLocaleString()}`);

  console.log("\n✓ Rollback complete. tq_* content tables are empty, schema changes preserved.");
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
