# Testquest — Content Migration Summary (Test Environment)

**Status: COMPLETE ✓ · August 2026 · Target DB: `<db-user>_TquestTestEnv`**

This documents the clean content migration from the legacy database (`<db-user>_testquest_db26`) into the new decoupled schema. All scripts live in `docs/handover/migration/`.

## What was migrated

Legacy CBSE-flavoured school content (Classes 6–12) was extracted, cleaned, and loaded into the new `tq_*` schema. Competitive-exam content (JEE/NEET/etc.) was intentionally left behind for V1.

| Table | Rows | Notes |
|---|---|---|
| tq_boards | 4 | CBSE, ICSE, State, Odisha (seed) |
| tq_classes | 7 | Class 6–12 (master) |
| tq_subjects | 8 | Maths, Science, Physics, Chemistry, Biology, English, Social Science, Hindi (master) |
| tq_board_classes | 7 | CBSE ↔ its classes |
| tq_offerings | 30 | Board+Class+Subject combos with content (all CBSE for now) |
| tq_chapters | 90 | Parsed from test names; "General" where no topic |
| tq_questions | 5,473 | Cleaned HTML, decoded answers, tagged subject+chapter |
| tq_question_options | 21,875 | Normalized options with isCorrect |
| tq_tests | 270 | Attached to offerings |
| tq_test_questions | 6,895 | Shared-bank links |
| tq_free_tests | 26 | One free sample per offering with content |

## Run order (all in `docs/handover/migration/`)

1. `01-create-content-schema.sql` — creates all tables + seeds boards & classes
2. `02-load-offerings.sql` — 30 offerings
3. `03-load-chapters.sql` — 90 chapters
4. `questions/04-questions-00-RESET.sql` then `part01`–`part06` — questions + options
5. `05-load-tests.sql` then `06-load-test-questions.sql` — tests + links
6. Free samples (one statement): `INSERT INTO tq_free_tests (offeringId, testId) SELECT t.offeringId, MIN(t.id) FROM tq_tests t WHERE t.isActive=1 AND EXISTS (SELECT 1 FROM tq_test_questions tq WHERE tq.testId=t.id) GROUP BY t.offeringId;`

## Cleaning & mapping decisions applied

- **Subjects derived, not copied** — legacy "subjects" were test-sets; a clean 8-subject master was hand-defined and content mapped to it by parsing test names.
- **Class & subject read from test names** — e.g. "Class 9 – Maths – Number System – Set 1" → Class 9 / Mathematics / chapter "Number System".
- **Answers decoded** — legacy position-CSV (`,,3,,,` → option C) converted to explicit `isCorrect` flags. Verified correct on samples.
- **Question type by evidence** — legacy type codes were unreliable (all "multi"); type set by counting correct options (1 = single, 2+ = multi).
- **HTML cleaned** — stripped inline CSS / Word cruft, converted entities to Unicode, preserved MathML and images.
- **legacyId kept** on classes, questions, tests for traceability back to the source.

## Known limitations / follow-ups (for admin phase)

- **18 tests skipped** — school-tagged but subject unreadable from the name; assign subject manually in admin later.
- **1 test has 0 questions** — all its questions were Hindi-only/skipped; delete or ignore.
- **Chapters are best-effort** — some are "General" (no topic in the test name); a few source typos carried through ("Periodic Clasification"). Editable in admin.
- **Math rendering** depends on the app rendering MathML (e.g. MathJax); source math is imperfect in places.
- **Only CBSE populated** — ICSE/State/Odisha boards exist but are empty; fill via admin when content is ready.
- **Other boards & competitive tracks** — deferred to later phases per the enhancement plan.

## What's next

1. **Admin screens** — update the app (Prisma schema + admin UI) to the decoupled model so this content is manageable and other boards can be added. See the Claude Code rework list in `testquest-schema-design-decoupled.md` §7.
2. **Then** subscriptions / coupons / payments.
3. **Production cutover** — when validated, run the same scripts against a production clean DB and point the web app at it (legacy DB retired once the Android app moves to the new APIs).

This migration was performed against a snapshot dump; re-run against live data for the production cutover.
