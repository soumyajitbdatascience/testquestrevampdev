# Feature: Coaching centres (B2B layer)

> **What this file tells you:** the whole coaching-institute product — onboarding, batches, assignments, team, billing, reports — and the files and tables behind each part.

## What it does

Coaching institutes (tuition centres) get their own portal at `/coaching`. A centre signs up, completes a setup wizard (branding colours/logo, classes taught, first batch, teacher invites), and then runs its teaching through Testquest: create **batches** (class groups), enrol students (one by one, via CSV upload, or by sharing a join link), **assign tests** with due dates, monitor who has completed them, send reminder nudges, build their **own questions and tests**, invite teachers with role-based access, generate **PDF progress reports for parents**, and pay for the platform via subscription plans. Students of a centre see the centre's logo and colours instead of plain Testquest.

## How it works

Coaching staff log in with **email OTP** (a one-time code sent to them) rather than passwords — codes live in `tq_otp_codes`. An **organisation** (`tq_organizations`) is the root record; people belong to it via `tq_org_memberships` with roles (owner, teacher). Branches model multi-location centres as child organisations. Batches hold student enrolments (`tq_batch_enrollments`, which point at legacy `student` rows, creating them during CSV import if needed). Assignments connect a batch to a test; when a student submits, `tq_assignment_attempts` links their legacy attempt to the assignment so teachers see live completion. Billing creates Razorpay subscriptions (`tq_subscriptions`, plans in `tq_subscription_plans`), confirmed by the shared Razorpay webhook. Almost every API route is thin and delegates to a service file in `src/lib/services/`.

## Files to edit

| Area | Screens (`src/app/coaching/`) | API (`src/app/api/coaching/`) | Service (`src/lib/services/`) |
|---|---|---|---|
| Signup & OTP login | `signup/`, `login/` | `signup`, `login/otp`, `login/otp/verify` | `coaching-login.service.ts` |
| Setup wizard | `setup/` (+ `setup/steps/*`) | `setup/[step]`, `setup/logo` | `organization-admin.service.ts`, `branding.service.ts` |
| Branches | `branches/`, `branches/new/` | `branches`, `branches/[id]/enter` | `organization-hierarchy.service.ts` |
| Batches & students | `batches/`, `batches/new/`, `batches/[id]/` (+ `students/import/`) | `batches`, `batches/[id]/students/*` (+ `import`, `transfer`, `send-report`), `batches/students/template` | `batch.service.ts`, `csv-import.service.ts` |
| Teachers on a batch | `batches/[id]/` | `batches/[id]/teachers` (+ `[userId]`) | `batch-teachers.service.ts` |
| Assignments | `batches/[id]/assign/`, `batches/[id]/assignments/[assignmentId]/`, `assignments/[id]/` | `assignments` (+ `[id]`, `remind`, `results`, `bulk`), `reminders/bulk` | `assignment.service.ts`, `bulk-assign.service.ts`, `bulk-reminder.service.ts` |
| Question bank & test builder | `questions/`, `tests/`, `tests/new/` | `questions` (+ `search`, `import`, `template`, `[id]`), `tests` (+ `search`) | `question-bank.service.ts`, `test-builder.service.ts` |
| Team & invites | `team/`, `team/accept/[token]/` | `team` (+ `invites/[inviteId]`, `accept/[token]`, `[membershipId]`) | `team.service.ts`, `invite.service.ts` |
| Student join links | `join/[token]/`, `welcome/[token]/` | `join/[token]` (+ `otp`, `verify`), `welcome/[token]` | `invite.service.ts` |
| Billing | `billing/` | `billing/checkout`, `billing/subscribe`, `billing/subscription`, `billing/verify` | `subscription.service.ts`, `razorpay-subscription.service.ts` |
| Dashboard & branding | `dashboard/`, `settings/branding/` | `settings/branding`, `sample-data` | `dashboard.service.ts`, `branding.service.ts`, `sample-data.service.ts` |
| Parent reports | (buttons on batch screens) | `parent-reports/generate` | `parent-report.service.ts` + [src/lib/parent-report/report-doc.tsx](../../../src/lib/parent-report/report-doc.tsx) |

Shared UI lives in `src/components/coaching/` (~20 components: header, nav, stat tiles, cards, wizard shell, banners).

## Database tables used

All new `tq_*` (Prisma) unless noted:

| Table | Holds |
|---|---|
| `tq_organizations` | The coaching centre (name, branding, plan status); branches are child rows |
| `tq_org_memberships` | Who belongs to the centre, with role |
| `tq_batches`, `tq_batch_teachers`, `tq_batch_enrollments` | Batches, their teachers, their students (enrolments point at legacy `student` ids) |
| `tq_assignments`, `tq_assignment_attempts` | Assigned tests and student completion links |
| `tq_org_questions`, `tq_org_tests` | The centre's own question bank and tests |
| `tq_subscription_plans`, `tq_subscriptions` | Billing plans and active subscriptions |
| `tq_invite_tokens`, `tq_team_invites`, `tq_otp_codes` | Join links, teacher invites, OTP login codes |
| `tq_weekly_report_runs` | Log of weekly-report job runs |
| `student` (legacy) | Created/read during roster import and join flows — student accounts stay shared with mobile |

## Watch out for

- CSV roster import **creates legacy `student` rows** — it's the one place the B2B layer writes legacy data. Treat changes there with the same care as auth.
- Subscription state changes arrive via the same Razorpay webhook as student orders ([05-payments-and-commerce.md](./05-payments-and-commerce.md)) — test both when touching it.
- `npm run seed:coaching` seeds demo coaching data; the "sample data" banner in the UI relates to `sample-data.service.ts`.
- Feature background and build history: [../../IMPLEMENTATION_PLAN.md](../../IMPLEMENTATION_PLAN.md) (historical planning doc).
