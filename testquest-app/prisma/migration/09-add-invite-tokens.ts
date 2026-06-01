/**
 * Phase 1 / Task 1.4 — Coaching setup wizard invite tokens.
 *
 * Creates tq_invite_tokens. Used by the wizard's step-4 "Generate link" mode
 * (Task 1.4) and consumed by the student-join landing page (Task 1.5).
 *
 *   tq_invite_tokens.batchId → tq_batches(id)        CASCADE
 *   tq_invite_tokens.orgId   → tq_organizations(id)  CASCADE
 *   tq_invite_tokens.createdBy → legacy student.student_id   (soft ref, no FK)
 *
 * Idempotent.
 */
import "dotenv/config";
import { PrismaClient } from "../../src/generated/prisma/client";

const prisma = new PrismaClient();

const STATEMENTS: Array<{ label: string; sql: string }> = [
  {
    label: "tq_invite_tokens",
    sql: `
      CREATE TABLE IF NOT EXISTS \`tq_invite_tokens\` (
        \`id\`         INT NOT NULL AUTO_INCREMENT,
        \`token\`      VARCHAR(64) NOT NULL,
        \`batchId\`    INT NOT NULL,
        \`orgId\`      INT NOT NULL,
        \`createdBy\`  INT NOT NULL,
        \`expiresAt\`  DATETIME(3) NOT NULL,
        \`usedAt\`     DATETIME(3) NULL,
        \`createdAt\`  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`tq_invite_tokens_token_key\` (\`token\`),
        CONSTRAINT \`tq_invite_tokens_batchId_fkey\`
          FOREIGN KEY (\`batchId\`) REFERENCES \`tq_batches\`(\`id\`)
          ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT \`tq_invite_tokens_orgId_fkey\`
          FOREIGN KEY (\`orgId\`) REFERENCES \`tq_organizations\`(\`id\`)
          ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `,
  },
];

const INDICES: Array<{ table: string; name: string; cols: string }> = [
  { table: "tq_invite_tokens", name: "tq_invite_tokens_batchId_idx",   cols: "`batchId`" },
  { table: "tq_invite_tokens", name: "tq_invite_tokens_orgId_idx",     cols: "`orgId`" },
  { table: "tq_invite_tokens", name: "tq_invite_tokens_expiresAt_idx", cols: "`expiresAt`" },
];

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
  for (const s of STATEMENTS) {
    const had = await tableExists(s.label);
    await prisma.$executeRawUnsafe(s.sql);
    if (!(await tableExists(s.label))) throw new Error(`Failed to create ${s.label}`);
    console.log(had ? `${s.label}: already exists.` : `${s.label}: created.`);
  }
  for (const i of INDICES) {
    if (await indexExists(i.table, i.name)) { console.log(`  index ${i.name}: already exists.`); continue; }
    await prisma.$executeRawUnsafe(`CREATE INDEX \`${i.name}\` ON \`${i.table}\`(${i.cols})`);
    console.log(`  index ${i.name}: created.`);
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
