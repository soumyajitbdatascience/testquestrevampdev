/**
 * Phase 0 / Task 0.1 — Coaching Centre schema.
 *
 * Creates four new Prisma-managed tables:
 *   - tq_organizations
 *   - tq_org_memberships
 *   - tq_batches
 *   - tq_batch_enrollments
 *
 * The DDL is hand-written to match exactly what Prisma would generate from
 * `prisma/schema.prisma` (native ENUMs, JSON, DATETIME(3), utf8mb4) so that
 * `prisma generate` produces a client compatible with the actual columns.
 *
 * Cross-table FKs are tq_* → tq_* only. Soft references to legacy
 * `student.student_id` (ownerUserId, OrgMembership.userId, BatchEnrollment.studentId)
 * and `catigories.categories_id` (Batch.classId) are bare INTs with no DB FK —
 * matches the pattern established in `drop-test-fks.ts`.
 *
 * Idempotent: re-running is a no-op. Uses CREATE TABLE IF NOT EXISTS and
 * pre-checks each index via information_schema before creating.
 *
 * IMPORTANT: touches only new tq_* tables. Legacy tables are not modified.
 */
import "dotenv/config";
import { PrismaClient } from "../../src/generated/prisma/client";

const prisma = new PrismaClient();

const STATEMENTS: Array<{ label: string; sql: string }> = [
  {
    label: "tq_organizations",
    sql: `
      CREATE TABLE IF NOT EXISTS \`tq_organizations\` (
        \`id\`            INT NOT NULL AUTO_INCREMENT,
        \`type\`          ENUM('COACHING_CENTRE', 'SCHOOL', 'B2C_FAMILY') NOT NULL,
        \`name\`          VARCHAR(300) NOT NULL,
        \`logoUrl\`       VARCHAR(500) NULL,
        \`city\`          VARCHAR(100) NULL,
        \`brandingJson\`  JSON NULL,
        \`parentOrgId\`   INT NULL,
        \`ownerUserId\`   INT NOT NULL,
        \`isActive\`      BOOLEAN NOT NULL DEFAULT TRUE,
        \`createdAt\`     DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`updatedAt\`     DATETIME(3) NOT NULL,
        PRIMARY KEY (\`id\`),
        CONSTRAINT \`tq_organizations_parentOrgId_fkey\`
          FOREIGN KEY (\`parentOrgId\`)
          REFERENCES \`tq_organizations\`(\`id\`)
          ON DELETE RESTRICT ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `,
  },
  {
    label: "tq_org_memberships",
    sql: `
      CREATE TABLE IF NOT EXISTS \`tq_org_memberships\` (
        \`id\`        INT NOT NULL AUTO_INCREMENT,
        \`orgId\`     INT NOT NULL,
        \`userId\`    INT NOT NULL,
        \`role\`      ENUM('OWNER', 'ADMIN', 'TEACHER', 'STUDENT', 'PARENT') NOT NULL,
        \`isActive\`  BOOLEAN NOT NULL DEFAULT TRUE,
        \`joinedAt\`  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`tq_org_memberships_orgId_userId_role_key\` (\`orgId\`, \`userId\`, \`role\`),
        CONSTRAINT \`tq_org_memberships_orgId_fkey\`
          FOREIGN KEY (\`orgId\`)
          REFERENCES \`tq_organizations\`(\`id\`)
          ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `,
  },
  {
    label: "tq_batches",
    sql: `
      CREATE TABLE IF NOT EXISTS \`tq_batches\` (
        \`id\`           INT NOT NULL AUTO_INCREMENT,
        \`orgId\`        INT NOT NULL,
        \`name\`         VARCHAR(200) NOT NULL,
        \`classId\`      INT NOT NULL,
        \`board\`        VARCHAR(50) NOT NULL,
        \`subjectsCsv\`  VARCHAR(500) NOT NULL,
        \`isActive\`     BOOLEAN NOT NULL DEFAULT TRUE,
        \`createdAt\`    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`updatedAt\`    DATETIME(3) NOT NULL,
        PRIMARY KEY (\`id\`),
        CONSTRAINT \`tq_batches_orgId_fkey\`
          FOREIGN KEY (\`orgId\`)
          REFERENCES \`tq_organizations\`(\`id\`)
          ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `,
  },
  {
    label: "tq_batch_enrollments",
    sql: `
      CREATE TABLE IF NOT EXISTS \`tq_batch_enrollments\` (
        \`id\`          INT NOT NULL AUTO_INCREMENT,
        \`batchId\`     INT NOT NULL,
        \`studentId\`   INT NOT NULL,
        \`isActive\`    BOOLEAN NOT NULL DEFAULT TRUE,
        \`enrolledAt\`  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`updatedAt\`   DATETIME(3) NOT NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`tq_batch_enrollments_batchId_studentId_key\` (\`batchId\`, \`studentId\`),
        CONSTRAINT \`tq_batch_enrollments_batchId_fkey\`
          FOREIGN KEY (\`batchId\`)
          REFERENCES \`tq_batches\`(\`id\`)
          ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `,
  },
];

const INDICES: Array<{ table: string; name: string; cols: string }> = [
  { table: "tq_organizations",    name: "tq_organizations_parentOrgId_idx", cols: "`parentOrgId`" },
  { table: "tq_organizations",    name: "tq_organizations_ownerUserId_idx", cols: "`ownerUserId`" },
  { table: "tq_org_memberships",  name: "tq_org_memberships_userId_idx",    cols: "`userId`" },
  { table: "tq_org_memberships",  name: "tq_org_memberships_orgId_role_idx", cols: "`orgId`, `role`" },
  { table: "tq_batches",          name: "tq_batches_orgId_idx",             cols: "`orgId`" },
  { table: "tq_batch_enrollments", name: "tq_batch_enrollments_studentId_idx", cols: "`studentId`" },
];

async function tableExists(table: string): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<Array<{ n: bigint }>>(
    `SELECT COUNT(*) AS n FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${table}'`,
  );
  return Number(rows[0]?.n ?? 0) > 0;
}

async function indexExists(table: string, name: string): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<Array<{ n: bigint }>>(
    `SELECT COUNT(*) AS n FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${table}' AND INDEX_NAME = '${name}'`,
  );
  return Number(rows[0]?.n ?? 0) > 0;
}

async function main() {
  for (const s of STATEMENTS) {
    const existedBefore = await tableExists(s.label);
    await prisma.$executeRawUnsafe(s.sql);
    const existsAfter = await tableExists(s.label);
    if (!existsAfter) throw new Error(`Failed to create ${s.label}`);
    console.log(existedBefore ? `${s.label}: already exists, skipped.` : `${s.label}: created.`);
  }

  for (const idx of INDICES) {
    if (await indexExists(idx.table, idx.name)) {
      console.log(`  index ${idx.table}.${idx.name}: already exists.`);
      continue;
    }
    await prisma.$executeRawUnsafe(`CREATE INDEX \`${idx.name}\` ON \`${idx.table}\`(${idx.cols})`);
    console.log(`  index ${idx.table}.${idx.name}: created.`);
  }

  console.log("\nDone.");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
