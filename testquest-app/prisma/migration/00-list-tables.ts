/**
 * Lists every table in the legacy DB, separating tq_* (new) from legacy.
 * Output goes to docs/migration/inventory.md
 */
import "dotenv/config";
import { PrismaClient } from "../../src/generated/prisma/client";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.$queryRaw<Array<{ TABLE_NAME: string; TABLE_ROWS: bigint }>>`
    SELECT TABLE_NAME, TABLE_ROWS
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
    ORDER BY TABLE_NAME
  `;

  const tqTables: Array<{ name: string; rows: number }> = [];
  const legacyTables: Array<{ name: string; rows: number }> = [];

  for (const r of rows) {
    const entry = { name: r.TABLE_NAME, rows: Number(r.TABLE_ROWS) };
    if (r.TABLE_NAME.startsWith("tq_") || r.TABLE_NAME.startsWith("_prisma_")) {
      tqTables.push(entry);
    } else {
      legacyTables.push(entry);
    }
  }

  let md = "# Legacy DB Inventory\n\n";
  md += `Generated ${new Date().toISOString()}\n\n`;
  md += `Connected to: \`${process.env.DATABASE_URL?.split("@")[1]?.split("?")[0]}\`\n\n`;

  md += `## New app tables (prefix \`tq_\`) — ${tqTables.length}\n\n`;
  md += "| Table | Rows |\n|---|---:|\n";
  for (const t of tqTables) md += `| \`${t.name}\` | ${t.rows.toLocaleString()} |\n`;

  md += `\n## Legacy tables — ${legacyTables.length}\n\n`;
  md += "| Table | Rows (approx) |\n|---|---:|\n";
  for (const t of legacyTables) md += `| \`${t.name}\` | ${t.rows.toLocaleString()} |\n`;

  const out = path.join(__dirname, "..", "..", "docs", "migration", "inventory.md");
  fs.writeFileSync(out, md);
  console.log(`Wrote ${out}`);
  console.log(`Legacy tables: ${legacyTables.length}, tq_ tables: ${tqTables.length}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
