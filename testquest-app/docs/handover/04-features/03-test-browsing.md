# Feature: Test browsing & the class/subject tree

> **What this file tells you:** how students find tests, which files build the catalogue, and where test content is stored.

## What it does

Students browse a catalogue of tests filtered by their class (6–12) and subject (Maths, Science, etc.). Each test card shows its name, subject, question count, duration, and whether it is free or paid. Clicking a test opens a detail page with a description and a "Start test" button — or a "Buy" prompt if it's paid and not yet purchased. The same catalogue data also powers the public class/subject dropdowns on the signup page.

## How it works

The test list endpoint reads from the `vw_tests` view — a clean window onto the legacy exam tables, so the catalogue automatically matches what the mobile app shows. The taxonomy endpoint builds the class → subject tree from `vw_classes` and `vw_subjects` (subjects are de-duplicated by class + English name, because the legacy data had many duplicates). The detail endpoint additionally checks `tq_student_access` to decide whether this student has unlocked a paid test, and merges in coaching-centre-authored tests from `tq_org_tests` where relevant.

## Files to edit

| Layer | Files |
|---|---|
| Screens | [src/app/tests/page.tsx](../../../src/app/tests/page.tsx) (catalogue) · [src/app/tests/[id]/page.tsx](../../../src/app/tests/%5Bid%5D/page.tsx) (detail) |
| API routes | [src/app/api/tests/route.ts](../../../src/app/api/tests/route.ts) · [src/app/api/tests/[id]/route.ts](../../../src/app/api/tests/%5Bid%5D/route.ts) · [src/app/api/taxonomy/route.ts](../../../src/app/api/taxonomy/route.ts) |
| Logic | [src/lib/legacy-content.ts](../../../src/lib/legacy-content.ts) (all view reads) · [src/lib/legacy-lookups.ts](../../../src/lib/legacy-lookups.ts) |

## Database tables used

| Table | Kind | Used for |
|---|---|---|
| `vw_tests` | View | The catalogue: test names, durations, class/subject, free/paid |
| `vw_classes`, `vw_subjects` | Views | The class/subject filter tree |
| `vw_test_questions`, `vw_questions`, `vw_question_options`, `vw_question_meta` | Views | Question counts and, later, the questions themselves |
| `tq_org_tests` | New | Tests authored by coaching centres |
| `tq_student_access` | New | Whether this student has unlocked a paid test |

## Watch out for

- **Practice tests have ids offset by +1,000,000.** Legacy "main exams" and "practice exams" are different tables; the app adds 1,000,000 to practice ids so one URL space serves both. Never strip this offset.
- `main_exam.subject_id` in the legacy data is a comma-separated string like `"25,24,31"` — the code takes the first value.
- Chapter-level taxonomy was deliberately deferred: questions belong directly to a subject.
- Content is English-only for now (legacy `languages_id = 3`).
