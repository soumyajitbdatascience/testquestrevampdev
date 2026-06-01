import "dotenv/config";
import { PrismaClient } from "../../src/generated/prisma/client";
const p = new PrismaClient();
(async () => {
  for (const table of ["main_exam_status", "practice_exam_status", "question", "question_audio_video_paragraph", "student", "catigories_description"]) {
    const cols = await p.$queryRawUnsafe(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?
       ORDER BY ORDINAL_POSITION`,
      table
    ) as Array<{ COLUMN_NAME: string }>;
    console.log(`${table}:\n  ${cols.map(c => c.COLUMN_NAME).join(", ")}\n`);
  }

  console.log("=== main_exam_status sample ===");
  const mes = await p.$queryRaw`SELECT * FROM main_exam_status LIMIT 1` as Array<Record<string, unknown>>;
  console.log(JSON.stringify(mes[0], (k, v) => typeof v === "bigint" ? Number(v) : v, 2));

  console.log("\n=== question_audio_video_paragraph sample ===");
  const qavp = await p.$queryRaw`SELECT * FROM question_audio_video_paragraph LIMIT 2` as Array<Record<string, unknown>>;
  for (const r of qavp) console.log(JSON.stringify(r, (k, v) => typeof v === "bigint" ? Number(v) : v).slice(0, 500));

  console.log("\n=== student sample (sensitive cols masked) ===");
  const stu = await p.$queryRaw`SELECT student_id, student_first_name, student_last_name, student_email_address, LEFT(student_password, 10) as pw_prefix, catigories_id, subcategories_id, student_status FROM student LIMIT 3` as Array<Record<string, unknown>>;
  for (const r of stu) console.log(JSON.stringify(r));

  console.log("\n=== main_exam_status attempt count ===");
  const mesCount = await p.$queryRaw`SELECT COUNT(*) as cnt FROM main_exam_status` as Array<{ cnt: bigint }>;
  console.log(`main_exam_status rows = ${Number(mesCount[0].cnt)}`);

  console.log("\n=== practice_exam_status attempt count ===");
  const pesCount = await p.$queryRaw`SELECT COUNT(*) as cnt FROM practice_exam_status` as Array<{ cnt: bigint }>;
  console.log(`practice_exam_status rows = ${Number(pesCount[0].cnt)}`);

  await p.$disconnect();
})();
