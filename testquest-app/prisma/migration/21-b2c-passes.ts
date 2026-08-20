/**
 * Migration 21 — B2C prepaid Board+Class passes (design_handoff_b2c_web).
 *
 * Additive tq_* tables only, per docs/handover/claude-code-implementation-brief.md §2:
 *   tq_boards, tq_student_contexts, tq_chapter_tests, tq_videos, tq_free_tests,
 *   tq_b2c_plans, tq_class_access, tq_events
 * plus ALTERs:
 *   tq_chapters  += boardId, classId (nullable — existing subject-scoped rows keep working)
 *   tq_orders    += planId; itemType enum += 'B2C_PLAN'
 *
 * Column naming follows the codebase's existing camelCase convention
 * (see tq_chapters/tq_orders), not the brief's snake_case sketch.
 * Idempotent: CREATE TABLE IF NOT EXISTS + information_schema checks for ALTERs.
 *
 * Run: npx tsx prisma/migration/21-b2c-passes.ts
 */
import "dotenv/config";
import { PrismaClient } from "../../src/generated/prisma/client";

const prisma = new PrismaClient();

async function columnExists(table: string, column: string): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<Array<{ c: bigint }>>(
    `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    table, column,
  );
  return Number(rows[0].c) > 0;
}

async function main() {
  console.log("— tq_boards");
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS tq_boards (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      code VARCHAR(20) NOT NULL,
      sortOrder INT NOT NULL DEFAULT 0,
      isActive TINYINT(1) NOT NULL DEFAULT 1,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      UNIQUE KEY uq_boards_code (code)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  console.log("— tq_student_contexts");
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS tq_student_contexts (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      studentId INT NOT NULL,
      boardId INT NOT NULL,
      classId INT NOT NULL,
      isPrimary TINYINT(1) NOT NULL DEFAULT 0,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      UNIQUE KEY uq_context (studentId, boardId, classId),
      KEY idx_contexts_student (studentId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  console.log("— tq_chapter_tests");
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS tq_chapter_tests (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      chapterId INT NOT NULL,
      testId INT NOT NULL,
      sortOrder INT NOT NULL DEFAULT 0,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      UNIQUE KEY uq_chapter_test (chapterId, testId),
      KEY idx_ct_test (testId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  console.log("— tq_videos");
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS tq_videos (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      boardId INT NOT NULL,
      classId INT NOT NULL,
      subjectId INT NOT NULL,
      chapterId INT NULL,
      title VARCHAR(300) NOT NULL,
      description TEXT NULL,
      provider ENUM('YOUTUBE') NOT NULL DEFAULT 'YOUTUBE',
      videoRef VARCHAR(20) NOT NULL,
      durationSeconds INT NULL,
      sortOrder INT NOT NULL DEFAULT 0,
      isActive TINYINT(1) NOT NULL DEFAULT 1,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      KEY idx_videos_scope (boardId, classId, subjectId),
      KEY idx_videos_chapter (chapterId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  console.log("— tq_free_tests");
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS tq_free_tests (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      boardId INT NOT NULL,
      classId INT NOT NULL,
      subjectId INT NOT NULL,
      testId INT NOT NULL,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      UNIQUE KEY uq_free_test_scope (boardId, classId, subjectId),
      KEY idx_free_tests_test (testId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  console.log("— tq_b2c_plans");
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS tq_b2c_plans (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      boardId INT NOT NULL,
      classId INT NOT NULL,
      subjectId INT NULL,
      durationMonths INT NOT NULL,
      price DECIMAL(10,2) NOT NULL,
      isActive TINYINT(1) NOT NULL DEFAULT 1,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      UNIQUE KEY uq_plan (boardId, classId, subjectId, durationMonths)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  console.log("— tq_class_access");
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS tq_class_access (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      studentId INT NOT NULL,
      boardId INT NOT NULL,
      classId INT NOT NULL,
      planId INT NOT NULL,
      orderId INT NOT NULL,
      startsAt DATETIME(3) NOT NULL,
      expiresAt DATETIME(3) NOT NULL,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      KEY idx_ca_student (studentId, expiresAt),
      KEY idx_ca_scope (boardId, classId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  console.log("— tq_events");
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS tq_events (
      id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      studentId INT NULL,
      name VARCHAR(80) NOT NULL,
      properties JSON NULL,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      KEY idx_events_name_time (name, createdAt)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  console.log("— ALTER tq_chapters (+boardId, +classId)");
  if (!(await columnExists("tq_chapters", "boardId"))) {
    await prisma.$executeRawUnsafe(`ALTER TABLE tq_chapters ADD COLUMN boardId INT NULL AFTER id`);
  }
  if (!(await columnExists("tq_chapters", "classId"))) {
    await prisma.$executeRawUnsafe(`ALTER TABLE tq_chapters ADD COLUMN classId INT NULL AFTER boardId`);
  }

  console.log("— ALTER tq_orders (+planId, itemType += B2C_PLAN)");
  if (!(await columnExists("tq_orders", "planId"))) {
    await prisma.$executeRawUnsafe(`ALTER TABLE tq_orders ADD COLUMN planId INT NULL AFTER bundleId`);
  }
  // Extend the native enum only if B2C_PLAN is not already present
  const col = await prisma.$queryRawUnsafe<Array<{ COLUMN_TYPE: string }>>(
    `SELECT COLUMN_TYPE FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tq_orders' AND COLUMN_NAME = 'itemType'`,
  );
  if (col.length && !col[0].COLUMN_TYPE.includes("B2C_PLAN")) {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE tq_orders MODIFY COLUMN itemType ENUM('TEST','BUNDLE','ORG_SUB','B2C_PLAN') NOT NULL`,
    );
  }

  // tq_chapters.subjectId must carry the LEGACY subject id (vw_subjects) —
  // the tq_subjects mirror is empty (content migration was rolled back; the
  // app reads legacy via views). Drop the FK, same precedent as
  // drop-test-fks.ts / drop-bundle-test-fk.ts.
  console.log("— DROP FK tq_chapters_subjectId_fkey");
  const fk = await prisma.$queryRawUnsafe<Array<{ c: bigint }>>(
    `SELECT COUNT(*) AS c FROM information_schema.TABLE_CONSTRAINTS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tq_chapters'
       AND CONSTRAINT_NAME = 'tq_chapters_subjectId_fkey'`,
  );
  if (Number(fk[0].c) > 0) {
    await prisma.$executeRawUnsafe(`ALTER TABLE tq_chapters DROP FOREIGN KEY tq_chapters_subjectId_fkey`);
  }

  console.log("Migration 21 complete.");
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
