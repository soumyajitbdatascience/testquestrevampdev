/**
 * One-off data fix — the 'Clasification' misspelling in CHAPTER and TEST NAMES.
 *
 * A sibling to `32-question-text-cleanup.ts` rather than an addition to it:
 * that script's job is to replay `question-fix-SAFE.sql` against the two *text*
 * columns and report on exactly those tokens. This is a different column on
 * different tables, and keeping them apart means each stays re-runnable and
 * legible on its own.
 *
 * Why this is needed at all: `question-fix-SAFE.sql` targets
 * `tq_questions.text` and `tq_question_options.text`, where 'Clasification'
 * never appeared. The misspelling lives in `tq_chapters.name` and
 * `tq_tests.name` — the chapter heading and test titles a student reads. The
 * README's "~130 questions" was a count of questions sitting *under* those
 * misspelled names, not questions containing the word.
 *
 * Data only: no schema change, no Prisma migration, no `db push`. Idempotent.
 */
import "dotenv/config";
import { prisma } from "@/lib/db";

const FROM = "Clasification";
const TO = "Classification";

/** Other name columns, checked so the report can say the sweep was complete. */
const ALSO_CHECK: Array<[string, string]> = [
  ["tq_subjects", "name"],
  ["tq_boards", "name"],
  ["tq_classes", "name"],
  ["tq_questions", "explanation"],
  ["tq_questions", "correctText"],
];

async function count(table: string, column: string): Promise<number> {
  const r = await prisma.$queryRawUnsafe<Array<{ n: bigint }>>(
    `SELECT COUNT(*) n FROM ${table} WHERE ${column} LIKE ?`, `%${FROM}%`);
  return Number(r[0].n);
}

async function main() {
  console.log(`database: ${(await prisma.$queryRawUnsafe<Array<{ db: string }>>("SELECT DATABASE() db"))[0].db}`);
  console.log(`fixing  : '${FROM}' → '${TO}'\n`);

  const targets: Array<[string, string]> = [["tq_chapters", "name"], ["tq_tests", "name"]];

  const before = new Map<string, number>();
  for (const [t, c] of targets) before.set(`${t}.${c}`, await count(t, c));

  // Show exactly which rows are about to change — a name is user-visible, so
  // it is worth seeing the before text rather than trusting a count.
  const chBefore = await prisma.$queryRawUnsafe<Array<{ id: number; name: string }>>(
    `SELECT id, name FROM tq_chapters WHERE name LIKE ?`, `%${FROM}%`);
  const tBefore = await prisma.$queryRawUnsafe<Array<{ id: number; name: string }>>(
    `SELECT id, name FROM tq_tests WHERE name LIKE ?`, `%${FROM}%`);
  console.log("rows before:");
  for (const r of chBefore) console.log(`  tq_chapters #${r.id}  "${r.name}"`);
  for (const r of tBefore) console.log(`  tq_tests    #${r.id}  "${r.name}"`);

  const chAffected = await prisma.$executeRawUnsafe(
    `UPDATE tq_chapters SET name = REPLACE(name, '${FROM}', '${TO}') WHERE name LIKE '%${FROM}%'`);
  const tAffected = await prisma.$executeRawUnsafe(
    `UPDATE tq_tests SET name = REPLACE(name, '${FROM}', '${TO}') WHERE name LIKE '%${FROM}%'`);
  console.log(`\nupdated: ${chAffected} chapter(s), ${tAffected} test(s)`);

  const after = new Map<string, number>();
  for (const [t, c] of targets) after.set(`${t}.${c}`, await count(t, c));

  console.log(`\n${"column".padEnd(20)}  before  after`);
  console.log("─".repeat(36));
  let residual = 0;
  for (const [t, c] of targets) {
    const k = `${t}.${c}`;
    console.log(`${k.padEnd(20)}  ${String(before.get(k)).padStart(6)}  ${String(after.get(k)).padStart(5)}`);
    residual += after.get(k)!;
  }

  console.log("\nrows after:");
  for (const r of await prisma.$queryRawUnsafe<Array<{ id: number; name: string }>>(
    `SELECT id, name FROM tq_chapters WHERE id IN (${chBefore.map((r) => r.id).join(",") || "0"})`))
    console.log(`  tq_chapters #${r.id}  "${r.name}"`);
  for (const r of await prisma.$queryRawUnsafe<Array<{ id: number; name: string }>>(
    `SELECT id, name FROM tq_tests WHERE id IN (${tBefore.map((r) => r.id).join(",") || "0"})`))
    console.log(`  tq_tests    #${r.id}  "${r.name}"`);

  console.log("\nsweep — anywhere else this misspelling could hide:");
  for (const [t, c] of ALSO_CHECK) console.log(`  ${`${t}.${c}`.padEnd(28)} ${await count(t, c)}`);

  console.log(`\nRESULT: ${residual === 0 ? "cleared" : `${residual} row(s) still misspelled`}`);
}

main().catch((e) => { console.error("FAILED:", e); process.exitCode = 1; })
      .finally(() => prisma.$disconnect());
