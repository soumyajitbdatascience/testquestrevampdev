import "dotenv/config";
import { PrismaClient } from "../../src/generated/prisma/client";
const p = new PrismaClient();
(async () => {
  // Check if my new columns survived the restore
  const checks = [
    { table: "tq_classes", col: "legacyId" },
    { table: "tq_subjects", col: "legacyId" },
    { table: "tq_questions", col: "subjectId" },
    { table: "tq_questions", col: "legacyId" },
    { table: "tq_questions", col: "isLegacy" },
    { table: "tq_tests", col: "legacyId" },
    { table: "tq_tests", col: "isLegacy" },
    { table: "tq_students", col: "legacyId" },
    { table: "tq_attempts", col: "legacyKey" },
    { table: "tq_attempts", col: "isLegacy" },
  ];
  for (const { table, col } of checks) {
    const r = await p.$queryRawUnsafe(
      `SELECT COUNT(*) as cnt FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?`,
      table, col
    ) as Array<{ cnt: bigint }>;
    const present = Number(r[0].cnt) > 0;
    console.log(`  ${present ? "✓" : "✗"} ${table}.${col}`);
  }

  // Check tq_questions chapterId nullability
  const chapterCol = await p.$queryRaw`
    SELECT IS_NULLABLE FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='tq_questions' AND COLUMN_NAME='chapterId'
  ` as Array<{ IS_NULLABLE: string }>;
  console.log(`\ntq_questions.chapterId nullable: ${chapterCol[0]?.IS_NULLABLE === "YES" ? "✓ YES" : "✗ NO (still required)"}`);

  // Check QuestionType enum values
  const enumDef = await p.$queryRaw`
    SELECT COLUMN_TYPE FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='tq_questions' AND COLUMN_NAME='type'
  ` as Array<{ COLUMN_TYPE: string }>;
  console.log(`tq_questions.type enum: ${enumDef[0]?.COLUMN_TYPE}`);

  await p.$disconnect();
})();
