-- =====================================================================
-- Read-only MySQL VIEWs over the legacy Testquest tables.
--
-- These present legacy data in the shape the new Next.js app expects.
-- They do NOT modify any legacy table — they're CREATE OR REPLACE VIEW only.
--
-- Naming: vw_<entity> (e.g. vw_classes). Each view's columns follow the
-- camelCase convention used by Prisma so downstream queries are clean.
--
-- All views filter to languages_id = 3 (English) for i18n fields.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Classes
-- Source: catigories + catigories_description (English)
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_classes AS
SELECT
  c.categories_id                                    AS id,
  COALESCE(cd.categories_name, CONCAT('Class ', c.categories_id))  AS name,
  c.categories_status                                AS rawStatus,
  (c.categories_status = 1)                          AS isActive,
  c.categories_id                                    AS sortOrder
FROM catigories c
LEFT JOIN catigories_description cd
  ON cd.categories_id = c.categories_id AND cd.languages_id = 3;


-- ---------------------------------------------------------------------
-- 2. Subjects
-- Source: subjects + subjects_description (English)
-- classId is derived: subcategories first, then main_exam usage, fallback NULL
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_subjects AS
SELECT
  s.subjects_id                                      AS id,
  COALESCE(NULLIF(sd.subject_name, ''),
           NULLIF(s.Temp_Subject_Name, ''),
           'Subject')                                AS name,
  sd.subject_description                             AS description,
  COALESCE(
    (SELECT sc.categories_id FROM subcategories sc
       WHERE sc.subjects_id = s.subjects_id LIMIT 1),
    (SELECT me.category_id FROM main_exam me
       WHERE FIND_IN_SET(s.subjects_id, me.subject_id)
       ORDER BY me.exam_id LIMIT 1)
  )                                                  AS classId,
  s.catg_name                                        AS legacyCatgName,
  s.course_name                                      AS legacyCourseName,
  s.chapter_name                                     AS legacyChapterName,
  s.chapter_title                                    AS legacyChapterTitle,
  (s.subjects_status = 1)                            AS isActive,
  s.subjects_id                                      AS sortOrder
FROM subjects s
LEFT JOIN subjects_description sd
  ON sd.subjects_id = s.subjects_id AND sd.languages_id = 3;


-- ---------------------------------------------------------------------
-- 3. Questions
-- Source: question + question_description (English)
-- type column maps legacy (answer_type, question_type) codes to our enum
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_questions AS
SELECT
  q.question_id                                      AS id,
  q.subjects_id                                      AS subjectId,
  qd.main_question                                   AS text,
  CASE
    WHEN q.answer_type = 101 AND q.question_type = 507 THEN 'FILL_IN_BLANK'
    WHEN q.answer_type = 101 AND q.question_type IN (501, 502, 503) THEN 'PARAGRAPH'
    WHEN q.answer_type = 102 AND q.question_type IN (501, 502, 503) THEN 'PARAGRAPH'
    WHEN q.answer_type = 101 THEN 'SINGLE_MCQ'
    WHEN q.answer_type = 102 THEN 'MULTI_MCQ'
    ELSE 'SINGLE_MCQ'
  END                                                AS type,
  q.answer_type                                      AS legacyAnswerType,
  q.question_type                                    AS legacyQuestionType,
  CASE
    WHEN q.difficulty_level = 1 THEN 'EASY'
    WHEN q.difficulty_level = 3 THEN 'HARD'
    ELSE 'MEDIUM'
  END                                                AS difficulty,
  (q.question_status = 1)                            AS isActive,
  q.create_by                                        AS createdBy
FROM question q
LEFT JOIN question_description qd
  ON qd.question_id = q.question_id AND qd.languages_id = 3;


