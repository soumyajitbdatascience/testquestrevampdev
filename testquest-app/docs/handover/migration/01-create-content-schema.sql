-- ============================================================================
-- Testquest — New clean database: content-layer schema
-- Run this ONCE, on the NEW database only:  u710649289_TquestTestEnv
-- (In phpMyAdmin: select that database on the left FIRST, then run this.)
--
-- Covers the whole content/curriculum layer, ending at tq_free_tests.
-- Commerce (subscriptions, coupons, payments) and student/attempt tables
-- are NOT here — they come in a later step.
--
-- Charset utf8mb4 = full Unicode (safe for regional languages later).
-- Tables are created parents-first so the foreign keys line up.
-- ============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ---------------------------------------------------------------------------
-- 1. MASTERS
-- ---------------------------------------------------------------------------

-- Boards: the exam boards a student picks first (CBSE, ICSE, state boards…)
CREATE TABLE IF NOT EXISTS tq_boards (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  name      VARCHAR(100) NOT NULL,
  code      VARCHAR(20)  NOT NULL,
  sortOrder INT NOT NULL DEFAULT 0,
  isActive  TINYINT(1) NOT NULL DEFAULT 1,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_board_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Classes: shared list, one row per class (Class 6…12). No board here.
CREATE TABLE IF NOT EXISTS tq_classes (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  name      VARCHAR(100) NOT NULL,
  sortOrder INT NOT NULL DEFAULT 0,
  isActive  TINYINT(1) NOT NULL DEFAULT 1,
  legacyId  INT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_class_legacy (legacyId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Subjects: shared list, one row per subject (Mathematics, Science…). No class here.
CREATE TABLE IF NOT EXISTS tq_subjects (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  name      VARCHAR(200) NOT NULL,
  sortOrder INT NOT NULL DEFAULT 0,
  isActive  TINYINT(1) NOT NULL DEFAULT 1,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Migration helper: maps many OLD subject ids -> one clean new subject.
-- Used when re-linking questions during the Subjects cleaning step.
CREATE TABLE IF NOT EXISTS tq_subject_legacy_map (
  legacyId  INT NOT NULL PRIMARY KEY,   -- old subjects.subjects_id
  subjectId INT NOT NULL,               -- new tq_subjects.id
  CONSTRAINT fk_sublegacy_subject FOREIGN KEY (subjectId) REFERENCES tq_subjects(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 2. MAPS
-- ---------------------------------------------------------------------------

-- Which classes each board offers.
CREATE TABLE IF NOT EXISTS tq_board_classes (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  boardId   INT NOT NULL,
  classId   INT NOT NULL,
  sortOrder INT NOT NULL DEFAULT 0,
  isActive  TINYINT(1) NOT NULL DEFAULT 1,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_board_class (boardId, classId),
  CONSTRAINT fk_bc_board FOREIGN KEY (boardId) REFERENCES tq_boards(id),
  CONSTRAINT fk_bc_class FOREIGN KEY (classId) REFERENCES tq_classes(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 3. OFFERINGS  (the "shelf": one row per real Board + Class + Subject)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS tq_offerings (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  boardId   INT NOT NULL,
  classId   INT NOT NULL,
  subjectId INT NOT NULL,
  isActive  TINYINT(1) NOT NULL DEFAULT 1,
  sortOrder INT NOT NULL DEFAULT 0,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_offering (boardId, classId, subjectId),
  CONSTRAINT fk_off_board   FOREIGN KEY (boardId)   REFERENCES tq_boards(id),
  CONSTRAINT fk_off_class   FOREIGN KEY (classId)   REFERENCES tq_classes(id),
  CONSTRAINT fk_off_subject FOREIGN KEY (subjectId) REFERENCES tq_subjects(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 4. CONTENT  (everything attaches to an OFFERING, never a bare master)
-- ---------------------------------------------------------------------------

-- Chapters belong to one offering, in syllabus order.
CREATE TABLE IF NOT EXISTS tq_chapters (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  offeringId INT NOT NULL,
  name      VARCHAR(300) NOT NULL,
  sortOrder INT NOT NULL DEFAULT 0,
  isActive  TINYINT(1) NOT NULL DEFAULT 1,
  legacyId  INT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_chapter_offering (offeringId),
  CONSTRAINT fk_chapter_offering FOREIGN KEY (offeringId) REFERENCES tq_offerings(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Questions: the shared bank. Belong to a subject (master), optionally to a chapter.
CREATE TABLE IF NOT EXISTS tq_questions (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  subjectId   INT NOT NULL,
  chapterId   INT NULL,
  type        ENUM('SINGLE_MCQ','MULTI_MCQ','FILL_IN_BLANK','PARAGRAPH','SUBJECTIVE') NOT NULL,
  difficulty  ENUM('EASY','MEDIUM','HARD') NOT NULL DEFAULT 'MEDIUM',
  text        TEXT NOT NULL,
  explanation TEXT NULL,
  correctText TEXT NULL,            -- for fill-in-the-blank / subjective
  marks       INT NOT NULL DEFAULT 1,
  isLegacy    TINYINT(1) NOT NULL DEFAULT 0,
  legacyId    INT NULL,
  isActive    TINYINT(1) NOT NULL DEFAULT 1,
  createdAt   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_question_legacy (legacyId),
  KEY idx_q_subject (subjectId),
  KEY idx_q_chapter (chapterId),
  CONSTRAINT fk_q_subject FOREIGN KEY (subjectId) REFERENCES tq_subjects(id),
  CONSTRAINT fk_q_chapter FOREIGN KEY (chapterId) REFERENCES tq_chapters(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Options: the answer choices for a question, in A/B/C/D order.
CREATE TABLE IF NOT EXISTS tq_question_options (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  questionId INT NOT NULL,
  label      VARCHAR(10) NOT NULL,   -- A, B, C, D
  text       TEXT NOT NULL,
  isCorrect  TINYINT(1) NOT NULL DEFAULT 0,
  sortOrder  INT NOT NULL DEFAULT 0,
  KEY idx_opt_question (questionId),
  CONSTRAINT fk_opt_question FOREIGN KEY (questionId) REFERENCES tq_questions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tests belong to one offering.
CREATE TABLE IF NOT EXISTS tq_tests (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  offeringId      INT NOT NULL,
  name            VARCHAR(300) NOT NULL,
  description     TEXT NULL,
  durationMinutes INT NOT NULL DEFAULT 0,
  totalMarks      INT NOT NULL DEFAULT 0,
  isFree          TINYINT(1) NOT NULL DEFAULT 0,
  price           DECIMAL(10,2) NOT NULL DEFAULT 0,
  isPractice      TINYINT(1) NOT NULL DEFAULT 0,
  isActive        TINYINT(1) NOT NULL DEFAULT 1,
  isLegacy        TINYINT(1) NOT NULL DEFAULT 0,
  legacyId        INT NULL,
  createdAt       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_test_legacy (legacyId),
  KEY idx_test_offering (offeringId),
  CONSTRAINT fk_test_offering FOREIGN KEY (offeringId) REFERENCES tq_offerings(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Which questions are in which test (shared bank <-> tests, many-to-many).
CREATE TABLE IF NOT EXISTS tq_test_questions (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  testId     INT NOT NULL,
  questionId INT NOT NULL,
  sortOrder  INT NOT NULL DEFAULT 0,
  UNIQUE KEY uq_test_question (testId, questionId),
  KEY idx_tq_question (questionId),
  CONSTRAINT fk_tq_test     FOREIGN KEY (testId)     REFERENCES tq_tests(id) ON DELETE CASCADE,
  CONSTRAINT fk_tq_question FOREIGN KEY (questionId) REFERENCES tq_questions(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- The one free sample test per offering.
CREATE TABLE IF NOT EXISTS tq_free_tests (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  offeringId INT NOT NULL,
  testId     INT NOT NULL,
  createdAt  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_free_offering (offeringId),
  CONSTRAINT fk_free_offering FOREIGN KEY (offeringId) REFERENCES tq_offerings(id),
  CONSTRAINT fk_free_test     FOREIGN KEY (testId)     REFERENCES tq_tests(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================================
-- SEED: the 4 boards + 7 classes + the class map for the content board (CBSE)
-- (Boards/classes are small and hand-curated, so we seed them here.
--  Subjects, chapters, questions, tests get filled by the cleaning step.)
-- ============================================================================

INSERT INTO tq_boards (name, code, sortOrder, isActive) VALUES
('CBSE',               'CBSE',  1, 1),
('ICSE',               'ICSE',  2, 1),
('State Board',        'STATE', 3, 1),
('Odisha State Board', 'OSB',   4, 1);

INSERT INTO tq_classes (name, sortOrder, isActive, legacyId) VALUES
('Class 6',  6, 1, 42),
('Class 7',  7, 1, 43),
('Class 8',  8, 1, 37),
('Class 9',  9, 1, 44),
('Class 10',10, 1, 45),
('Class 11',11, 1, 46),
('Class 12',12, 1, 36);

-- Map all 7 classes to the CONTENT board (CBSE by default).
-- Change 'CBSE' if your existing question bank belongs to a different board.
INSERT INTO tq_board_classes (boardId, classId, sortOrder, isActive)
SELECT (SELECT id FROM tq_boards WHERE code = 'CBSE'), c.id, c.sortOrder, 1
FROM tq_classes c;

-- ============================================================================
-- QUICK CHECKS
-- ============================================================================
-- SELECT COUNT(*) FROM tq_boards;         -- expect 4
-- SELECT COUNT(*) FROM tq_classes;        -- expect 7
-- SELECT b.name AS board, c.name AS class, c.sortOrder
--   FROM tq_board_classes bc
--   JOIN tq_boards  b ON b.id = bc.boardId
--   JOIN tq_classes c ON c.id = bc.classId
--   ORDER BY b.name, c.sortOrder;         -- expect CBSE · Class 6…12
