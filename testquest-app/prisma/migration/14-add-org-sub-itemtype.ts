/**
 * Phase 1 / Task 1.11 — Add ORG_SUB to OrderItemType enum.
 *
 * Owners pay a one-time Razorpay amount to convert trial → ACTIVE. The order
 * row uses itemType=ORG_SUB and stores the subscription id in `bundleId`
 * (re-used as a generic Int reference — the bundle FK was dropped earlier so
 * there's no FK collision; see prisma/migration/drop-test-fks.ts).
 *
 * MariaDB ALTER for ENUM is `MODIFY COLUMN`. Idempotent guard: short-circuit
 * if the column already lists ORG_SUB.
 */
import "dotenv/config";
import { PrismaClient } from "../../src/generated/prisma/client";
const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.$queryRawUnsafe<Array<{ COLUMN_TYPE: string }>>(
    `SELECT COLUMN_TYPE FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tq_orders' AND COLUMN_NAME = 'itemType'`,
  );
  const cur = rows[0]?.COLUMN_TYPE ?? "";
  if (cur.includes("'ORG_SUB'")) {
    console.log("itemType already includes ORG_SUB, skipping.");
    return;
  }
  await prisma.$executeRawUnsafe(
    `ALTER TABLE \`tq_orders\` MODIFY COLUMN \`itemType\` ENUM('TEST','BUNDLE','ORG_SUB') NOT NULL`,
  );
  console.log("itemType extended with ORG_SUB.");
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