-- ---------------------------------------------------------------------
-- 4. Question options
-- Pivots question_audio_video_paragraph.options_1..6 into rows.
-- Only English language, only first sub_question_id (we flatten paragraphs).
-- correct_answer like "1,2,,,," → marks position-N as correct.
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_question_options AS
  SELECT
    (qavp.id * 10 + 1)                               AS id,
    qavp.question_id                                 AS questionId,
    'A'                                              AS label,
    qavp.options_1                                   AS text,
    (FIND_IN_SET('1', qavp.correct_answer) > 0)      AS isCorrect,
    1                                                AS sortOrder
  FROM question_audio_video_paragraph qavp
  WHERE qavp.languages_id = 3
    AND qavp.sub_question_id = 0
    AND qavp.options_1 IS NOT NULL AND qavp.options_1 != ''
  UNION ALL
  SELECT (qavp.id * 10 + 2), qavp.question_id, 'B', qavp.options_2,
         (FIND_IN_SET('2', qavp.correct_answer) > 0), 2
  FROM question_audio_video_paragraph qavp
  WHERE qavp.languages_id = 3 AND qavp.sub_question_id = 0
    AND qavp.options_2 IS NOT NULL AND qavp.options_2 != ''
  UNION ALL
  SELECT (qavp.id * 10 + 3), qavp.question_id, 'C', qavp.options_3,
         (FIND_IN_SET('3', qavp.correct_answer) > 0), 3
  FROM question_audio_video_paragraph qavp
  WHERE qavp.languages_id = 3 AND qavp.sub_question_id = 0
    AND qavp.options_3 IS NOT NULL AND qavp.options_3 != ''
  UNION ALL
  SELECT (qavp.id * 10 + 4), qavp.question_id, 'D', qavp.options_4,
         (FIND_IN_SET('4', qavp.correct_answer) > 0), 4
  FROM question_audio_video_paragraph qavp
  WHERE qavp.languages_id = 3 AND qavp.sub_question_id = 0
    AND qavp.options_4 IS NOT NULL AND qavp.options_4 != ''
  UNION ALL
  SELECT (qavp.id * 10 + 5), qavp.question_id, 'E', qavp.options_5,
         (FIND_IN_SET('5', qavp.correct_answer) > 0), 5
  FROM question_audio_video_paragraph qavp
  WHERE qavp.languages_id = 3 AND qavp.sub_question_id = 0
    AND qavp.options_5 IS NOT NULL AND qavp.options_5 != ''
  UNION ALL
  SELECT (qavp.id * 10 + 6), qavp.question_id, 'F', qavp.options_6,
         (FIND_IN_SET('6', qavp.correct_answer) > 0), 6
  FROM question_audio_video_paragraph qavp
  WHERE qavp.languages_id = 3 AND qavp.sub_question_id = 0
    AND qavp.options_6 IS NOT NULL AND qavp.options_6 != '';


-- ---------------------------------------------------------------------
-- 5. Question explanation + marks
-- Side view to fetch per-question explanation + default marks
-- (kept separate so vw_questions stays simple)
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_question_meta AS
SELECT
  qavp.question_id                                   AS questionId,
  qavp.explanation                                   AS explanation,
  COALESCE(qavp.Marks, 1)                            AS marks
FROM question_audio_video_paragraph qavp
WHERE qavp.languages_id = 3 AND qavp.sub_question_id = 0;


-- ---------------------------------------------------------------------
-- 6. Tests (exams)
-- Source: main_exam + main_exam_description (English) + practice_exam
-- Practice exam IDs offset by +1,000,000 to avoid collisions
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_tests AS
SELECT
  me.exam_id                                          AS id,
  COALESCE(med.exam_name, CONCAT('Exam ', me.exam_id)) AS name,
  med.terms_condition                                  AS description,
  me.category_id                                       AS classId,
  CAST(SUBSTRING_INDEX(me.subject_id, ',', 1) AS UNSIGNED) AS subjectId,
  me.exam_duration                                     AS durationMinutes,
  (CAST(me.exam_price AS DECIMAL(10,2)) = 0)           AS isFree,
  CAST(me.exam_price AS DECIMAL(10,2))                 AS price,
  FALSE                                                AS isPractice,
  COALESCE(me.re_exam_day, 0)                          AS retakeCooldownDays,
  (me.exam_status = 1)                                 AS isActive,
  'main'                                               AS source
FROM main_exam me
LEFT JOIN main_exam_description med
  ON med.exam_id = me.exam_id AND med.languages_id = 3
UNION ALL
SELECT
  (pe.exam_id + 1000000)                               AS id,
  COALESCE(ped.exam_name, CONCAT('Practice ', pe.exam_id)) AS name,
  ped.terms_condition                                  AS description,
  pe.category_id                                       AS classId,
  CAST(SUBSTRING_INDEX(pe.subject_id, ',', 1) AS UNSIGNED) AS subjectId,
  pe.exam_duration                                     AS durationMinutes,
  TRUE                                                 AS isFree,
  0                                                    AS price,
  TRUE                                                 AS isPractice,
  0                                                    AS retakeCooldownDays,
  (pe.exam_status = 1)                                 AS isActive,
  'practice'                                           AS source
FROM practice_exam pe
LEFT JOIN practice_exam_description ped
  ON ped.exam_id = pe.exam_id AND ped.languages_id = 3;


