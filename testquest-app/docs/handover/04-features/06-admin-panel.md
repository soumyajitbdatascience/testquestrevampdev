# Feature: Admin panel

> **What this file tells you:** what the platform owner can manage at `/admin`, which files build each screen, and the split between legacy and new tables behind it.

## What it does

The admin panel is the platform owner's control room. Admins log in at `/admin/login` (separately from students) and can: manage the content catalogue (classes, subjects, questions, tests — including bulk question upload from a spreadsheet), create bundles and coupons, view every order and total revenue, browse registered students, and onboard coaching-centre organisations. Content edits appear on both the website and the mobile app, because content lives in the shared legacy tables.

## How it works

Admin identity lives in `tq_admins`; login issues the same kind of JWT cookie as students but with the admin role, and every `/admin` page sits inside a route group whose [layout](../../../src/app/admin/%28authenticated%29/layout.tsx) checks that role. Content CRUD goes through [legacy-admin.ts](../../../src/lib/legacy-admin.ts), which writes directly to the legacy tables with raw SQL (this is deliberate — one source of truth shared with mobile). Commerce management (bundles, coupons, orders, revenue) uses Prisma on `tq_*` tables. Question bulk-import parses an uploaded .xlsx template and inserts questions row by row.

## Files to edit

| Layer | Files |
|---|---|
| Screens | `src/app/admin/login/page.tsx` · `src/app/admin/(authenticated)/` → `page.tsx` (dashboard), `classes/`, `subjects/`, `questions/`, `tests/`, `bundles/`, `coupons/`, `orders/`, `students/`, `organizations/` (+ `organizations/new/`, `organizations/[id]/`) |
| API routes | `src/app/api/admin/` → `tests` (+ `[id]`, `[id]/questions`) · `questions` (+ `[id]`, `import`, `template`) · `taxonomy/classes|subjects|chapters` (+ `[id]`) · `bundles` (+ `[id]`) · `coupons` (+ `[id]`) · `orders` · `revenue` · `students` · `organizations` (+ `[id]`, `[id]/resend-invite`) |
| Logic | [src/lib/legacy-admin.ts](../../../src/lib/legacy-admin.ts) (all legacy content writes) · [src/lib/legacy-lookups.ts](../../../src/lib/legacy-lookups.ts) · [src/lib/services/organization-admin.service.ts](../../../src/lib/services/organization-admin.service.ts) |
| Shared UI | [src/components/admin/admin-sidebar.tsx](../../../src/components/admin/admin-sidebar.tsx) · [admin-mobile-nav.tsx](../../../src/components/admin/admin-mobile-nav.tsx) |

## Database tables used

**Legacy (content — shared with the mobile app), written via raw SQL:**

| Table | Holds |
|---|---|
| `catigories`, `catigories_description` | Classes (yes, "categories" is misspelled in the legacy schema) |
| `subjects`, `subjects_description`, `subcategories` | Subjects |
| `question`, `question_description`, `question_audio_video_paragraph` | Questions, their text, options and correct answers |
| `main_exam`, `main_exam_description`, `main_exam_to_question` | Tests and their question lists |

**New `tq_*` (web-only), via Prisma:** `tq_admins` (admin accounts), `tq_bundles`/`tq_bundle_tests`, `tq_coupons`/`tq_coupon_usages`, `tq_orders` (orders + revenue), `tq_organizations`/`tq_org_memberships`/`tq_subscriptions` (coaching onboarding).

## Watch out for

- Content deletes are **soft**: `status = 0` on the legacy row. Never hard-DELETE content rows — the mobile app may reference them.
- When adding a legacy content column, follow the safe procedure in [06-shared-database-contract.md](../06-shared-database-contract.md) and update the matching `vw_*` view.
- A seeded admin account exists (`admin@testquest.in` / `admin123`). **Change this password at handover** — see [10-accounts-checklist.md](../10-accounts-checklist.md).
- The question import/template endpoints define the spreadsheet format — keep template and parser in sync.
