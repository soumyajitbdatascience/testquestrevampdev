import "dotenv/config";
import { PrismaClient } from "../../src/generated/prisma/client";
const p = new PrismaClient();
(async () => {
  const all = await p.$queryRaw`
    SELECT TABLE_NAME, TABLE_ROWS FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
    ORDER BY TABLE_NAME
  ` as Array<{ TABLE_NAME: string; TABLE_ROWS: bigint }>;

  const tq = all.filter(t => t.TABLE_NAME.startsWith("tq_"));
  const legacy = all.filter(t => !t.TABLE_NAME.startsWith("tq_") && !t.TABLE_NAME.startsWith("_prisma"));

  console.log(`Total tables: ${all.length}`);
  console.log(`  tq_* tables: ${tq.length}`);
  console.log(`  legacy tables: ${legacy.length}`);

  const must = ["catigories", "catigories_description", "subjects", "subjects_description", "subcategories", "main_exam", "main_exam_description", "main_exam_to_question", "main_exam_status", "main_exam_result", "question", "question_description", "question_audio_video_paragraph", "student", "languages"];
  console.log("\nKey legacy tables:");
  for (const t of must) {
    const row = all.find(r => r.TABLE_NAME === t);
    if (row) console.log(`  ✓ ${t.padEnd(40)} ${Number(row.TABLE_ROWS).toLocaleString()} rows`);
    else     console.log(`  ✗ ${t.padEnd(40)} MISSING`);
  }

  console.log("\nKey tq_* tables (should still exist from before):");
  for (const t of ["tq_admins", "tq_classes", "tq_questions", "tq_students", "tq_tests"]) {
    const row = all.find(r => r.TABLE_NAME === t);
    if (row) console.log(`  ✓ ${t.padEnd(40)} ${Number(row.TABLE_ROWS).toLocaleString()} rows`);
    else     console.log(`  ✗ ${t.padEnd(40)} MISSING`);
  }

  await p.$disconnect();
})();
