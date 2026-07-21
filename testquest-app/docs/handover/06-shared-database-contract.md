# 6. The shared-database contract (read before touching the database)

> **What this file tells you:** the rules that keep the production **mobile app** working while you develop the web app. Breaking these rules can take down a live product that is not in this repository.

## Why this exists

The MySQL database (`srv1633.hstgr.io`) is shared between this web app and a **mobile app that is live in production and cannot be changed**. The mobile app reads and writes the 94 **legacy tables** directly (`student`, `main_exam`, `question`, `catigories`, …). The web app's own 19 tables are all prefixed **`tq_`**.

Think of it as a contract: the web app may do anything to `tq_*` tables, but must treat legacy tables as a shared public API — read through views, write only in the agreed places, never restructure.

## Rule 1 — NEVER run `npx prisma db push`

This has **already caused a disaster once**: it interpreted the schema aggressively and **dropped all 94 legacy tables**. The build/postinstall scripts only run `prisma generate` (safe — it just generates client code). There is no reason to ever run `db push` against this database. Don't.

## Rule 2 — all legacy reads go through the 9 views

A view is a saved, read-only query. The views give the web app clean column names without copying any data, so the mobile app is untouched.

`vw_classes` · `vw_subjects` · `vw_questions` · `vw_question_options` · `vw_question_meta` · `vw_tests` · `vw_test_questions` · `vw_students` · `vw_attempts_legacy`

- Definitions: [prisma/migration/sql/create-views.sql](../../prisma/migration/sql/create-views.sql)
- (Re)apply them: `npx tsx prisma/migration/apply-views.ts`
- All view access is wrapped in [src/lib/legacy-content.ts](../../src/lib/legacy-content.ts) and friends — add new legacy reads there, not inline in routes.

## Rule 3 — legacy writes happen in exactly three places

| Write | File | Tables |
|---|---|---|
| Student accounts | [src/lib/legacy-students.ts](../../src/lib/legacy-students.ts) | `student` |
| Test attempts | [src/lib/legacy-attempts.ts](../../src/lib/legacy-attempts.ts) | `main_exam_status`, `main_exam_result` |
| Admin content edits | [src/lib/legacy-admin.ts](../../src/lib/legacy-admin.ts) | `catigories(+_description)`, `subjects(+_description)`, `subcategories`, `question(+_description)`, `question_audio_video_paragraph`, `main_exam(+_description)`, `main_exam_to_question` |

If a new feature needs to write legacy data, extend one of these files and keep the SQL parameterised (`$queryRaw` with template values, never string concatenation).

## Rule 4 — schema changes only on `tq_*`, only via raw SQL scripts

Standard `prisma migrate` does not work here (shared hosting blocks Prisma's shadow database), and must never run against legacy tables anyway. The procedure is in [07-database-and-migrations.md](./07-database-and-migrations.md): write a numbered `prisma/migration/NN-*.ts` script that runs `ALTER TABLE`/`CREATE TABLE` on `tq_*` tables only, update `schema.prisma` to match, run `npx prisma generate`.

**Never ALTER, RENAME, or DROP a legacy table or column.** If legacy data needs a new shape, add a `tq_*` table alongside instead.

## Rule 5 — soft delete only

Legacy rows are "deleted" by setting `status = 0`; `tq_*` rows by `isActive = false`. Hard deletes could orphan data the mobile app references.

## The legacy decoder ring

Codes you will meet in legacy data:

| Field | Meaning |
|---|---|
| Question types | SINGLE_MCQ = `answer_type` 101 / `question_type` 505 · MULTI_MCQ = 102 / 504 · FILL_IN_BLANK = 101 / 507 · PARAGRAPH = 101–102 / 501–503 |
| Difficulty | 1 = easy, 2 = medium, 3 = hard |
| `status` (any table) | 1 = active, 0 = inactive/soft-deleted |
| `main_exam_result.result` | 1 = correct, 2 = wrong, 0 = unanswered |
| `main_exam_status.status` | 1 = in progress, 2 = completed |
| Correct answer format | Position-based CSV in `question_audio_video_paragraph`: `",,3,,,"` = option C; sometimes short form `"3"` |
| Language | English only: `languages_id = 3` |
| Practice tests | Exposed ids are offset by **+1,000,000** to distinguish them from main-exam ids |

## Known data-quality quirks (inherited, live with them)

- `student.encrypt_password` holds **plain-text passwords for some old rows** — never read or log this column.
- `main_exam.subject_id` can be a CSV like `"25,24,31"` — code takes the first value.
- Some `correct_answer` values are empty strings.
- Orphan rows with `subjects_id = 0` exist.
- Subjects were heavily duplicated; the web app de-duplicates by (class × English name).
- Hostinger kills queries longer than **10 seconds** (`max_statement_time`) — avoid per-row correlated subqueries over the 28k+ question rows.
