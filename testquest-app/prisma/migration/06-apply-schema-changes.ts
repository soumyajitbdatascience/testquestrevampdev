/**
 * Apply schema changes via raw ALTER TABLE statements.
 * This ONLY touches tq_* tables. Legacy tables are not referenced.
 * Idempotent — checks if column/enum value exists before adding.
 */
import "dotenv/config";
import { PrismaClient } from "../../src/generated/prisma/client";

const prisma = new PrismaClient();

async function columnExists(table: string, column: string): Promise<boolean> {
  const r = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*) as cnt FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    table, column
  ) as Array<{ cnt: bigint }>;
  return Number(r[0].cnt) > 0;
}

async function isNullable(table: string, column: string): Promise<boolean> {
  const r = await prisma.$queryRawUnsafe(
    `SELECT IS_NULLABLE FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    table, column
  ) as Array<{ IS_NULLABLE: string }>;
  return r[0]?.IS_NULLABLE === "YES";
}

async function enumIncludes(table: string, column: string, value: string): Promise<boolean> {
  const r = await prisma.$queryRawUnsafe(
    `SELECT COLUMN_TYPE FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    table, column
  ) as Array<{ COLUMN_TYPE: string }>;
  return (r[0]?.COLUMN_TYPE || "").includes(`'${value}'`);
}

async function run(sql: string, label: string) {
  console.log(`  • ${label}`);
  await prisma.$executeRawUnsafe(sql);
}

async function ensureColumn(table: string, column: string, ddl: string, label: string) {
  if (await columnExists(table, column)) {
    console.log(`  ✓ ${table}.${column} already exists`);
    return;
  }
  await run(ddl, label);
}

async function main() {
  console.log("=== Applying schema changes via ALTER TABLE ===\n");
  console.log("Step 1: Add legacy trace columns to entity tables\n");

  await ensureColumn(
    "tq_classes", "legacyId",
    "ALTER TABLE tq_classes ADD COLUMN legacyId INT NULL, ADD UNIQUE INDEX tq_classes_legacyId_key (legacyId)",
    "tq_classes.legacyId"
  );

  await ensureColumn(
    "tq_subjects", "legacyId",
    "ALTER TABLE tq_subjects ADD COLUMN legacyId INT NULL, ADD UNIQUE INDEX tq_subjects_legacyId_key (legacyId)",
    "tq_subjects.legacyId"
  );

  await ensureColumn(
    "tq_tests", "legacyId",
    "ALTER TABLE tq_tests ADD COLUMN legacyId INT NULL, ADD UNIQUE INDEX tq_tests_legacyId_key (legacyId)",
    "tq_tests.legacyId"
  );

  await ensureColumn(
    "tq_tests", "isLegacy",
    "ALTER TABLE tq_tests ADD COLUMN isLegacy BOOLEAN NOT NULL DEFAULT FALSE",
    "tq_tests.isLegacy"
  );

  await ensureColumn(
    "tq_students", "legacyId",
    "ALTER TABLE tq_students ADD COLUMN legacyId INT NULL, ADD UNIQUE INDEX tq_students_legacyId_key (legacyId)",
    "tq_students.legacyId"
  );

  console.log("\nStep 2: Question type enum + subjectId + nullable chapterId + legacy fields\n");

  // 2a) Extend QuestionType enum
  const hasParagraph = await enumIncludes("tq_questions", "type", "PARAGRAPH");
  const hasSubjective = await enumIncludes("tq_questions", "type", "SUBJECTIVE");
  if (!hasParagraph || !hasSubjective) {
    await run(
      `ALTER TABLE tq_questions MODIFY COLUMN type ENUM('SINGLE_MCQ','MULTI_MCQ','FILL_IN_BLANK','PARAGRAPH','SUBJECTIVE') NOT NULL`,
      "tq_questions.type enum extended (+ PARAGRAPH, + SUBJECTIVE)"
    );
  } else {
    console.log("  ✓ tq_questions.type enum already includes PARAGRAPH and SUBJECTIVE");
  }

  // 2b) Add subjectId (nullable initially because of existing 5 sample rows — those'll be deleted later)
  await ensureColumn(
    "tq_questions", "subjectId",
    "ALTER TABLE tq_questions ADD COLUMN subjectId INT NULL, ADD INDEX tq_questions_subjectId_idx (subjectId)",
    "tq_questions.subjectId (nullable for now)"
  );

  // 2c) Make chapterId nullable
  if (!(await isNullable("tq_questions", "chapterId"))) {
    await run(
      `ALTER TABLE tq_questions MODIFY COLUMN chapterId INT NULL`,
      "tq_questions.chapterId → nullable"
    );
  } else {
    console.log("  ✓ tq_questions.chapterId already nullable");
  }

  // 2d) Widen correctText to TEXT
  const correctTextType = await prisma.$queryRawUnsafe(
    `SELECT DATA_TYPE FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='tq_questions' AND COLUMN_NAME='correctText'`
  ) as Array<{ DATA_TYPE: string }>;
  if (correctTextType[0]?.DATA_TYPE !== "text") {
    await run(
      `ALTER TABLE tq_questions MODIFY COLUMN correctText TEXT NULL`,
      "tq_questions.correctText → TEXT"
    );
  } else {
    console.log("  ✓ tq_questions.correctText already TEXT");
  }

  // 2e) Trace fields on tq_questions
  await ensureColumn(
    "tq_questions", "isLegacy",
    "ALTER TABLE tq_questions ADD COLUMN isLegacy BOOLEAN NOT NULL DEFAULT FALSE, ADD INDEX tq_questions_isLegacy_idx (isLegacy)",
    "tq_questions.isLegacy"
  );
  await ensureColumn(
    "tq_questions", "legacyId",
    "ALTER TABLE tq_questions ADD COLUMN legacyId INT NULL, ADD UNIQUE INDEX tq_questions_legacyId_key (legacyId)",
    "tq_questions.legacyId"
  );

  console.log("\nStep 3: Attempt enum + legacy flags\n");

  const hasLegacyCompleted = await enumIncludes("tq_attempts", "status", "LEGACY_COMPLETED");
  if (!hasLegacyCompleted) {
    await run(
      `ALTER TABLE tq_attempts MODIFY COLUMN status ENUM('IN_PROGRESS','PAUSED','COMPLETED','AUTO_SUBMITTED','LEGACY_COMPLETED') NOT NULL DEFAULT 'IN_PROGRESS'`,
      "tq_attempts.status enum + LEGACY_COMPLETED"
    );
  } else {
    console.log("  ✓ tq_attempts.status enum already has LEGACY_COMPLETED");
  }

  await ensureColumn(
    "tq_attempts", "isLegacy",
    "ALTER TABLE tq_attempts ADD COLUMN isLegacy BOOLEAN NOT NULL DEFAULT FALSE, ADD INDEX tq_attempts_isLegacy_idx (isLegacy)",
    "tq_attempts.isLegacy"
  );

  await ensureColumn(
    "tq_attempts", "legacyKey",
    "ALTER TABLE tq_attempts ADD COLUMN legacyKey VARCHAR(80) NULL, ADD UNIQUE INDEX tq_attempts_legacyKey_key (legacyKey)",
    "tq_attempts.legacyKey"
  );

  console.log("\n✓ All schema changes applied. Legacy tables untouched.\n");
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
