# Legacy → New Migration Plan

Generated 2026-05-25. Profiled against live Hostinger DB.

---

## Scope & decisions (locked)

| Decision | Choice |
|---|---|
| Question types | Migrate everything. Add `PARAGRAPH` and `SUBJECTIVE` to the `QuestionType` enum. Hidden in MVP student UI, visible in admin. |
| Attempt history | Migrate with `isLegacy = true` flag. Visible to students. Excluded from new analytics via `WHERE isLegacy = false`. |
| Chapters | Drop the requirement. `tq_questions.chapterId` is nullable. Migrated questions land at the **Subject** level. Tagging system planned for v2. |
| i18n | English only (language_id = 3). Hindi rows ignored. |
| Wallet | Out of scope for this pass — planned separately. |
| Bkp / staging tables (`bkp_question`, `com_migrate_q`, `migrate_question_*`) | Skip. Already-abandoned legacy artifacts. |

---

## Schema changes made

1. `QuestionType` enum: added `PARAGRAPH`, `SUBJECTIVE`.
2. `Question.chapterId` → nullable.
3. `Question.subjectId` → new required field (always set, even when chapter is null).
4. `Question.isLegacy`, `Question.legacyId` → trace fields.
5. `AttemptStatus` enum: added `LEGACY_COMPLETED`.
6. `Attempt.isLegacy`, `Attempt.legacyKey` → trace + analytics filter.
7. `Class.legacyId`, `Subject.legacyId`, `Test.legacyId`, `Test.isLegacy`, `Student.legacyId` → idempotent re-runs.

A new Prisma migration will be needed to push these to the DB before any data migration runs.

---

## Verified legacy state (from profiling)

| Concept | Legacy table(s) | Real row count |
|---|---|---:|
| Languages | `languages` | 2 (id 2 = Hindi, **id 3 = English** ← default) |
| Classes | `catigories` + `catigories_description` | 21 / 42 |
| SubCategories | `subcategories` + `subcategories_description` | 56 / 112 |
| Subjects | `subjects` + `subjects_description` | 817 / 1,850 |
| Exams | `main_exam` + `main_exam_description` | 376 / 417 |
| Exam→Question | `main_exam_to_question` | 14,594 |
| Practice exams | `practice_exam` + `practice_exam_to_question` | 8 / 6 |
| Descriptive exams | `descriptive_main_exam` | 2 |
| Questions (objective) | `question` + `question_description` + `question_audio_video_paragraph` | 28,197 / 30,497 / 31,160 |
| Questions (descriptive) | `descriptive_question` + `descriptive_question_description` | 237 / 242 |
| Students | `student` + `student_subject_selection` | 1,366 / 37 |
| Attempts (main) | `main_exam_status` (summary) + `main_exam_result` (per-Q) | unknown summaries / 9,995 detail rows |
| Attempts (practice) | `practice_exam_status` + `practice_exam_result` | unknown / 12 |
| Attempts (descriptive) | `descriptive_main_exam_result` | 3 |

### Question type code distribution (real)

| `answer_type` | `question_type` | Count | Maps to |
|---:|---:|---:|---|
| 101 | 505 | **17,986** | `SINGLE_MCQ` |
| 102 | 504 | **10,210** | `MULTI_MCQ` |
| 101 | 507 | 19 | `FILL_IN_BLANK` (single-answer fill) |
| 102 | 502 | 3 | `MULTI_MCQ` (rare) |
| 101 | 501 | 3 | `PARAGRAPH` parent |
| 101 | 502 | 3 | `PARAGRAPH` parent |
| 101 | 503 | 2 | `PARAGRAPH` (audio/video) |
| 102 | 503 | 2 | `PARAGRAPH` (audio/video) |
| 102 | 501 | 2 | `PARAGRAPH` parent |

> **answer_type** = answer modality (101 single-choice, 102 multi-choice)
> **question_type** = format (501–503 paragraph variants, 504 multi, 505 single, 507 fill)

### Subject duplication

Top dup names in `subjects_description`: "Life Process" appears **28 times**, "Probability" **20 times**, "Coordinate Geometry" **20 times**. This confirms subjects are **per-SubCategory** in legacy (same subject name across boards/courses). We need a dedup strategy in the script.

### Critical column names (verified)

