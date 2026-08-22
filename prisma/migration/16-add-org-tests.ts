/**
 * Phase 2 / Task 2.2 — Org-scoped test mapping.
 *
 *   tq_org_tests.orgId         → tq_organizations(id)  CASCADE
 *   tq_org_tests.legacyTestId  → legacy main_exam.exam_id  (soft ref, no DB FK)
 *   tq_org_tests.createdBy     → legacy student.student_id (soft ref)
 *
 * A row here means: "this `main_exam` row was authored by org X and should
 * NOT appear in the B2C /tests browse." The assignment picker for org X still
 * sees it (own org). Other orgs and the public B2C catalogue do not.
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
  const had = await tableExists("tq_org_tests");
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS \`tq_org_tests\` (
      \`id\`            INT NOT NULL AUTO_INCREMENT,
      \`orgId\`         INT NOT NULL,
      \`legacyTestId\`  INT NOT NULL,
      \`createdBy\`     INT NOT NULL,
      \`isActive\`      BOOLEAN NOT NULL DEFAULT TRUE,
      \`createdAt\`     DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`updatedAt\`     DATETIME(3) NOT NULL,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`tq_org_tests_orgId_legacyTestId_key\` (\`orgId\`, \`legacyTestId\`),
      CONSTRAINT \`tq_org_tests_orgId_fkey\`
        FOREIGN KEY (\`orgId\`) REFERENCES \`tq_organizations\`(\`id\`)
        ON DELETE CASCADE ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log(had ? "tq_org_tests: already exists." : "tq_org_tests: created.");

  const indices: Array<{ name: string; cols: string }> = [
    { name: "tq_org_tests_orgId_idx",         cols: "`orgId`" },
    { name: "tq_org_tests_legacyTestId_idx",  cols: "`legacyTestId`" },
  ];
  for (const i of indices) {
    if (await indexExists("tq_org_tests", i.name)) {
      console.log(`  index ${i.name}: already exists.`);
      continue;
    }
    await prisma.$executeRawUnsafe(`CREATE INDEX \`${i.name}\` ON \`tq_org_tests\`(${i.cols})`);
    console.log(`  index ${i.name}: created.`);
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
