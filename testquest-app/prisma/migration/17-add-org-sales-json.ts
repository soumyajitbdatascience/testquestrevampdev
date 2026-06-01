/**
 * Phase 2 / Task 2.5 — Add Testquest-staff CRM column to tq_organizations.
 *
 * We deliberately keep this OUT of `brandingJson` (which is org-owned UI
 * config). `salesJson` carries lightweight CRM bookkeeping that only
 * Testquest staff edit: salesStage, nextFollowupAt, salesNotes,
 * onboardingPath. Shape is enforced in the service layer; the DB just
 * stores JSON.
 *
 * Idempotent.
 */
import "dotenv/config";
import { PrismaClient } from "../../src/generated/prisma/client";

const prisma = new PrismaClient();

async function columnExists(table: string, column: string): Promise<boolean> {
  const r = await prisma.$queryRawUnsafe<Array<{ n: bigint }>>(
    `SELECT COUNT(*) AS n FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${table}' AND COLUMN_NAME = '${column}'`,
  );
  return Number(r[0]?.n ?? 0) > 0;
}

async function main() {
  if (await columnExists("tq_organizations", "salesJson")) {
    console.log("salesJson already exists on tq_organizations; skipping.");
    return;
  }
  await prisma.$executeRawUnsafe(
    `ALTER TABLE \`tq_organizations\` ADD COLUMN \`salesJson\` JSON NULL AFTER \`brandingJson\``,
  );
  console.log("salesJson column added.");
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
