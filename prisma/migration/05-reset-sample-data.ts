/**
 * Clears all sample/test data from tq_* tables so the legacy migration starts clean.
 * Preserves: tq_admins, tq_settings, tq_coupons, tq_bundles (settings/admin), tq_password_reset_tokens.
 * Wipes: questions, options, tests, test_questions, attempts, answers, students, classes, subjects, chapters.
 */
import "dotenv/config";
import { PrismaClient } from "../../src/generated/prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Wiping sample data from tq_* tables (preserving admins)…");

  // Delete in FK-safe order
  await prisma.attemptAnswer.deleteMany();          console.log("✔ attempt_answers");
  await prisma.attempt.deleteMany();                console.log("✔ attempts");
  await prisma.studentAccess.deleteMany();          console.log("✔ student_access");
  await prisma.couponUsage.deleteMany();            console.log("✔ coupon_usages");
  await prisma.order.deleteMany();                  console.log("✔ orders");
  await prisma.bundleTest.deleteMany();             console.log("✔ bundle_tests");
  await prisma.bundle.deleteMany();                 console.log("✔ bundles");
  await prisma.coupon.deleteMany();                 console.log("✔ coupons");
  await prisma.passwordResetToken.deleteMany();     console.log("✔ password_reset_tokens");
  await prisma.testQuestion.deleteMany();           console.log("✔ test_questions");
  await prisma.test.deleteMany();                   console.log("✔ tests");
  await prisma.questionOption.deleteMany();         console.log("✔ question_options");
  await prisma.question.deleteMany();               console.log("✔ questions");
  await prisma.chapter.deleteMany();                console.log("✔ chapters");
  await prisma.subject.deleteMany();                console.log("✔ subjects");
  await prisma.student.deleteMany();                console.log("✔ students");
  await prisma.class.deleteMany();                  console.log("✔ classes");

  const admins = await prisma.admin.count();
  console.log(`\nDone. Admins preserved: ${admins}.`);
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
