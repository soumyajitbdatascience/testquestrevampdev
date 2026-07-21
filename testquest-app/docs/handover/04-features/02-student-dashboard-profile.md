# Feature: Student dashboard, profile & attempt history

> **What this file tells you:** the screens a logged-in student lands on, which files build them, and where the data comes from.

## What it does

After logging in, the student sees a dashboard: a welcome, their recent test attempts, tests assigned to them by their coaching centre (if they belong to one), and shortcuts into the test catalogue. "My attempts" lists every test they have taken with scores, and links to detailed result reviews. The profile page lets them update their name, class, and other details. If the student belongs to a coaching centre, the pages appear in that centre's colours and logo (white-labelling).

## How it works

The dashboard page calls `GET /api/student/dashboard`, which combines several sources: the student's row (legacy `student`), their attempt history (legacy `main_exam_status`/`main_exam_result`), their purchases (`tq_orders`, `tq_student_access`), and any coaching assignments (`tq_assignments` via their batch membership). The branding endpoint looks up whether the student is enrolled in a coaching batch and returns that organisation's colours/logo, which `branding-provider.tsx` applies across the student UI. Profile edits go through `PATCH /api/student/profile` into the legacy `student` table.

## Files to edit

| Layer | Files |
|---|---|
| Screens | [src/app/dashboard/page.tsx](../../../src/app/dashboard/page.tsx) · [src/app/my-attempts/page.tsx](../../../src/app/my-attempts/page.tsx) · [src/app/profile/page.tsx](../../../src/app/profile/page.tsx) |
| API routes | `src/app/api/student/` → [dashboard](../../../src/app/api/student/dashboard/route.ts) · [profile](../../../src/app/api/student/profile/route.ts) · [attempts](../../../src/app/api/student/attempts/route.ts) · [assignments](../../../src/app/api/student/assignments/route.ts) · [purchases](../../../src/app/api/student/purchases/route.ts) · [branding](../../../src/app/api/student/branding/route.ts) |
| Logic | [src/lib/legacy-students.ts](../../../src/lib/legacy-students.ts) · [src/lib/legacy-lookups.ts](../../../src/lib/legacy-lookups.ts) · [src/lib/org-branding.ts](../../../src/lib/org-branding.ts) |
| Shared UI | [src/components/student/student-header.tsx](../../../src/components/student/student-header.tsx) · [branding-provider.tsx](../../../src/components/student/branding-provider.tsx) · [assigned-to-me.tsx](../../../src/components/student/assigned-to-me.tsx) |

## Database tables used

| Table | Kind | Used for |
|---|---|---|
| `student` / `vw_students` | Legacy | Profile data (read + update) |
| `main_exam_status`, `main_exam_result` | Legacy | Attempt history and scores |
| `vw_tests`, `vw_classes`, `vw_subjects` | Views | Naming the tests/classes shown on the dashboard |
| `tq_student_access` | New | Which paid tests/bundles this student has unlocked |
| `tq_orders` | New | Purchase history |
| `tq_batch_enrollments` | New | Whether the student is in a coaching batch (drives branding + assignments) |
| `tq_assignments` | New | Tests assigned by the coaching centre |

## Watch out for

- Dashboard queries join legacy and `tq_*` data in application code (not SQL joins) because they live in different access layers.
- The shared Hostinger database kills any query longer than 10 seconds — keep dashboard queries lean and avoid per-row subqueries.
