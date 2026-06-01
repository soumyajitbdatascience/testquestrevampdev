/**
 * Phase 1 / Task 1.8 — Extend tq_assignments.
 *
 * Adds:
 *   - instructions  TEXT NULL
 *   - settingsJson  JSON NULL   (notify channels, late submission flags, etc.)
 *
 * Idempotent.
 */
import "dotenv/config";
import { PrismaClient } from "../../src/generated/prisma/client";
const prisma = new PrismaClient();

async function columnExists(t: string, c: string): Promise<boolean> {
  const r = await prisma.$queryRawUnsafe<Array<{ n: bigint }>>(
    `SELECT COUNT(*) AS n FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${t}' AND COLUMN_NAME = '${c}'`,
  );
  return Number(r[0]?.n ?? 0) > 0;
}

async function main() {
  if (await columnExists("tq_assignments", "instructions")) {
    console.log("instructions: already exists.");
  } else {
    await prisma.$executeRawUnsafe(`ALTER TABLE \`tq_assignments\` ADD COLUMN \`instructions\` TEXT NULL`);
    console.log("instructions: added.");
  }
  if (await columnExists("tq_assignments", "settingsJson")) {
    console.log("settingsJson: already exists.");
  } else {
    await prisma.$executeRawUnsafe(`ALTER TABLE \`tq_assignments\` ADD COLUMN \`settingsJson\` JSON NULL`);
    console.log("settingsJson: added.");
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
