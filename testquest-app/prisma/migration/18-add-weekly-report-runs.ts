/**
 * Phase 3 / Task 3.2 — Weekly parent-report dedupe table.
 *
 *   tq_weekly_report_runs records every (orgId, studentId, batchId, weekKey)
 *   tuple processed by the Sunday-9am-IST cron. The UNIQUE constraint is the
 *   idempotency guarantee — Vercel may retry a failed cron invocation and we
 *   cannot re-send the same week's report.
 *
 *   weekKey is ISO 8601 week, e.g. "2026-W22", computed in the cron service.
 *   skippedReason is set when we wrote a row but did NOT send (e.g.
 *   "no_activity") so the next retry knows to skip the same tuple.
 *
 * Idempotent: checks information_schema before CREATE.
 */
import "dotenv/config";
import { PrismaClient } from "../../src/generated/prisma/client";

const prisma = new PrismaClient();

async function tableExists(t: string): Promise<boolean> {
  const r = await prisma.$queryRawUnsafe<Array<{ n: bigint }>>(
    `SELECT COUNT(*) AS n FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${t}'`,
  );
  return Number(r[0]?.n ?? 0) > 0;
}

async function indexExists(t: string, n: string): Promise<boolean> {
  const r = await prisma.$queryRawUnsafe<Array<{ n: bigint }>>(
    `SELECT COUNT(*) AS n FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${t}' AND INDEX_NAME = '${n}'`,
  );
  return Number(r[0]?.n ?? 0) > 0;
}

async function main() {
  const had = await tableExists("tq_weekly_report_runs");
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS \`tq_weekly_report_runs\` (
      \`id\`                INT NOT NULL AUTO_INCREMENT,
      \`orgId\`             INT NOT NULL,
      \`studentId\`         INT NOT NULL,
      \`batchId\`           INT NOT NULL,
      \`weekKey\`           CHAR(10) NOT NULL,
      \`pdfUrl\`            VARCHAR(500) NULL,
      \`deliveredChannels\` VARCHAR(100) NULL,
      \`sentAt\`            DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`skippedReason\`     VARCHAR(200) NULL,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`tq_wrr_uniq\` (\`orgId\`, \`studentId\`, \`batchId\`, \`weekKey\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log(had ? "tq_weekly_report_runs: already exists." : "tq_weekly_report_runs: created.");

  if (!(await indexExists("tq_weekly_report_runs", "tq_wrr_org_week"))) {
    await prisma.$executeRawUnsafe(
      `CREATE INDEX \`tq_wrr_org_week\` ON \`tq_weekly_report_runs\`(\`orgId\`, \`weekKey\`)`,
    );
    console.log("  index tq_wrr_org_week: created.");
  } else {
    console.log("  index tq_wrr_org_week: already exists.");
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
