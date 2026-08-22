import "dotenv/config";
import { PrismaClient } from "../../src/generated/prisma/client";
const p = new PrismaClient();
(async () => {
  for (const table of ["question_description", "subjects", "catigories", "subcategories", "subcategories_description", "subjects_description", "main_exam", "main_exam_description", "main_exam_to_question", "practice_exam_to_question", "main_exam_result", "practice_exam_result", "descriptive_main_exam_result", "descriptive_question", "descriptive_question_description", "descriptive_main_exam", "descriptive_main_exam_description"]) {
    const cols = await p.$queryRawUnsafe(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?
       ORDER BY ORDINAL_POSITION`,
      table
    ) as Array<{ COLUMN_NAME: string }>;
    console.log(`${table}: ${cols.map(c => c.COLUMN_NAME).join(", ")}`);
  }
  await p.$disconnect();
})();