-- ---------------------------------------------------------------------
-- 7. Test-questions (exam to question links)
-- Source: main_exam_to_question (+ practice_exam_to_question)
-- Practice test IDs offset by +1,000,000 to match vw_tests
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_test_questions AS
SELECT
  metq.main_exam_to_question_id                       AS id,
  metq.exam_id                                        AS testId,
  metq.question_id                                    AS questionId,
  COALESCE(metq.Marks, 1)                             AS marks,
  metq.correct_answer                                 AS correctAnswer,
  metq.main_exam_to_question_id                       AS sortOrder,
  'main'                                              AS source
FROM main_exam_to_question metq
UNION ALL
SELECT
  petq.main_exam_to_question_id                       AS id,
  (petq.exam_id + 1000000)                            AS testId,
  petq.question_id                                    AS questionId,
  COALESCE(petq.Marks, 1)                             AS marks,
  petq.correct_answer                                 AS correctAnswer,
  petq.main_exam_to_question_id                       AS sortOrder,
  'practice'                                          AS source
FROM practice_exam_to_question petq;


-- ---------------------------------------------------------------------
-- 8. Students
-- Source: student
-- Composes a single `name` from first_name + surname_name
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_students AS
SELECT
  s.student_id                                        AS id,
  TRIM(CONCAT_WS(' ',
       NULLIF(s.first_name, ''),
       NULLIF(s.second_name, ''),
       NULLIF(s.surname_name, '')))                   AS name,
  LOWER(s.email_address)                              AS email,
  s.mobile_no                                         AS mobile,
  s.password                                          AS passwordHash,
  s.category_id                                       AS classId,
  (SELECT scd.categories_name FROM catigories_description scd
     WHERE scd.categories_id = s.category_id AND scd.languages_id = 3 LIMIT 1) AS board,
  s.avatar                                            AS avatarUrl,
  (s.status = 1)                                      AS isActive,
  s.registration_date                                 AS createdAt
FROM student s
WHERE s.email_address IS NOT NULL AND s.email_address != '';


-- ---------------------------------------------------------------------
-- 9. Legacy attempts (read-only, summary level)
-- Source: main_exam_status + practice_exam_status
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_attempts_legacy AS
SELECT
  mes.id                                              AS id,
  mes.student_id                                      AS studentId,
  mes.exam_id                                         AS testId,
  CAST(mes.user_score AS DECIMAL(10,2))               AS score,
  CAST(mes.total_score AS DECIMAL(10,2))              AS totalMarks,
  CASE
    WHEN CAST(mes.total_score AS DECIMAL(10,2)) > 0
    THEN ROUND((CAST(mes.user_score AS DECIMAL(10,2)) / CAST(mes.total_score AS DECIMAL(10,2))) * 100, 2)
    ELSE 0
  END                                                 AS percentage,
  mes.exam_start_time                                 AS startedAt,
  -- legacy startAttempt INSERTs finish_time = now, so we can't trust the raw column.
  -- Only expose finishedAt when the row is actually marked completed (status=2).
  CASE WHEN mes.status = 2 THEN mes.exam_finish_time_by_children ELSE NULL END AS finishedAt,
  CASE WHEN mes.status = 2
       THEN TIMESTAMPDIFF(SECOND, mes.exam_start_time, mes.exam_finish_time_by_children)
       ELSE 0
  END                                                 AS timeSpentSeconds,
  mes.status                                          AS status,
  FALSE                                               AS isPractice,
  mes.token                                           AS token,
  'main'                                              AS source
FROM main_exam_status mes
UNION ALL
SELECT
  (pes.id + 1000000)                                  AS id,
  pes.student_id                                      AS studentId,
  (pes.exam_id + 1000000)                             AS testId,
  CAST(pes.user_score AS DECIMAL(10,2))               AS score,
  CAST(pes.total_score AS DECIMAL(10,2))              AS totalMarks,
  CASE
    WHEN CAST(pes.total_score AS DECIMAL(10,2)) > 0
    THEN ROUND((CAST(pes.user_score AS DECIMAL(10,2)) / CAST(pes.total_score AS DECIMAL(10,2))) * 100, 2)
    ELSE 0
  END                                                 AS percentage,
  pes.exam_start_time                                 AS startedAt,
  CASE WHEN pes.status = 2 THEN pes.exam_finish_time_by_children ELSE NULL END AS finishedAt,
  CASE WHEN pes.status = 2
       THEN TIMESTAMPDIFF(SECOND, pes.exam_start_time, pes.exam_finish_time_by_children)
       ELSE 0
  END                                                 AS timeSpentSeconds,
  pes.status                                          AS status,
  TRUE                                                AS isPractice,
  pes.token                                           AS token,
  'practice'                                          AS source
FROM practice_exam_status pes;
