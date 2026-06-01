/**
 * Phase 1 / Task 1.9 — Map legacy attempts to assignments.
 *
 * The legacy main_exam_status / practice_exam_status tables remain the source
 * of truth for attempts (read by the mobile app, etc.). This table only
 * records the *link* between an assignment and the attempt token so we can
 * answer "did this student complete that assignment" without changing legacy.
 *
 *   tq_assignment_attempts.assignmentId → tq_assignments(id)  CASCADE
 *   tq_assignment_attempts.studentId    → legacy student.student_id (soft ref)
 *   tq_assignment_attempts.attemptToken → legacy main_exam_status.token (soft ref)
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
  const had = await tableExists("tq_assignment_attempts");
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS \`tq_assignment_attempts\` (
      \`id\`            INT NOT NULL AUTO_INCREMENT,
      \`assignmentId\`  INT NOT NULL,
      \`studentId\`     INT NOT NULL,
      \`attemptToken\`  VARCHAR(80) NOT NULL,
      \`startedAt\`     DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`completedAt\`   DATETIME(3) NULL,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`tq_assignment_attempts_attemptToken_key\` (\`attemptToken\`),
      CONSTRAINT \`tq_assignment_attempts_assignmentId_fkey\`
        FOREIGN KEY (\`assignmentId\`) REFERENCES \`tq_assignments\`(\`id\`)
        ON DELETE CASCADE ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log(had ? "tq_assignment_attempts: already exists." : "tq_assignment_attempts: created.");

  const indices: Array<{ name: string; cols: string }> = [
    { name: "tq_assignment_attempts_assignmentId_idx", cols: "`assignmentId`" },
    { name: "tq_assignment_attempts_studentId_idx",    cols: "`studentId`" },
  ];
  for (const i of indices) {
    if (await indexExists("tq_assignment_attempts", i.name)) {
      console.log(`  index ${i.name}: already exists.`);
      continue;
    }
    await prisma.$executeRawUnsafe(`CREATE INDEX \`${i.name}\` ON \`tq_assignment_attempts\`(${i.cols})`);
    console.log(`  index ${i.name}: created.`);
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
