/**
 * Applies the read-only VIEWs over legacy tables.
 * - Only runs CREATE OR REPLACE VIEW statements (never DROP TABLE)
 * - Verifies each view by counting rows
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import { PrismaClient } from "../../src/generated/prisma/client";

const prisma = new PrismaClient();

const VIEW_NAMES = [
  "vw_classes",
  "vw_subjects",
  "vw_questions",
  "vw_question_options",
  "vw_question_meta",
  "vw_tests",
  "vw_test_questions",
  "vw_students",
  "vw_attempts_legacy",
];

/** Parse a SQL file and split into individual CREATE OR REPLACE VIEW statements. */
function splitViewStatements(sql: string): { name: string; ddl: string }[] {
  // Strip /* ... */ block comments
  const cleaned = sql.replace(/\/\*[\s\S]*?\*\//g, "");
  const out: { name: string; ddl: string }[] = [];
  // Split on ";\n" but keep our CREATE OR REPLACE intact
  const parts = cleaned
    .split(/;\s*\n/)
    .map(p => p.trim())
    .filter(p => p && !/^--/m.test(p.split("\n")[0]) || /CREATE\s+OR\s+REPLACE\s+VIEW/i.test(p));

  for (const raw of parts) {
    // Strip leading line comments
    const body = raw.replace(/^--[^\n]*\n/gm, "").trim();
    if (!body) continue;
    if (!/CREATE\s+OR\s+REPLACE\s+VIEW/i.test(body)) continue;
    const m = body.match(/CREATE\s+OR\s+REPLACE\s+VIEW\s+([a-z_][a-z0-9_]*)/i);
    if (!m) continue;
    out.push({ name: m[1], ddl: body });
  }
  return out;
}

async function main() {
  console.log("=== Applying VIEW definitions ===\n");

  const sqlPath = path.join(__dirname, "sql", "create-views.sql");
  const sql = fs.readFileSync(sqlPath, "utf-8");
  const stmts = splitViewStatements(sql);

  console.log(`Parsed ${stmts.length} CREATE VIEW statements\n`);

  for (const { name, ddl } of stmts) {
    try {
      process.stdout.write(`  • ${name}…`);
      await prisma.$executeRawUnsafe(ddl);
      console.log(" ✓");
    } catch (e) {
      console.log(" ✗");
      console.error(`    ${(e as Error).message}`);
      throw e;
    }
  }

  console.log("\n=== Verification (row counts) ===\n");
  for (const name of VIEW_NAMES) {
    try {
      const r = await prisma.$queryRawUnsafe(
        `SELECT COUNT(*) as cnt FROM \`${name}\``
      ) as Array<{ cnt: bigint }>;
      console.log(`  ${name.padEnd(28)} ${Number(r[0].cnt).toLocaleString()} rows`);
    } catch (e) {
      console.log(`  ${name.padEnd(28)} ERROR: ${(e as Error).message.slice(0, 80)}`);
    }
  }

  // Sanity check: legacy tables still intact
  const legacy = await prisma.$queryRaw<Array<{ cnt: bigint }>>`
    SELECT COUNT(*) as cnt FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE' AND TABLE_NAME NOT LIKE 'tq\\_%'
  `;
  console.log(`\nLegacy BASE tables intact: ${Number(legacy[0].cnt)} (should be 94)`);
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
