/**
 * Drop the FK `tq_bundle_tests.testId -> tq_tests.id`.
 *
 * Tests live in legacy `main_exam`/`practice_exam` (exposed via vw_tests), not
 * in the empty `tq_tests` Prisma-managed table. With the FK in place, no
 * bundle can ever reference a real test. We treat `testId` as a soft reference
 * to `vw_tests.id` and validate at the application layer.
 *
 * Idempotent: only drops if the constraint still exists.
 */
import "dotenv/config";
import { PrismaClient } from "../../src/generated/prisma/client";

const prisma = new PrismaClient();

async function main() {
  const FK = "tq_bundle_tests_testId_fkey";
  const rows = await prisma.$queryRawUnsafe<Array<{ n: bigint }>>(`
    SELECT COUNT(*) AS n
    FROM information_schema.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'tq_bundle_tests'
      AND CONSTRAINT_NAME = '${FK}'
      AND CONSTRAINT_TYPE = 'FOREIGN KEY'
  `);
  if (Number(rows[0]?.n ?? 0) === 0) {
    console.log("FK already dropped, nothing to do.");
    return;
  }
  await prisma.$executeRawUnsafe(`ALTER TABLE tq_bundle_tests DROP FOREIGN KEY \`${FK}\``);
  console.log(`Dropped FK ${FK}.`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