- `question_description.main_question` ← actual question text (NOT `question_description`)
- `subjects_description.subject_name` + `subject_description`
- `subjects.Temp_Subject_Name`, `chapter_name`, `chapter_title` ← chapter hints baked into subject rows
- `main_exam_to_question.correct_answer` ← option label like `"3"` or `"1,2"`
- `question_audio_video_paragraph.correct_answer` ← position list like `"1,2,,,,"` (per-question, per-language)
- `student.password` (hashed), `student.encrypt_password` (⚠ plaintext exists in legacy)
- `student.first_name`, `second_name`, `surname_name`, `email_address`, `category_id`, `subcategories_id`
- `main_exam_status.token` ← attempt grouping key (joins to `main_exam_result.token`)

---

## Column-by-column mapping

### 1. Class ← `catigories` + `catigories_description`

| Legacy | New (`tq_classes`) | Transform |
|---|---|---|
| `catigories.categories_id` | `legacyId` | as-is |
| `catigories.categories_status` | `isActive` | `1 → true, 0 → false` |
| `catigories_description.categories_name` | `name` | Take row where `languages_id = 3` (English) |
| (computed) | `sortOrder` | Use `categories_id` as natural order |

Idempotency: `INSERT … ON DUPLICATE KEY UPDATE` via `legacyId` unique constraint.

### 2. Subject ← `subjects` + `subjects_description`

Each subjects row points to a `catigories_id` (in `main_exam` via subcategory join — or directly via `subcategories.categories_id` for that subject).

| Legacy | New (`tq_subjects`) | Transform |
|---|---|---|
| `subjects.subjects_id` | `legacyId` | as-is |
| `subjects_description.subject_name` | `name` | Take English row |
| (resolve via subcategories) | `classId` | `SELECT categories_id FROM subcategories WHERE subjects_id = ?` then map to new class id |
| `subjects.subjects_status` | `isActive` | flag |

**Dedup strategy:** keep **one Subject per (Class, English name)** — collapse the 817 subjects rows down to a manageable count. The 28-duplicate "Life Process" rows collapse to one per class.

### 3. Chapter ← skipped

No migration. `Question.chapterId` left null. Admin can group questions into chapters later via a dedicated UI (out of scope for the migration).

### 4. Question ← `question` + `question_description` + `question_audio_video_paragraph`

| Legacy | New (`tq_questions`) | Transform |
|---|---|---|
| `question.question_id` | `legacyId` | as-is |
| `question_description.main_question` (lang=3) | `text` | Strip `<p>…</p>` wrappers if possible |
| `question.subjects_id` | `subjectId` | map via Subject.legacyId |
| (`answer_type`, `question_type`) | `type` | Apply code map below |
| `question.difficulty_level` | `difficulty` | Map 1→EASY, 2→MEDIUM, 3→HARD (fallback MEDIUM) |
| `question_audio_video_paragraph.Marks` (lang=3) | `marks` | first match per question, fallback 1 |
| `question_audio_video_paragraph.explanation` | `explanation` | strip HTML |
| (FILL_IN_BLANK) `question_audio_video_paragraph.options_1` | `correctText` | Position 1 holds the accepted answer for 507 |
| `question.question_status` | `isActive` | flag |
| true | `isLegacy` | |

**Question type code → enum:**

```
answer_type=101 question_type=505  → SINGLE_MCQ
answer_type=102 question_type=504  → MULTI_MCQ
answer_type=102 question_type=502  → MULTI_MCQ
answer_type=101 question_type=507  → FILL_IN_BLANK
answer_type=101 question_type=501  → PARAGRAPH
answer_type=102 question_type=501  → PARAGRAPH
answer_type=101 question_type=502  → PARAGRAPH
answer_type=101 question_type=503  → PARAGRAPH
answer_type=102 question_type=503  → PARAGRAPH
```

For `descriptive_question`: all → `SUBJECTIVE` regardless of type code.

### 5. QuestionOption ← pivot `question_audio_video_paragraph`

For each question, pick the **English row** (`languages_id=3`), then for each non-empty `options_N` column emit a `tq_question_options` row.

The `correct_answer` field on `question_audio_video_paragraph` is position-based: `"1,2,,,,"` means options 1 and 2 are correct. Parse and set `isCorrect` accordingly.

| Source column | New (`tq_question_options`) field |
|---|---|
| `options_1` | `text` with `label = "A"` |
| `options_2` | `text` with `label = "B"` |
| `options_3` | `text` with `label = "C"` |
| `options_4` | `text` with `label = "D"` |
| `options_5` | `text` with `label = "E"` (only if non-empty) |
| `options_6` | `text` with `label = "F"` (only if non-empty) |
| parsed from `correct_answer` | `isCorrect` |

