/**
 * One-off data fix — question/option text cleanup.
 *
 * Runs the statements in `docs/handover/migration/question-fix-SAFE.sql`
 * against the configured database. **Data only**: no schema change, no Prisma
 * migration, no `db push`. Every statement is an idempotent `REPLACE`, so
 * re-running is harmless.
 *
 * The token list is PARSED FROM THE SQL FILE rather than duplicated here — a
 * second copy would eventually disagree with the first, and the file is the
 * thing that was hand-verified.
 *
 * Counting note: this database's collation is case-insensitive, so `LIKE
 * '%Clasification%'` also matches `clasification`. That makes the after-count
 * the stricter check (it must be 0 for *every* case variant), and it is why
 * the report also shows a case-sensitive `LIKE BINARY` count — so a token whose
 * lowercase variant has no statement of its own would show up rather than hide.
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/db";

const SQL_FILE = path.join(process.cwd(), "docs/handover/migration/question-fix-SAFE.sql");

/** Scientific single-words the README explicitly excludes. Must not change. */
const MUST_NOT_CHANGE = ["phytohormone", "circumcentre", "phototropism", "Vermicompost"];

interface Stmt { table: string; from: string; to: string; sql: string }

function parseStatements(sql: string): Stmt[] {
  const re = /UPDATE\s+(\w+)\s+SET text = REPLACE\(text, '([^']+)', '([^']+)'\)\s+WHERE text LIKE '%([^']+)%';/g;
  const out: Stmt[] = [];
  for (const m of sql.matchAll(re)) {
    const [sqlText, table, from, to, whereToken] = m;
    // The REPLACE target and the WHERE token must agree, or the statement
    // would update rows it never intended to touch.
    if (from !== whereToken) throw new Error(`Mismatched statement: REPLACE '${from}' but WHERE '${whereToken}'`);
    out.push({ table, from, to, sql: sqlText });
  }
  return out;
}

async function countRows(table: string, token: string, binary: boolean): Promise<number> {
  const rows = await prisma.$queryRawUnsafe<Array<{ n: bigint }>>(
    `SELECT COUNT(*) n FROM ${table} WHERE text LIKE ${binary ? "BINARY " : ""}?`,
    `%${token}%`,
  );
  return Number(rows[0].n);
}

async function tally(tokens: string[], binary = false) {
  const out = new Map<string, { q: number; o: number }>();
  for (const t of tokens) {
    out.set(t, {
      q: await countRows("tq_questions", t, binary),
      o: await countRows("tq_question_options", t, binary),
    });
  }
  return out;
}

async function main() {
  const sql = readFileSync(SQL_FILE, "utf8");
  const statements = parseStatements(sql);
  const tokens = [...new Set(statements.map((s) => s.from))];

  console.log(`database  : ${(await prisma.$queryRawUnsafe<Array<{ db: string }>>("SELECT DATABASE() db"))[0].db}`);
  console.log(`sql file  : ${path.relative(process.cwd(), SQL_FILE)}`);
  console.log(`statements: ${statements.length} over ${new Set(statements.map((s) => s.table)).size} tables`);
  console.log(`tokens    : ${tokens.length}\n`);

  // ── BEFORE ───────────────────────────────────────────────────────────
  const before = await tally(tokens);
  const beforeBin = await tally(tokens, true);
  const guardBefore = await tally(MUST_NOT_CHANGE);

  // ── RUN ──────────────────────────────────────────────────────────────
  let affected = 0;
  for (const s of statements) affected += await prisma.$executeRawUnsafe(s.sql);
  console.log(`ran ${statements.length} statements · ${affected} row-updates reported\n`);

  // ── AFTER ────────────────────────────────────────────────────────────
  const after = await tally(tokens);
  const guardAfter = await tally(MUST_NOT_CHANGE);

  // ── REPORT ───────────────────────────────────────────────────────────
  const w = Math.max(...tokens.map((t) => t.length), 5);
  console.log(`${"token".padEnd(w)}  before(q+o)  after(q+o)  case-sensitive before`);
  console.log("─".repeat(w + 46));
  let totalBefore = 0, totalAfter = 0, residual: string[] = [];
  for (const t of tokens) {
    const b = before.get(t)!, a = after.get(t)!, bb = beforeBin.get(t)!;
    const bSum = b.q + b.o, aSum = a.q + a.o;
    totalBefore += bSum; totalAfter += aSum;
    if (aSum > 0) residual.push(t);
    console.log(
      `${t.padEnd(w)}  ${String(bSum).padStart(11)}  ${String(aSum).padStart(10)}  ` +
      `${String(bb.q + bb.o).padStart(21)}${bSum === 0 ? "   (none present)" : ""}${aSum > 0 ? "   ← STILL PRESENT" : ""}`,
    );
  }
  console.log("─".repeat(w + 46));
  console.log(`${"TOTAL".padEnd(w)}  ${String(totalBefore).padStart(11)}  ${String(totalAfter).padStart(10)}`);

  console.log(`\nGUARD — scientific words that must NOT change:`);
  let guardFailed = false;
  for (const g of MUST_NOT_CHANGE) {
    const b = guardBefore.get(g)!, a = guardAfter.get(g)!;
    const ok = b.q === a.q && b.o === a.o;
    if (!ok) guardFailed = true;
    console.log(`  ${g.padEnd(16)} questions ${b.q} → ${a.q} · options ${b.o} → ${a.o}  ${ok ? "unchanged ✓" : "CHANGED ✗"}`);
  }

  console.log(`\nRESULT: ${residual.length === 0 ? "all tokens cleared" : `${residual.length} token(s) still present: ${residual.join(", ")}`}`);
  console.log(`GUARD : ${guardFailed ? "FAILED — a protected word changed, investigate" : "passed — protected words intact"}`);
}

main().catch((e) => { console.error("FAILED:", e); process.exitCode = 1; })
      .finally(() => prisma.$disconnect());
