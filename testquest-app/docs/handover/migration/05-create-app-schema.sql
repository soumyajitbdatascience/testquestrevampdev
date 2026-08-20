-- ============================================================================
-- Testquest — New clean DB: app-layer schema (commerce, people, activity)
-- Run on:  u710649289_TquestTestEnv   (AFTER 01-create-content-schema.sql)
-- Completes the schema so the whole app can run on the new database.
-- Students start EMPTY (signups populate tq_students).
-- ============================================================================
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ── Admins ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tq_admins (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  email        VARCHAR(255) NOT NULL,
  passwordHash VARCHAR(255) NOT NULL,
  name         VARCHAR(150) NULL,
  isActive     TINYINT(1) NOT NULL DEFAULT 1,
  createdAt    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_admin_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Students (start empty; signups fill this) ───────────────────────────
CREATE TABLE IF NOT EXISTS tq_students (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(150) NOT NULL,
  email         VARCHAR(255) NOT NULL,
  passwordHash  VARCHAR(255) NULL,          -- null for Google-only accounts
  mobile        VARCHAR(20) NULL,
  googleId      VARCHAR(255) NULL,
  emailVerified TINYINT(1) NOT NULL DEFAULT 0,
  isActive      TINYINT(1) NOT NULL DEFAULT 1,
  createdAt     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_student_email (email),
  UNIQUE KEY uq_student_google (googleId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Which board+class contexts a student picked at onboarding (up to 2, editable)
CREATE TABLE IF NOT EXISTS tq_student_contexts (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  studentId INT NOT NULL,
  boardId   INT NOT NULL,
  classId   INT NOT NULL,
  isPrimary TINYINT(1) NOT NULL DEFAULT 0,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_ctx (studentId, boardId, classId),
  CONSTRAINT fk_ctx_student FOREIGN KEY (studentId) REFERENCES tq_students(id) ON DELETE CASCADE,
  CONSTRAINT fk_ctx_board   FOREIGN KEY (boardId)   REFERENCES tq_boards(id),
  CONSTRAINT fk_ctx_class   FOREIGN KEY (classId)   REFERENCES tq_classes(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Videos (YouTube unlisted, attached to an offering / chapter) ────────
CREATE TABLE IF NOT EXISTS tq_videos (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  offeringId      INT NOT NULL,
  chapterId       INT NULL,                 -- null = subject-level (no chapter)
  provider        ENUM('YOUTUBE') NOT NULL DEFAULT 'YOUTUBE',
  videoRef        VARCHAR(32) NOT NULL,      -- YouTube id only, never the URL
  title           VARCHAR(300) NOT NULL,
  description     TEXT NULL,
  durationSeconds INT NULL,
  sortOrder       INT NOT NULL DEFAULT 0,
  isActive        TINYINT(1) NOT NULL DEFAULT 1,
  createdAt       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_video_offering (offeringId),
  CONSTRAINT fk_video_offering FOREIGN KEY (offeringId) REFERENCES tq_offerings(id),
  CONSTRAINT fk_video_chapter  FOREIGN KEY (chapterId)  REFERENCES tq_chapters(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Plans (prepaid Board+Class passes, 3/6/12 months) ───────────────────
CREATE TABLE IF NOT EXISTS tq_b2c_plans (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  boardId        INT NOT NULL,
  classId        INT NOT NULL,
  subjectId      INT NULL,                  -- NULL now; reserved for future subject-level plans
  durationMonths INT NOT NULL,              -- 3, 6, or 12
  price          DECIMAL(10,2) NOT NULL,
  isActive       TINYINT(1) NOT NULL DEFAULT 1,
  createdAt      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_plan (boardId, classId, subjectId, durationMonths),
  CONSTRAINT fk_plan_board   FOREIGN KEY (boardId)   REFERENCES tq_boards(id),
  CONSTRAINT fk_plan_class   FOREIGN KEY (classId)   REFERENCES tq_classes(id),
  CONSTRAINT fk_plan_subject FOREIGN KEY (subjectId) REFERENCES tq_subjects(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Coupons ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tq_coupons (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  code         VARCHAR(50) NOT NULL,
  discountType ENUM('PERCENT','FLAT') NOT NULL,
  discountValue DECIMAL(10,2) NOT NULL,
  minOrder     DECIMAL(10,2) NOT NULL DEFAULT 0,
  maxDiscount  DECIMAL(10,2) NULL,
  validFrom    DATETIME NULL,
  validUntil   DATETIME NULL,
  totalLimit   INT NULL,
  perUserLimit INT NULL,
  scope        VARCHAR(50) NOT NULL DEFAULT 'ALL',
  isActive     TINYINT(1) NOT NULL DEFAULT 1,
  createdAt    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_coupon_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Orders (payments) ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tq_orders (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  studentId         INT NOT NULL,
  itemType          ENUM('B2C_PLAN') NOT NULL DEFAULT 'B2C_PLAN',
  planId            INT NULL,
  boardId           INT NULL,               -- snapshot of what was bought
  classId           INT NULL,
  amount            DECIMAL(10,2) NOT NULL,
  discount          DECIMAL(10,2) NOT NULL DEFAULT 0,
  finalAmount       DECIMAL(10,2) NOT NULL,
  couponCode        VARCHAR(50) NULL,
  status            ENUM('PENDING','PAID','FAILED') NOT NULL DEFAULT 'PENDING',
  razorpayOrderId   VARCHAR(100) NULL,
  razorpayPaymentId VARCHAR(100) NULL,
  razorpaySignature VARCHAR(255) NULL,
  createdAt         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_order_student (studentId),
  KEY idx_order_rzp (razorpayOrderId),
  CONSTRAINT fk_order_student FOREIGN KEY (studentId) REFERENCES tq_students(id),
  CONSTRAINT fk_order_plan    FOREIGN KEY (planId)    REFERENCES tq_b2c_plans(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Class access (the pass a student holds) ─────────────────────────────
CREATE TABLE IF NOT EXISTS tq_class_access (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  studentId INT NOT NULL,
  boardId   INT NOT NULL,
  classId   INT NOT NULL,
  planId    INT NULL,
  orderId   INT NULL,
  startsAt  DATETIME NOT NULL,
  expiresAt DATETIME NOT NULL,              -- active = expiresAt > now
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_access_student (studentId),
  KEY idx_access_active (studentId, boardId, classId, expiresAt),
  CONSTRAINT fk_access_student FOREIGN KEY (studentId) REFERENCES tq_students(id) ON DELETE CASCADE,
  CONSTRAINT fk_access_board   FOREIGN KEY (boardId)   REFERENCES tq_boards(id),
  CONSTRAINT fk_access_class   FOREIGN KEY (classId)   REFERENCES tq_classes(id),
  CONSTRAINT fk_access_plan    FOREIGN KEY (planId)    REFERENCES tq_b2c_plans(id),
  CONSTRAINT fk_access_order   FOREIGN KEY (orderId)   REFERENCES tq_orders(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Coupon usages ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tq_coupon_usages (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  couponId  INT NOT NULL,
  studentId INT NOT NULL,
  orderId   INT NOT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_cu_coupon  FOREIGN KEY (couponId)  REFERENCES tq_coupons(id),
  CONSTRAINT fk_cu_student FOREIGN KEY (studentId) REFERENCES tq_students(id),
  CONSTRAINT fk_cu_order   FOREIGN KEY (orderId)   REFERENCES tq_orders(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Razorpay webhook idempotency log ────────────────────────────────────
CREATE TABLE IF NOT EXISTS tq_webhook_events (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  eventId   VARCHAR(120) NOT NULL,
  eventType VARCHAR(80) NOT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_webhook_event (eventId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Attempts (student sits a test) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS tq_attempts (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  studentId        INT NOT NULL,
  testId           INT NOT NULL,
  status           ENUM('IN_PROGRESS','COMPLETED') NOT NULL DEFAULT 'IN_PROGRESS',
  score            INT NOT NULL DEFAULT 0,
  totalMarks       INT NOT NULL DEFAULT 0,
  correctCount     INT NOT NULL DEFAULT 0,
  wrongCount       INT NOT NULL DEFAULT 0,
  unansweredCount  INT NOT NULL DEFAULT 0,
  startedAt        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finishedAt       DATETIME NULL,
  timeSpentSeconds INT NOT NULL DEFAULT 0,
  createdAt        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_attempt_student (studentId),
  KEY idx_attempt_test (testId),
  CONSTRAINT fk_attempt_student FOREIGN KEY (studentId) REFERENCES tq_students(id),
  CONSTRAINT fk_attempt_test    FOREIGN KEY (testId)    REFERENCES tq_tests(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tq_attempt_answers (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  attemptId        INT NOT NULL,
  questionId       INT NOT NULL,
  selectedOptionIds JSON NULL,              -- array of chosen tq_question_options.id
  isCorrect        TINYINT(1) NULL,
  marksAwarded     INT NOT NULL DEFAULT 0,
  answeredAt       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_attempt_question (attemptId, questionId),
  CONSTRAINT fk_ans_attempt  FOREIGN KEY (attemptId)  REFERENCES tq_attempts(id) ON DELETE CASCADE,
  CONSTRAINT fk_ans_question FOREIGN KEY (questionId) REFERENCES tq_questions(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Analytics events ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tq_events (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  studentId  INT NULL,
  name       VARCHAR(80) NOT NULL,
  properties JSON NULL,
  createdAt  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_event_name (name, createdAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Email verification + password reset tokens ──────────────────────────
CREATE TABLE IF NOT EXISTS tq_email_tokens (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  studentId INT NOT NULL,
  token     VARCHAR(120) NOT NULL,
  type      ENUM('VERIFY','RESET') NOT NULL,
  expiresAt DATETIME NOT NULL,
  usedAt    DATETIME NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_email_token (token),
  CONSTRAINT fk_tok_student FOREIGN KEY (studentId) REFERENCES tq_students(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Key/value settings ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tq_settings (
  settingKey   VARCHAR(80) PRIMARY KEY,
  settingValue TEXT NULL,
  updatedAt    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- ── Seed one admin so you can log in (CHANGE THE HASH before production) ──
-- Password hash is a bcrypt placeholder; replace with a real one, or have the
-- app create the first admin. Example email below.
-- INSERT INTO tq_admins (email, passwordHash, name) VALUES
-- ('admin@testquest.in', '$2b$10$REPLACE_WITH_REAL_BCRYPT_HASH', 'Admin');