Skip rows with empty `options_N` (don't create empty options).

Skip entirely for `FILL_IN_BLANK`, `PARAGRAPH`, `SUBJECTIVE` types.

### 6. Test ← `main_exam` + `main_exam_description` (+ `practice_exam`, `descriptive_main_exam`)

| Legacy | New (`tq_tests`) | Transform |
|---|---|---|
| `main_exam.exam_id` | `legacyId` | as-is |
| `main_exam_description.exam_name` (lang=3) | `name` | |
| `main_exam_description.terms_condition` (lang=3) | `description` | strip HTML |
| `main_exam.category_id` | `classId` | map via Class.legacyId |
| `main_exam.subject_id` first ID before `,` | `subjectId` | parse `"25,24,31"` → take first |
| `main_exam.exam_duration` | `durationMinutes` | as-is |
| sum of TestQuestion marks | `totalMarks` | computed after step 7 |
| `main_exam.exam_price = 0.00` | `isFree` | |
| `main_exam.exam_price` | `price` | as-is |
| false / true based on table | `isPractice` | from `practice_exam`: true |
| `main_exam.re_exam_day` | `retakeCooldownDays` | as-is |
| `main_exam.exam_status` | `isActive` | flag |
| true | `isLegacy` | |

`descriptive_main_exam` → also migrated as a Test but with all questions marked `SUBJECTIVE`. Admin can decide whether to surface.

### 7. TestQuestion ← `main_exam_to_question`

Direct row copy. Use `main_exam_to_question.correct_answer` to **override** the option `isCorrect` flags if it differs from the question_audio_video_paragraph default — store the per-test correct answer.

| Legacy | New (`tq_test_questions`) | Transform |
|---|---|---|
| `main_exam_to_question.exam_id` | `testId` | map via Test.legacyId |
| `main_exam_to_question.question_id` | `questionId` | map via Question.legacyId |
| (row order) | `sortOrder` | use `main_exam_to_question_id` for stable order |

⚠ `main_exam_to_question.Marks` differs from `question_audio_video_paragraph.Marks` in places. Use the exam-level Marks. **We need to add a `marks` override on TestQuestion** if we want to preserve per-test marking, OR live with the question-level marks (simpler).

### 8. Student ← `student` + `student_subject_selection`

| Legacy | New (`tq_students`) | Transform |
|---|---|---|
| `student.student_id` | `legacyId` | as-is |
| `CONCAT(first_name, ' ', surname_name)` | `name` | trim, fallback to `username` |
| `student.email_address` | `email` | lowercase, dedupe |
| `student.mobile_no` | `mobile` | strip non-digits |
| `student.password` | `passwordHash` | as-is (already bcrypt in legacy app) — skip rows where it doesn't start with `$2` |
| `student.category_id` | `classId` | map via Class.legacyId |
| (derived from `subcategories_id`) | `board` | join `subcategories` to find board name; fallback `null` |
| `student.status` | `isActive` | flag |

**Email collisions:** dedupe by `email` — if two legacy rows share an email, keep the most recently active. Email is required in our schema and unique.

**Password concern:** the `encrypt_password` field has plaintext passwords for some users. Ignore — we only port the bcrypt `password` field.

### 9. Attempt ← `main_exam_status` + `main_exam_result` (and practice/descriptive variants)

`main_exam_status` is the per-attempt summary. `main_exam_result` is per-question detail. They join on `token`.

| Legacy summary | New (`tq_attempts`) | Transform |
|---|---|---|
| `main_exam_status.id` + table prefix | `legacyKey` | e.g. `"main:44"` |
| `main_exam_status.student_id` | `studentId` | map via Student.legacyId |
| `main_exam_status.exam_id` | `testId` | map via Test.legacyId |
| `LEGACY_COMPLETED` | `status` | always |
| false / true | `isPractice` | true only for practice_exam_status rows |
| true | `isLegacy` | |
| `"[]"` | `questionOrder` | empty array — not preserved |
| `main_exam_status.user_score` | `score` | |
| `main_exam_status.total_score` | `totalMarks` | |
| `user_score / total_score * 100` | `percentage` | computed |
| from `exam_start_time` / `exam_finish_time` | `timeSpentSeconds` | diff |
| `main_exam_status.exam_start_time` | `startedAt` | |
| `main_exam_status.exam_finish_time` | `finishedAt` | |

### 10. AttemptAnswer ← `main_exam_result` (+ practice/descriptive)

| Legacy | New (`tq_attempt_answers`) | Transform |
|---|---|---|
| joined to attempt via token | `attemptId` | |
| `main_exam_result.question_id` | `questionId` | map via Question.legacyId |
| `main_exam_result.user_answer` | `fillAnswer` / `selectedOptionId` | parse — if it's a number → resolve to option, else store raw |
| `main_exam_result.result` | `isCorrect` | `1 = true` |
| `main_exam_result.Marks` | `marksAwarded` | |

---

## What's NOT being migrated

- `wallet` and related (`student_buy_packages`, `student_exam_available`) — separate plan
- `bkp_question` (20,694 rows) — backup, dropped
- `com_migrate_q`, `migrate_question`, `migrate_question_ii` — abandoned staging artifacts
- `notice`, `noticestudent`, `noticecenter`, `notice_description` — out of scope
- `feacture`, `about`, `about_story`, `careers`, `blog_categories`, `faq` — CMS content, not data
- `country`, `state`, `city`, `zone` — reference data (we hardcode India)
- `currency`, `currency_symbol` — we're INR-only
- `image_slider`, `social_icon`, `advertisements`, `advertisement_client` — marketing
- `center`, `center_token`, `center_password_resets` — Center role not in MVP
- `faculty`, `faculty_token`, `faculty_password_resets` — Faculty role not in MVP
- `admission`, `comments`, `posts`, `news_letter_subscribe`, `web_define_values`, `web_number`, `whatsapp`, `our_team`, `promotion_records`, `off_line_payment_by_admin`, `student_password_resets`, `student_token`, `student_exam_answer`, `student_practice_answer`, `practice_exam_tab`, `main_exam_tab`, `descriptiv_main_exam_status`, `exam_covered`, `packages_description`, `ebook`, `ebook_description` — not needed for MVP feature set

---

## Risks & open items

1. **Student email duplicates** — need to count first before deciding merge strategy.
2. **`subject_id` parsing** — `main_exam.subject_id` can be a comma-list `"25,24,31"`. We take the first. If exams span multiple subjects, that's lost.
3. **`Marks` mismatch** between `main_exam_to_question.Marks` (per-test) and `question_audio_video_paragraph.Marks` (per-question default). We use the question-level Marks. May skew historical scores by a few percent. Migrated attempts keep their original scores, so this only matters if students retake.
4. **HTML in question text** — `<p>…</p>` wrappers are common. Strip on import or render as HTML in admin? Recommend strip-and-store-plaintext for student-facing display, keep raw in `text` so explanations / formulas survive.
5. **Charset** — legacy mixes utf8 and utf8mb4. Our new tables are utf8mb4. Should be safe but watch for 4-byte chars (emoji) in old rows.
6. **PARAGRAPH parent-child** — paragraph questions have sub-questions referenced via `sub_question_id` in `question_audio_video_paragraph` and `main_exam_to_question`. Our schema has no parent-child question model. For now: each sub-question becomes a standalone Question with the parent's text prepended. Loses the "comprehension passage" UX but preserves the content.
7. **`descriptive_main_exam_result.obtain_marks`** is faculty-assigned — no auto-scoring. We migrate it but mark these subjective.

---

## Execution order (when we're ready)

1. **Push schema** — `npx prisma migrate dev --name legacy-migration-prep` adds the new columns and enum values.
2. **Run migration scripts in dependency order:**
   - `migrate-01-classes.ts`
   - `migrate-02-subjects.ts`
   - `migrate-04-questions.ts`
   - `migrate-05-options.ts`
   - `migrate-06-tests.ts`
   - `migrate-07-test-questions.ts`
   - `migrate-08-students.ts`
   - `migrate-09-attempts.ts`
   - `migrate-10-verify.ts` ← row counts + sample spot-checks
3. **Sanity check** — open admin → Questions page, scroll, verify options render correctly for a few of each type.
4. **Spot-check student view** — log in as a migrated student, see their history.

Each script is idempotent (uses `legacyId` upsert) so we can re-run any step without duplicates.

---

## Resolved questions

- **Q1: Subject dedup** → **Collapse by `(Class, English name)`**. One Subject per class for each distinct English name. The 28 "Life Process" rows collapse to one per class. Questions are re-pointed to the canonical Subject during the question migration step.
- **Q2: PARAGRAPH handling** → **Flatten**. Each sub-question from `question_audio_video_paragraph` becomes its own Question. The passage text is prepended to the sub-question text (or kept in the `explanation` field if we prefer not to bloat the question body). Question type is set to `SINGLE_MCQ` / `MULTI_MCQ` depending on the sub-question's `answer_type`, not `PARAGRAPH`, since the parent structure is gone after flattening. The `PARAGRAPH` enum value is reserved for any future re-import that preserves the structure.
