/**
 * Drop FKs on `testId` columns that reference the empty `tq_tests` table.
 *
 * Real tests live in legacy `main_exam` / `practice_exam` (exposed via vw_tests).
 * Commerce writes (`tq_orders.testId`, `tq_student_access.testId`) need to
 * point at those legacy IDs, so the hard FK to `tq_tests` blocks every
 * test-type purchase. We treat these columns as soft references to vw_tests
 * and validate at the application layer.
 *
 * Idempotent: only drops constraints that still exist.
 */
import "dotenv/config";
import { PrismaClient } from "../../src/generated/prisma/client";

const prisma = new PrismaClient();

const TARGETS: Array<{ table: string; fk: string }> = [
  { table: "tq_orders", fk: "tq_orders_testId_fkey" },
  { table: "tq_student_access", fk: "tq_student_access_testId_fkey" },
  // studentId in commerce tables references the empty tq_students table;
  // real students live in legacy `student` (vw_students). Drop these too.
  { table: "tq_orders", fk: "tq_orders_studentId_fkey" },
  { table: "tq_student_access", fk: "tq_student_access_studentId_fkey" },
  { table: "tq_coupon_usages", fk: "tq_coupon_usages_studentId_fkey" },
];

async function main() {
  for (const { table, fk } of TARGETS) {
    const rows = await prisma.$queryRawUnsafe<Array<{ n: bigint }>>(`
      SELECT COUNT(*) AS n
      FROM information_schema.TABLE_CONSTRAINTS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = '${table}'
        AND CONSTRAINT_NAME = '${fk}'
        AND CONSTRAINT_TYPE = 'FOREIGN KEY'
    `);
    if (Number(rows[0]?.n ?? 0) === 0) {
      console.log(`${fk}: already dropped, skipping.`);
      continue;
    }
    await prisma.$executeRawUnsafe(`ALTER TABLE \`${table}\` DROP FOREIGN KEY \`${fk}\``);
    console.log(`Dropped ${fk}.`);
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
