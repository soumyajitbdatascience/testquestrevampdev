# Feature: Taking a test (attempts)

> **What this file tells you:** what happens from "Start test" to the result screen, which files run it, and exactly which legacy tables record every answer.

## What it does

The student presses "Start test" and gets a timed, question-by-question exam screen. Each answer is saved the moment it is chosen, so a dropped connection loses nothing. The student can pause and resume later. On submit (or when the timer runs out), the test is scored instantly and the result screen shows the score, correct/wrong/unanswered breakdown, and a full answer review. Because attempts are written to the legacy tables, a student's history is one list across the web and the mobile app.

## How it works

`POST /api/attempts` creates an attempt session row in legacy `main_exam_status` (status 1 = in progress). Each answer goes to `POST /api/attempts/[id]/answer`, which upserts a row per question in legacy `main_exam_result`, marking it correct (1), wrong (2), or unanswered (0) using [scoring.ts](../../../src/lib/scoring.ts). Pause/resume flip timing fields on the status row. Submit finalises every row, computes the totals, and sets the status to 2 = completed. If the test was assigned by a coaching centre, submit also records the link in `tq_assignment_attempts` so teachers can see completion. All of this logic lives in [legacy-attempts.ts](../../../src/lib/legacy-attempts.ts).

## Files to edit

| Layer | Files |
|---|---|
| Screens | [src/app/attempts/[id]/page.tsx](../../../src/app/attempts/%5Bid%5D/page.tsx) (exam UI + timer) · [src/app/attempts/[id]/result/page.tsx](../../../src/app/attempts/%5Bid%5D/result/page.tsx) (result + review) |
| API routes | [src/app/api/attempts/route.ts](../../../src/app/api/attempts/route.ts) (start) · under `src/app/api/attempts/[id]/`: [route.ts](../../../src/app/api/attempts/%5Bid%5D/route.ts) (get state) · [answer](../../../src/app/api/attempts/%5Bid%5D/answer/route.ts) · [pause](../../../src/app/api/attempts/%5Bid%5D/pause/route.ts) · [resume](../../../src/app/api/attempts/%5Bid%5D/resume/route.ts) · [submit](../../../src/app/api/attempts/%5Bid%5D/submit/route.ts) · [result](../../../src/app/api/attempts/%5Bid%5D/result/route.ts) |
| Logic | [src/lib/legacy-attempts.ts](../../../src/lib/legacy-attempts.ts) (the core) · [src/lib/scoring.ts](../../../src/lib/scoring.ts) (answer checking) · [src/lib/legacy-content.ts](../../../src/lib/legacy-content.ts) (loading questions) |

## Database tables used

| Table | Kind | Used for |
|---|---|---|
| `main_exam_status` | Legacy (write) | One row per attempt: who, which test, timing, status (1 = in progress, 2 = completed) |
| `main_exam_result` | Legacy (write) | One row per question per attempt: the chosen answer and result (1 = correct, 2 = wrong, 0 = unanswered) |
| `practice_exam_status`, `practice_exam_result` | Legacy (write) | The same two roles, but for **practice tests** (the ones with the +1,000,000 id offset) — `legacy-attempts.ts` picks the pair based on the id |
| `main_exam`, `main_exam_to_question`, `question` | Legacy (read) | The test definition and its questions |
| `vw_tests`, `vw_questions`, `vw_question_options`, `vw_attempts_legacy` | Views | Clean reads for the exam screen and history |
| `tq_assignment_attempts` | New | Links an attempt to a coaching assignment |
| `tq_assignments`, `tq_batch_enrollments`, `tq_student_access` | New | Access checks: is this test assigned/purchased? |

## Watch out for

- **These are the most sensitive writes in the whole app** — the production mobile app reads the same two tables. Test any change here against a throwaway student account first.
- The correct answer in legacy data is a **position-based CSV**: `",,3,,,"` means option C is correct; sometimes it's just `"3"`. Some legacy rows have an **empty** correct answer. `scoring.ts` handles these formats — extend it there, not inline.
- Question type codes: SINGLE_MCQ = answer_type 101 / question_type 505; MULTI_MCQ = 102/504; FILL_IN_BLANK = 101/507; PARAGRAPH = 101–102/501–503.
- Remember the +1,000,000 practice-test id offset when tracing an attempt back to its test.
