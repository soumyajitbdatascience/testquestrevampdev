/**
 * Targeted queries to nail down ambiguous decisions.
 */
import "dotenv/config";
import { PrismaClient } from "../../src/generated/prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== Languages master ===");
  const langs = await prisma.$queryRaw<Array<Record<string, unknown>>>`SELECT * FROM languages`;
  console.log(langs);

  console.log("\n=== general_setting language defaults ===");
  const gs = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT g_id, g_default_language_id, g_default_language_name FROM general_setting LIMIT 1
  ` .catch(async () => {
    return await prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT COLUMN_NAME FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='general_setting'
        AND COLUMN_NAME LIKE '%language%'
    `;
  });
  console.log(gs);

  console.log("\n=== Type code cross-tab: answer_type × question_type ===");
  const cross = await prisma.$queryRaw<Array<{ answer_type: number; question_type: number; cnt: bigint }>>`
    SELECT answer_type, question_type, COUNT(*) as cnt
    FROM question
    GROUP BY answer_type, question_type
    ORDER BY cnt DESC
  `;
  console.log(cross.map(r => ({ answer_type: r.answer_type, question_type: r.question_type, cnt: Number(r.cnt) })));

  console.log("\n=== Sample questions per type ===");
  for (const code of [505, 504, 507, 502, 501, 503]) {
    const sample = await prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT q.question_id, q.answer_type, q.question_type, qd.question_description
      FROM question q
      JOIN question_description qd ON qd.question_id = q.question_id
      WHERE q.question_type = ${code} AND qd.languages_id = 3
      LIMIT 1
    `;
    if (sample.length > 0) {
      const r = sample[0];
      const desc = String(r.question_description || "").slice(0, 80);
      console.log(`q_type=${code}: a_type=${r.answer_type}, "${desc}…"`);
    } else {
      console.log(`q_type=${code}: no English sample`);
    }
  }

  console.log("\n=== question_audio_video_paragraph columns ===");
  const qavpCols = await prisma.$queryRaw<Array<{ COLUMN_NAME: string; DATA_TYPE: string }>>`
    SELECT COLUMN_NAME, DATA_TYPE FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='question_audio_video_paragraph'
    ORDER BY ORDINAL_POSITION
  `;
  console.log(qavpCols.map(c => `${c.COLUMN_NAME}:${c.DATA_TYPE}`).join(", "));

  console.log("\n=== Sample qavp row ===");
  const qavp = await prisma.$queryRaw<Array<Record<string, unknown>>>`SELECT * FROM question_audio_video_paragraph LIMIT 2`;
  for (const r of qavp) console.log(JSON.stringify(r, (k, v) => typeof v === "bigint" ? Number(v) : v).slice(0, 400));

  console.log("\n=== main_exam_to_question columns ===");
  const metqCols = await prisma.$queryRaw<Array<{ COLUMN_NAME: string; DATA_TYPE: string }>>`
    SELECT COLUMN_NAME, DATA_TYPE FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='main_exam_to_question'
    ORDER BY ORDINAL_POSITION
  `;
  console.log(metqCols.map(c => `${c.COLUMN_NAME}:${c.DATA_TYPE}`).join(", "));

  console.log("\n=== student columns ===");
  const stuCols = await prisma.$queryRaw<Array<{ COLUMN_NAME: string; DATA_TYPE: string }>>`
    SELECT COLUMN_NAME, DATA_TYPE FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='student'
    ORDER BY ORDINAL_POSITION
  `;
  console.log(stuCols.map(c => `${c.COLUMN_NAME}:${c.DATA_TYPE}`).join(", "));

  console.log("\n=== Sample student row (with password) ===");
  const stuSample = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT student_id, student_first_name, student_email_address, student_password, student_password_plane, catigories_id, subcategories_id
    FROM student LIMIT 3
  `;
  for (const r of stuSample) console.log(JSON.stringify(r));

  console.log("\n=== main_exam_result columns ===");
  const merCols = await prisma.$queryRaw<Array<{ COLUMN_NAME: string; DATA_TYPE: string }>>`
    SELECT COLUMN_NAME, DATA_TYPE FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='main_exam_result'
    ORDER BY ORDINAL_POSITION
  `;
  console.log(merCols.map(c => `${c.COLUMN_NAME}:${c.DATA_TYPE}`).join(", "));

  console.log("\n=== main_exam_result attempt summary check ===");
  // Are rows per-question or per-attempt? Count distinct attempts vs total rows
  const merCount = await prisma.$queryRaw<Array<{ total: bigint; distinct_combos: bigint }>>`
    SELECT
      COUNT(*) as total,
      COUNT(DISTINCT CONCAT(student_id, '|', main_exam_id, '|', DATE(start_date))) as distinct_combos
    FROM main_exam_result
  `.catch(() => [{ total: 0n, distinct_combos: 0n }]);
  console.log({ total: Number(merCount[0].total), distinct_combos: Number(merCount[0].distinct_combos) });
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
