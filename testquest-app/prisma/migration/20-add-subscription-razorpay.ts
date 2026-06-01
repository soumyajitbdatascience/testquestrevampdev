/**
 * Phase 4 / Task 4.1 — Razorpay Subscriptions (recurring) schema.
 *
 * tq_* only — never touches legacy tables. Raw idempotent ALTERs (the repo
 * never runs `prisma db push` against this shared DB).
 *
 * Adds:
 *   - tq_subscriptions.razorpayCustomerId / razorpaySubscriptionId / razorpayMeta
 *   - UNIQUE index on razorpaySubscriptionId (webhook lookup key)
 *   - billingCycle enum gains QUARTERLY
 *   - tq_webhook_events (webhook idempotency ledger)
 *
 * Each step guards on information_schema so re-running is safe.
 */
import "dotenv/config";
import { PrismaClient } from "../../src/generated/prisma/client";

const prisma = new PrismaClient();

async function columnExists(table: string, column: string): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<Array<{ cnt: bigint }>>(
    `SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    table, column,
  );
  return Number(rows[0]?.cnt ?? 0) > 0;
}

async function indexExists(table: string, indexName: string): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<Array<{ cnt: bigint }>>(
    `SELECT COUNT(*) AS cnt FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    table, indexName,
  );
  return Number(rows[0]?.cnt ?? 0) > 0;
}

async function tableExists(table: string): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<Array<{ cnt: bigint }>>(
    `SELECT COUNT(*) AS cnt FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    table,
  );
  return Number(rows[0]?.cnt ?? 0) > 0;
}

async function main() {
  // 1. Add razorpay columns to tq_subscriptions.
  if (!(await columnExists("tq_subscriptions", "razorpayCustomerId"))) {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE \`tq_subscriptions\` ADD COLUMN \`razorpayCustomerId\` VARCHAR(64) NULL`,
    );
    console.log("+ razorpayCustomerId");
  } else console.log("= razorpayCustomerId exists");

  if (!(await columnExists("tq_subscriptions", "razorpaySubscriptionId"))) {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE \`tq_subscriptions\` ADD COLUMN \`razorpaySubscriptionId\` VARCHAR(64) NULL`,
    );
    console.log("+ razorpaySubscriptionId");
  } else console.log("= razorpaySubscriptionId exists");

  if (!(await columnExists("tq_subscriptions", "razorpayMeta"))) {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE \`tq_subscriptions\` ADD COLUMN \`razorpayMeta\` JSON NULL`,
    );
    console.log("+ razorpayMeta");
  } else console.log("= razorpayMeta exists");

  // 2. UNIQUE index on razorpaySubscriptionId (NULLs allowed & non-unique in MySQL).
  if (!(await indexExists("tq_subscriptions", "uniq_rzp_sub"))) {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE \`tq_subscriptions\` ADD UNIQUE INDEX \`uniq_rzp_sub\` (\`razorpaySubscriptionId\`)`,
    );
    console.log("+ uniq_rzp_sub index");
  } else console.log("= uniq_rzp_sub index exists");

  // 3. Extend billingCycle enum with QUARTERLY (idempotent: check current type).
  const enumRows = await prisma.$queryRawUnsafe<Array<{ COLUMN_TYPE: string }>>(
    `SELECT COLUMN_TYPE FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tq_subscriptions' AND COLUMN_NAME = 'billingCycle'`,
  );
  if (!(enumRows[0]?.COLUMN_TYPE ?? "").includes("'QUARTERLY'")) {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE \`tq_subscriptions\` MODIFY COLUMN \`billingCycle\`
       ENUM('MONTHLY','QUARTERLY','ANNUAL') NOT NULL DEFAULT 'ANNUAL'`,
    );
    console.log("+ billingCycle QUARTERLY");
  } else console.log("= billingCycle already has QUARTERLY");

  // 4. Webhook idempotency ledger.
  if (!(await tableExists("tq_webhook_events"))) {
    await prisma.$executeRawUnsafe(
      `CREATE TABLE \`tq_webhook_events\` (
         \`id\` INT AUTO_INCREMENT PRIMARY KEY,
         \`eventId\` VARCHAR(64) NOT NULL,
         \`eventType\` VARCHAR(80) NOT NULL,
         \`receivedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
         UNIQUE KEY \`uniq_event\` (\`eventId\`)
       )`,
    );
    console.log("+ tq_webhook_events table");
  } else console.log("= tq_webhook_events table exists");

  console.log("\nMigration 20 complete.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error(e); process.exit(1); });
