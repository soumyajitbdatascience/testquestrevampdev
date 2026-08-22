/**
 * Profiles the columns + key distributions of the legacy tables we plan to migrate.
 * Writes everything to docs/migration/profile.md
 */
import "dotenv/config";
import { PrismaClient } from "../../src/generated/prisma/client";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();

const TARGETS = [
  "languages",
  "general_setting",
  "catigories",
  "catigories_description",
  "subcategories",
  "subcategories_description",
  "subjects",
  "subjects_description",
  "main_exam",
  "main_exam_description",
  "main_exam_to_question",
  "main_exam_status",
  "question",
  "question_description",
  "question_audio_video_paragraph",
  "descriptive_question",
  "descriptive_question_description",
  "descriptive_main_exam",
  "descriptive_main_exam_description",
  "practice_exam",
  "practice_exam_description",
  "practice_exam_to_question",
  "student",
  "student_subject_selection",
  "main_exam_result",
  "practice_exam_result",
  "descriptive_main_exam_result",
];

async function describe(table: string) {
  const cols = await prisma.$queryRawUnsafe<Array<{ COLUMN_NAME: string; DATA_TYPE: string; IS_NULLABLE: string; COLUMN_DEFAULT: string | null; COLUMN_KEY: string }>>(
    `SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_KEY
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
     ORDER BY ORDINAL_POSITION`,
    table
  );
  return cols;
}

async function countOf(sql: string): Promise<number> {
  const r = await prisma.$queryRawUnsafe<Array<{ cnt: bigint }>>(sql);
  return Number(r[0]?.cnt ?? 0);
}

async function distribution(table: string, column: string, limit = 20): Promise<Array<{ value: string; count: number }>> {
  try {
    const r = await prisma.$queryRawUnsafe<Array<{ v: string | number | null; cnt: bigint }>>(
      `SELECT \`${column}\` as v, COUNT(*) as cnt FROM \`${table}\` GROUP BY \`${column}\` ORDER BY cnt DESC LIMIT ?`,
      limit
    );
    return r.map(row => ({ value: String(row.v ?? "<null>"), count: Number(row.cnt) }));
  } catch (e) {
    return [{ value: `(error: ${(e as Error).message.slice(0, 80)})`, count: 0 }];
  }
}

async function sample(table: string, limit = 3): Promise<Record<string, unknown>[]> {
  try {
    const r = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT * FROM \`${table}\` LIMIT ?`,
      limit
    );
    // Truncate long text fields for readability
    return r.map(row => {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(row)) {
        if (typeof v === "string" && v.length > 80) out[k] = v.slice(0, 80) + "…";
        else if (typeof v === "bigint") out[k] = Number(v);
        else out[k] = v;
      }
      return out;
    });
  } catch {
    return [];
  }
}

async function main() {
  let md = "# Legacy Table Profile\n\n";
  md += `Generated ${new Date().toISOString()}\n\n`;
  md += `Profile of ${TARGETS.length} migration-relevant tables.\n\n`;
  md += "## TOC\n";
  for (const t of TARGETS) md += `- [${t}](#${t.replace(/_/g, "_")})\n`;
  md += "\n---\n\n";

  // Section: Key distributions first
  md += "## Quick scorecard\n\n";

  // Languages
  const langs = await prisma.$queryRawUnsafe<Array<{ id: number; languages_name: string; languages_status: number }>>(
    `SELECT * FROM languages`
  ).catch(() => []);
  md += "### Languages defined\n\n";
  if (langs.length === 0) md += "No `languages` table or it's empty.\n\n";
  else {
    md += "| ID | Name | Status |\n|---|---|---|\n";
    for (const l of langs) md += `| ${l.id} | ${l.languages_name} | ${l.languages_status} |\n`;
    md += "\n";
  }

  // Question type distribution
  md += "### Question types in `question` table\n\n";
  const qCols = await describe("question");
  const hasAnswerType = qCols.find(c => c.COLUMN_NAME === "answer_type");
  const hasQuestionType = qCols.find(c => c.COLUMN_NAME === "question_type");
  if (hasAnswerType) {
    md += "**answer_type distribution:**\n\n| Value | Count |\n|---|---:|\n";
    const dist = await distribution("question", "answer_type");
    for (const d of dist) md += `| ${d.value} | ${d.count.toLocaleString()} |\n`;
    md += "\n";
  }
  if (hasQuestionType) {
    md += "**question_type distribution:**\n\n| Value | Count |\n|---|---:|\n";
    const dist = await distribution("question", "question_type");
    for (const d of dist) md += `| ${d.value} | ${d.count.toLocaleString()} |\n`;
    md += "\n";
  }

  // Question language distribution
  const qdCols = await describe("question_description");
  const qdLangCol = qdCols.find(c => c.COLUMN_NAME.includes("language"));
  if (qdLangCol) {
    md += `### \`question_description\` rows per language (\`${qdLangCol.COLUMN_NAME}\`)\n\n`;
    const dist = await distribution("question_description", qdLangCol.COLUMN_NAME);
    md += "| Language ID | Rows |\n|---|---:|\n";
    for (const d of dist) md += `| ${d.value} | ${d.count.toLocaleString()} |\n`;
    md += "\n";
  }

  // Subject deduplication check
  const sdCols = await describe("subjects_description");
  const subjNameCol = sdCols.find(c => /name|subject/i.test(c.COLUMN_NAME) && /des/i.test(c.COLUMN_NAME));
  md += "### Subjects: deduplication signal\n\n";
  const dupSubjects = await prisma.$queryRawUnsafe<Array<{ name: string; cnt: bigint }>>(
    subjNameCol
      ? `SELECT \`${subjNameCol.COLUMN_NAME}\` as name, COUNT(*) as cnt FROM subjects_description GROUP BY \`${subjNameCol.COLUMN_NAME}\` HAVING cnt > 1 ORDER BY cnt DESC LIMIT 10`
      : `SELECT 'unknown' as name, 0 as cnt`
  ).catch(() => []);
  if (dupSubjects.length === 0) md += "No duplicate subject names found.\n\n";
  else {
    md += "Top duplicated subject names (suggests same subject across SubCategories):\n\n";
    md += "| Name | Occurrences |\n|---|---:|\n";
    for (const d of dupSubjects) md += `| ${d.name} | ${Number(d.cnt)} |\n`;
    md += "\n";
  }

  // Per-table details
  md += "## Table profiles\n\n";
  for (const t of TARGETS) {
    md += `### ${t}\n\n`;
    const cols = await describe(t);
    if (cols.length === 0) {
      md += "_(table not found)_\n\n";
      continue;
    }
    const count = await countOf(`SELECT COUNT(*) as cnt FROM \`${t}\``);
    md += `**${count.toLocaleString()} rows** · ${cols.length} columns\n\n`;
    md += "| Column | Type | Null | Default | Key |\n|---|---|---|---|---|\n";
    for (const c of cols) {
      md += `| \`${c.COLUMN_NAME}\` | ${c.DATA_TYPE} | ${c.IS_NULLABLE} | ${c.COLUMN_DEFAULT ?? "—"} | ${c.COLUMN_KEY || "—"} |\n`;
    }
    md += "\n**Sample row:**\n\n```json\n";
    const s = await sample(t, 1);
    md += JSON.stringify(s[0] ?? {}, null, 2);
    md += "\n```\n\n";
  }

  const out = path.join(__dirname, "..", "..", "docs", "migration", "profile.md");
  fs.writeFileSync(out, md);
  console.log(`Wrote ${out} (${(md.length / 1024).toFixed(1)} KB)`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
