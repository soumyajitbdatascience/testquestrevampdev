/**
 * Phase 4 / Task 4.6 — Per-batch teacher assignment.
 *
 *   tq_batch_teachers.batchId  → tq_batches(id)   CASCADE
 *   tq_batch_teachers.userId   → legacy student.student_id (soft ref, no FK)
 *
 * A teacher's OrgMembership row grants org-wide presence; this table
 * narrows their actual classroom responsibility to specific batches. The
 * revoke flow uses it: when an owner revokes a TEACHER who is assigned to
 * one or more batches, they must pick a replacement (or null = batch
 * reverts to owner-managed) for each.
 *
 * Idempotent.
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
  const had = await tableExists("tq_batch_teachers");
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS \`tq_batch_teachers\` (
      \`id\`         INT NOT NULL AUTO_INCREMENT,
      \`batchId\`    INT NOT NULL,
      \`userId\`     INT NOT NULL,
      \`assignedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`isActive\`   BOOLEAN NOT NULL DEFAULT TRUE,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`tq_batch_teachers_batchId_userId_key\` (\`batchId\`, \`userId\`),
      CONSTRAINT \`tq_batch_teachers_batchId_fkey\`
        FOREIGN KEY (\`batchId\`) REFERENCES \`tq_batches\`(\`id\`)
        ON DELETE CASCADE ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log(had ? "tq_batch_teachers: already exists." : "tq_batch_teachers: created.");

  const indices: Array<{ name: string; cols: string }> = [
    { name: "tq_batch_teachers_userId_idx",  cols: "`userId`" },
    { name: "tq_batch_teachers_batchId_idx", cols: "`batchId`" },
  ];
  for (const i of indices) {
    if (await indexExists("tq_batch_teachers", i.name)) {
      console.log(`  index ${i.name}: already exists.`);
      continue;
    }
    await prisma.$executeRawUnsafe(`CREATE INDEX \`${i.name}\` ON \`tq_batch_teachers\`(${i.cols})`);
    console.log(`  index ${i.name}: created.`);
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
