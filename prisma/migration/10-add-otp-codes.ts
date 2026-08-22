/**
 * Phase 1 / Task 1.5 — OTP storage for student-join + future mobile-login.
 *
 * Creates tq_otp_codes. Multi-purpose: namespaced by `purpose` (e.g. "join",
 * later "mobile_login"). Stores a bcrypt hash of the 6-digit code, not the
 * code itself; 5-minute expiry; 5-attempt cap enforced at the service layer.
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
  const had = await tableExists("tq_otp_codes");
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS \`tq_otp_codes\` (
      \`id\`         INT NOT NULL AUTO_INCREMENT,
      \`mobile\`     VARCHAR(20)  NOT NULL,
      \`codeHash\`   VARCHAR(255) NOT NULL,
      \`purpose\`    VARCHAR(40)  NOT NULL,
      \`attempts\`   INT NOT NULL DEFAULT 0,
      \`expiresAt\`  DATETIME(3) NOT NULL,
      \`usedAt\`     DATETIME(3) NULL,
      \`createdAt\`  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (\`id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log(had ? "tq_otp_codes: already exists." : "tq_otp_codes: created.");

  const indices: Array<{ name: string; cols: string }> = [
    { name: "tq_otp_codes_mobile_purpose_idx", cols: "`mobile`, `purpose`" },
    { name: "tq_otp_codes_expiresAt_idx",      cols: "`expiresAt`" },
  ];
  for (const i of indices) {
    if (await indexExists("tq_otp_codes", i.name)) {
      console.log(`  index ${i.name}: already exists.`);
      continue;
    }
    await prisma.$executeRawUnsafe(`CREATE INDEX \`${i.name}\` ON \`tq_otp_codes\`(${i.cols})`);
    console.log(`  index ${i.name}: created.`);
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
