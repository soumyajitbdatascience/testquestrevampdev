-- CreateTable
CREATE TABLE `tq_classes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tq_subjects` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `classId` INTEGER NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tq_chapters` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `subjectId` INTEGER NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tq_questions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `chapterId` INTEGER NOT NULL,
    `type` ENUM('SINGLE_MCQ', 'MULTI_MCQ', 'FILL_IN_BLANK') NOT NULL,
    `difficulty` ENUM('EASY', 'MEDIUM', 'HARD') NOT NULL DEFAULT 'MEDIUM',
    `text` TEXT NOT NULL,
    `explanation` TEXT NULL,
    `correctText` VARCHAR(500) NULL,
    `marks` INTEGER NOT NULL DEFAULT 1,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `tq_questions_chapterId_idx`(`chapterId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tq_question_options` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `questionId` INTEGER NOT NULL,
    `label` VARCHAR(10) NOT NULL,
    `text` TEXT NOT NULL,
    `isCorrect` BOOLEAN NOT NULL DEFAULT false,

    INDEX `tq_question_options_questionId_idx`(`questionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tq_tests` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `classId` INTEGER NOT NULL,
    `subjectId` INTEGER NOT NULL,
    `name` VARCHAR(300) NOT NULL,
    `description` TEXT NULL,
    `durationMinutes` INTEGER NOT NULL,
    `totalMarks` INTEGER NOT NULL,
    `isFree` BOOLEAN NOT NULL DEFAULT false,
    `price` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `isPractice` BOOLEAN NOT NULL DEFAULT false,
    `randomizeQuestions` BOOLEAN NOT NULL DEFAULT true,
    `randomizeOptions` BOOLEAN NOT NULL DEFAULT true,
    `retakeCooldownDays` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `tq_tests_classId_idx`(`classId`),
    INDEX `tq_tests_subjectId_idx`(`subjectId`),
    INDEX `tq_tests_isFree_idx`(`isFree`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tq_test_questions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `testId` INTEGER NOT NULL,
    `questionId` INTEGER NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,

    UNIQUE INDEX `tq_test_questions_testId_questionId_key`(`testId`, `questionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tq_students` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(200) NOT NULL,
    `email` VARCHAR(200) NOT NULL,
    `mobile` VARCHAR(20) NULL,
    `passwordHash` VARCHAR(255) NULL,
    `googleId` VARCHAR(100) NULL,
    `avatarUrl` VARCHAR(500) NULL,
    `classId` INTEGER NULL,
    `board` VARCHAR(50) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `tq_students_email_key`(`email`),
    UNIQUE INDEX `tq_students_googleId_key`(`googleId`),
    INDEX `tq_students_classId_idx`(`classId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tq_admins` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(200) NOT NULL,
    `email` VARCHAR(200) NOT NULL,
    `passwordHash` VARCHAR(255) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `tq_admins_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tq_attempts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `studentId` INTEGER NOT NULL,
    `testId` INTEGER NOT NULL,
    `status` ENUM('IN_PROGRESS', 'PAUSED', 'COMPLETED', 'AUTO_SUBMITTED') NOT NULL DEFAULT 'IN_PROGRESS',
    `isPractice` BOOLEAN NOT NULL DEFAULT false,
    `questionOrder` TEXT NOT NULL,
    `score` INTEGER NULL,
    `totalMarks` INTEGER NOT NULL,
    `percentage` DECIMAL(5, 2) NULL,
    `timeSpentSeconds` INTEGER NOT NULL DEFAULT 0,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `finishedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `tq_attempts_studentId_idx`(`studentId`),
    INDEX `tq_attempts_testId_idx`(`testId`),
    INDEX `tq_attempts_studentId_testId_idx`(`studentId`, `testId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tq_attempt_answers` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `attemptId` INTEGER NOT NULL,
    `questionId` INTEGER NOT NULL,
    `selectedOptionId` INTEGER NULL,
    `fillAnswer` VARCHAR(500) NULL,
    `isCorrect` BOOLEAN NULL,
    `marksAwarded` INTEGER NOT NULL DEFAULT 0,
    `isFlagged` BOOLEAN NOT NULL DEFAULT false,
    `answeredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `tq_attempt_answers_attemptId_questionId_key`(`attemptId`, `questionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tq_bundles` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(300) NOT NULL,
    `description` TEXT NULL,
    `price` DECIMAL(10, 2) NOT NULL,
    `validityDays` INTEGER NOT NULL,
    `classId` INTEGER NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tq_bundle_tests` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `bundleId` INTEGER NOT NULL,
    `testId` INTEGER NOT NULL,

    UNIQUE INDEX `tq_bundle_tests_bundleId_testId_key`(`bundleId`, `testId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tq_coupons` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(50) NOT NULL,
    `discountType` ENUM('PERCENTAGE', 'FLAT') NOT NULL,
    `discountValue` DECIMAL(10, 2) NOT NULL,
    `maxDiscountCap` DECIMAL(10, 2) NULL,
    `minOrderValue` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `scope` ENUM('ALL', 'BUNDLE_ONLY', 'FIRST_TIME') NOT NULL DEFAULT 'ALL',
    `bundleId` INTEGER NULL,
    `totalUsageLimit` INTEGER NULL,
    `perUserLimit` INTEGER NOT NULL DEFAULT 1,
    `validFrom` DATETIME(3) NOT NULL,
    `validUntil` DATETIME(3) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `tq_coupons_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tq_coupon_usages` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `couponId` INTEGER NOT NULL,
    `studentId` INTEGER NOT NULL,
    `orderId` INTEGER NOT NULL,
    `usedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `tq_coupon_usages_couponId_studentId_idx`(`couponId`, `studentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tq_orders` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `studentId` INTEGER NOT NULL,
    `itemType` ENUM('TEST', 'BUNDLE') NOT NULL,
    `testId` INTEGER NULL,
    `bundleId` INTEGER NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `discount` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `finalAmount` DECIMAL(10, 2) NOT NULL,
    `couponCode` VARCHAR(50) NULL,
    `razorpayOrderId` VARCHAR(100) NULL,
    `razorpayPaymentId` VARCHAR(100) NULL,
    `razorpaySignature` VARCHAR(255) NULL,
    `status` ENUM('PENDING', 'PAID', 'FAILED', 'REFUNDED') NOT NULL DEFAULT 'PENDING',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `tq_orders_studentId_idx`(`studentId`),
    INDEX `tq_orders_razorpayOrderId_idx`(`razorpayOrderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tq_student_access` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `studentId` INTEGER NOT NULL,
    `testId` INTEGER NOT NULL,
    `orderId` INTEGER NULL,
    `expiresAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `tq_student_access_expiresAt_idx`(`expiresAt`),
    UNIQUE INDEX `tq_student_access_studentId_testId_key`(`studentId`, `testId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tq_settings` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `key` VARCHAR(100) NOT NULL,
    `value` TEXT NOT NULL,

    UNIQUE INDEX `tq_settings_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tq_password_reset_tokens` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(200) NOT NULL,
    `token` VARCHAR(255) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `usedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `tq_password_reset_tokens_token_key`(`token`),
    INDEX `tq_password_reset_tokens_email_idx`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `tq_subjects` ADD CONSTRAINT `tq_subjects_classId_fkey` FOREIGN KEY (`classId`) REFERENCES `tq_classes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tq_chapters` ADD CONSTRAINT `tq_chapters_subjectId_fkey` FOREIGN KEY (`subjectId`) REFERENCES `tq_subjects`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tq_questions` ADD CONSTRAINT `tq_questions_chapterId_fkey` FOREIGN KEY (`chapterId`) REFERENCES `tq_chapters`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tq_question_options` ADD CONSTRAINT `tq_question_options_questionId_fkey` FOREIGN KEY (`questionId`) REFERENCES `tq_questions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tq_tests` ADD CONSTRAINT `tq_tests_classId_fkey` FOREIGN KEY (`classId`) REFERENCES `tq_classes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tq_tests` ADD CONSTRAINT `tq_tests_subjectId_fkey` FOREIGN KEY (`subjectId`) REFERENCES `tq_subjects`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tq_test_questions` ADD CONSTRAINT `tq_test_questions_testId_fkey` FOREIGN KEY (`testId`) REFERENCES `tq_tests`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tq_test_questions` ADD CONSTRAINT `tq_test_questions_questionId_fkey` FOREIGN KEY (`questionId`) REFERENCES `tq_questions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tq_students` ADD CONSTRAINT `tq_students_classId_fkey` FOREIGN KEY (`classId`) REFERENCES `tq_classes`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tq_attempts` ADD CONSTRAINT `tq_attempts_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `tq_students`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tq_attempts` ADD CONSTRAINT `tq_attempts_testId_fkey` FOREIGN KEY (`testId`) REFERENCES `tq_tests`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tq_attempt_answers` ADD CONSTRAINT `tq_attempt_answers_attemptId_fkey` FOREIGN KEY (`attemptId`) REFERENCES `tq_attempts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tq_attempt_answers` ADD CONSTRAINT `tq_attempt_answers_selectedOptionId_fkey` FOREIGN KEY (`selectedOptionId`) REFERENCES `tq_question_options`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tq_bundles` ADD CONSTRAINT `tq_bundles_classId_fkey` FOREIGN KEY (`classId`) REFERENCES `tq_classes`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tq_bundle_tests` ADD CONSTRAINT `tq_bundle_tests_bundleId_fkey` FOREIGN KEY (`bundleId`) REFERENCES `tq_bundles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tq_bundle_tests` ADD CONSTRAINT `tq_bundle_tests_testId_fkey` FOREIGN KEY (`testId`) REFERENCES `tq_tests`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tq_coupon_usages` ADD CONSTRAINT `tq_coupon_usages_couponId_fkey` FOREIGN KEY (`couponId`) REFERENCES `tq_coupons`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tq_coupon_usages` ADD CONSTRAINT `tq_coupon_usages_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `tq_students`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tq_coupon_usages` ADD CONSTRAINT `tq_coupon_usages_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `tq_orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tq_orders` ADD CONSTRAINT `tq_orders_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `tq_students`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tq_orders` ADD CONSTRAINT `tq_orders_testId_fkey` FOREIGN KEY (`testId`) REFERENCES `tq_tests`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tq_orders` ADD CONSTRAINT `tq_orders_bundleId_fkey` FOREIGN KEY (`bundleId`) REFERENCES `tq_bundles`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tq_student_access` ADD CONSTRAINT `tq_student_access_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `tq_students`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tq_student_access` ADD CONSTRAINT `tq_student_access_testId_fkey` FOREIGN KEY (`testId`) REFERENCES `tq_tests`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

