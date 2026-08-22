/**
 * Phase 2 / Task 2.1 — Team invite table.
 *
 *   tq_team_invites.orgId       → tq_organizations(id)  CASCADE
 *   tq_team_invites.invitedBy   → legacy student.student_id (soft ref)
 *
 * Distinct from tq_invite_tokens (student-into-batch joins) — different
 * lifecycle, different state shape. A team invite carries email + name + role
 * and is consumed by a set-password flow that creates a legacy `student` row
 * (if no match) plus an `tq_org_memberships` row.
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
  const had = await tableExists("tq_team_invites");
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS \`tq_team_invites\` (
      \`id\`         INT NOT NULL AUTO_INCREMENT,
      \`orgId\`      INT NOT NULL,
      \`email\`      VARCHAR(255) NOT NULL,
      \`name\`       VARCHAR(200) NOT NULL,
      \`role\`       ENUM('ADMIN','TEACHER') NOT NULL,
      \`token\`      VARCHAR(64) NOT NULL,
      \`invitedBy\`  INT NOT NULL,
      \`expiresAt\`  DATETIME(3) NOT NULL,
      \`acceptedAt\` DATETIME(3) NULL,
      \`revokedAt\`  DATETIME(3) NULL,
      \`createdAt\`  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`tq_team_invites_token_key\` (\`token\`),
      CONSTRAINT \`tq_team_invites_orgId_fkey\`
        FOREIGN KEY (\`orgId\`) REFERENCES \`tq_organizations\`(\`id\`)
        ON DELETE CASCADE ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log(had ? "tq_team_invites: already exists." : "tq_team_invites: created.");

  const indices: Array<{ name: string; cols: string }> = [
    { name: "tq_team_invites_orgId_idx",     cols: "`orgId`" },
    { name: "tq_team_invites_email_idx",     cols: "`email`" },
    { name: "tq_team_invites_expiresAt_idx", cols: "`expiresAt`" },
  ];
  for (const i of indices) {
    if (await indexExists("tq_team_invites", i.name)) {
      console.log(`  index ${i.name}: already exists.`);
      continue;
    }
    await prisma.$executeRawUnsafe(`CREATE INDEX \`${i.name}\` ON \`tq_team_invites\`(${i.cols})`);
    console.log(`  index ${i.name}: created.`);
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
