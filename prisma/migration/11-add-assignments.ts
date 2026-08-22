/**
 * Phase 1 / Task 1.6 — Assignments table (no UI yet).
 *
 * Created here so the /coaching/dashboard query layer can count + reference
 * assignments. Task 1.8 builds the assign-test flow that writes to this table.
 *
 *   tq_assignments.batchId → tq_batches(id)        CASCADE
 *   tq_assignments.orgId   → tq_organizations(id)  CASCADE
 *   tq_assignments.testId  → vw_tests.id           (soft ref, no DB FK)
 *   tq_assignments.assignedBy → legacy student.student_id  (soft ref, no FK)
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
  const had = await tableExists("tq_assignments");
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS \`tq_assignments\` (
      \`id\`          INT NOT NULL AUTO_INCREMENT,
      \`orgId\`       INT NOT NULL,
      \`batchId\`     INT NOT NULL,
      \`testId\`      INT NOT NULL,
      \`title\`       VARCHAR(300) NULL,
      \`dueAt\`       DATETIME(3) NULL,
      \`assignedBy\`  INT NOT NULL,
      \`isActive\`    BOOLEAN NOT NULL DEFAULT TRUE,
      \`createdAt\`   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`updatedAt\`   DATETIME(3) NOT NULL,
      PRIMARY KEY (\`id\`),
      CONSTRAINT \`tq_assignments_orgId_fkey\`
        FOREIGN KEY (\`orgId\`) REFERENCES \`tq_organizations\`(\`id\`)
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT \`tq_assignments_batchId_fkey\`
        FOREIGN KEY (\`batchId\`) REFERENCES \`tq_batches\`(\`id\`)
        ON DELETE CASCADE ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log(had ? "tq_assignments: already exists." : "tq_assignments: created.");

  const indices: Array<{ name: string; cols: string }> = [
    { name: "tq_assignments_orgId_idx",     cols: "`orgId`" },
    { name: "tq_assignments_batchId_idx",   cols: "`batchId`" },
    { name: "tq_assignments_createdAt_idx", cols: "`createdAt`" },
  ];
  for (const i of indices) {
    if (await indexExists("tq_assignments", i.name)) {
      console.log(`  index ${i.name}: already exists.`);
      continue;
    }
    await prisma.$executeRawUnsafe(`CREATE INDEX \`${i.name}\` ON \`tq_assignments\`(${i.cols})`);
    console.log(`  index ${i.name}: created.`);
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
