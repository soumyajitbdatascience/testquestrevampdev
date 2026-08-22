/**
 * Phase 5 — email lifecycle storage. Additive only.
 *
 *   tq_email_sends            — the dedupe ledger. UNIQUE(kind, studentId, refKey)
 *                               is the idempotency: a second attempt at the same
 *                               logical send violates the constraint and is
 *                               skipped, so a cron re-run or a retried webhook
 *                               cannot double-send.
 *   tq_students.marketingOptOut — where the unsubscribe preference lives. A
 *                               property of the person, on the person's row.
 *
 * CREATE TABLE / ADD COLUMN only: nothing existing is altered or dropped, and
 * the column defaults to 0 so every current row keeps receiving mail. Never
 * `prisma db push`.
 */
import "dotenv/config";
import { prisma } from "@/lib/db";

async function tableExists(name: string): Promise<boolean> {
  const r = await prisma.$queryRawUnsafe<Array<{ n: bigint }>>(
    `SELECT COUNT(*) n FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?`, name);
  return Number(r[0].n) > 0;
}
async function columnExists(table: string, col: string): Promise<boolean> {
  const r = await prisma.$queryRawUnsafe<Array<{ n: bigint }>>(
    `SELECT COUNT(*) n FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
    table, col);
  return Number(r[0].n) > 0;
}

async function main() {
  if (await tableExists("tq_email_sends")) {
    console.log("tq_email_sends already present");
  } else {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE tq_email_sends (
        id                INT AUTO_INCREMENT PRIMARY KEY,
        kind              VARCHAR(60)  NOT NULL,
        studentId         INT          NOT NULL,
        refKey            VARCHAR(120) NOT NULL,
        providerMessageId VARCHAR(200) NULL,
        sentAt            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_email_send (kind, studentId, refKey),
        KEY idx_email_send_student (studentId),
        KEY idx_email_send_sent (sentAt)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    console.log("created tq_email_sends");
  }

  if (await columnExists("tq_students", "marketingOptOut")) {
    console.log("tq_students.marketingOptOut already present");
  } else {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE tq_students ADD COLUMN marketingOptOut TINYINT(1) NOT NULL DEFAULT 0`);
    console.log("added tq_students.marketingOptOut");
  }

  const tables = await prisma.$queryRawUnsafe<Array<Record<string, string>>>(`SHOW TABLES`);
  console.log(`\ntable count now: ${tables.length} (was 27; tq_email_sends is the 28th)`);
}

main().catch((e) => { console.error("FAILED:", e); process.exitCode = 1; })
      .finally(() => prisma.$disconnect());
