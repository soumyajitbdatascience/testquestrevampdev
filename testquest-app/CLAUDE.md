# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **New session? Read this first, then [`docs/USER_JOURNEY.md`](./docs/USER_JOURNEY.md) for the full product + flow reference.**

---

## What this is

Testquest — an edtech platform for Indian Class 6–12 students. This is the **new Next.js rebuild**. There's a legacy PHP app (`../testquest-main/`) that's no longer running, and a separate **mobile app already in production that uses the same MySQL database**.

The web app and the mobile app share content, students, and attempts via the legacy MySQL tables. New web-only features (orders, coupons, bundles, paid access) live in new `tq_*` tables.

## Stack

- **Framework:** Next.js 16 (App Router, Turbopack, `src/` layout)
- **Language:** TypeScript (strict)
- **DB:** MySQL on Hostinger (113 tables — 94 legacy + 19 `tq_*` + views)
- **ORM:** Prisma 6 for `tq_*` tables; **raw SQL via `$queryRaw` for legacy reads/writes** (we never let Prisma `db push` touch the legacy schema)
- **UI:** shadcn/ui + Tailwind v4, light default (purple brand `#6134EB`; logo assets in `public/brand/`)
- **Auth:** Custom JWT in httpOnly cookies; bcrypt passwords
- **Payments:** Razorpay (test keys only — live pending)
- **Validation:** Zod

## Architecture in 30 seconds

**Reads:** the web app reads legacy content through 9 MySQL VIEWs:
- `vw_classes`, `vw_subjects`, `vw_questions`, `vw_question_options`, `vw_question_meta`
- `vw_tests`, `vw_test_questions`, `vw_students`, `vw_attempts_legacy`

VIEW definitions: `prisma/migration/sql/create-views.sql`
Apply views: `npx tsx prisma/migration/apply-views.ts`

**Writes by domain:**
| Domain | Goes to |
|---|---|
| Auth (signup, login, profile) | Legacy `student` table |
| Content (classes, subjects, questions, tests) | Legacy tables (admin panel writes) |
| Attempts (start, save answer, submit) | Legacy `main_exam_status` + `main_exam_result` |
| Orders, coupons, bundles, paid access | `tq_orders`, `tq_coupons`, `tq_bundles`, `tq_student_access` |
| Admin users | `tq_admins` |

**Never touch legacy tables with Prisma `db push`** — it dropped them once. Use ALTER TABLE via raw SQL for any schema changes, and only on `tq_*` tables.

## Where things live

```
src/
├── app/
│   ├── api/
│   │   ├── auth/         — signup, login, google, me, forgot/reset password
│   │   ├── tests/        — list, detail
│   │   ├── attempts/     — start, get, answer, pause, resume, submit, result
│   │   ├── student/      — dashboard, attempts, profile, purchases
│   │   ├── orders/       — create, verify (Razorpay)
│   │   ├── razorpay/     — webhook
│   │   ├── coupons/      — validate
│   │   ├── taxonomy/     — public class/subject tree
│   │   └── admin/        — admin CRUD (classes, subjects, questions, tests, bundles, coupons, orders, revenue)
│   ├── (auth pages)      — /login, /signup, /forgot-password, /reset-password
│   ├── tests/, attempts/, dashboard/, my-attempts/, profile/, checkout/
│   └── admin/
│       ├── login/
│       └── (authenticated)/   — route group with shared admin layout + auth gate
├── lib/
│   ├── db.ts             — Prisma client singleton
│   ├── auth.ts           — JWT sign/verify, getSession, requireAuth
│   ├── api-utils.ts      — success/error helpers, Zod error handling, BigInt JSON patch
│   ├── legacy-content.ts — typed wrappers around vw_* views (READ)
│   ├── legacy-students.ts — student auth helpers (READ + WRITE against legacy student table)
│   ├── legacy-attempts.ts — start/save/submit attempts (WRITE to legacy result tables)
│   └── legacy-admin.ts   — admin content writes (classes, subjects, questions, tests)
├── components/
│   ├── ui/               — shadcn primitives
│   ├── brand/            — Logo, LogoMark
│   ├── theme/            — ThemeProvider, ThemeToggle
│   ├── student/          — StudentHeader, PageHeader
│   ├── admin/            — AdminSidebar, AdminPageHeader
│   └── decor/            — QuestConstellation, AchievementPulseRings, DriftingFormulas, RotatingYantra
└── generated/prisma/     — Prisma client output (gitignored)
prisma/
├── schema.prisma         — only tq_* tables and admin
└── migration/            — view DDL, profiling scripts, helpers
docs/
├── USER_JOURNEY.md       — ★ primary reference for current product + flows
├── MVP_SCOPE.md          — original MVP spec
└── migration/            — inventory, profile, plan from data-migration phase
```

## Commands

```bash
npm run dev              # Dev server (Turbopack)
npm run build            # Production build
npm run lint             # ESLint
npx tsc --noEmit         # Type check
npx prisma generate      # Regenerate Prisma client (after schema.prisma changes)
npx prisma studio        # Visual DB browser (works on legacy tables too)

# View management
npx tsx prisma/migration/apply-views.ts   # (re)create the 9 vw_* views
```

**Do NOT run** `npx prisma db push` — it interprets `--accept-data-loss` aggressively and previously dropped all 94 legacy tables. Use raw ALTER TABLE via a `prisma/migration/*.ts` script for any tq_* schema change.

## Type code mappings (legacy ↔ new)

| New enum | `answer_type` | `question_type` |
|---|---|---|
| `SINGLE_MCQ` | 101 | 505 |
| `MULTI_MCQ` | 102 | 504 |
| `FILL_IN_BLANK` | 101 | 507 |
| `PARAGRAPH` | 101/102 | 501–503 |

Difficulty: `1 = EASY, 2 = MEDIUM, 3 = HARD`.

`status` columns: `1 = active, 0 = inactive (soft-deleted)`.
`main_exam_result.result`: `1 = correct, 2 = wrong, 0 = unanswered`.
`main_exam_status.status`: `1 = in-progress, 2 = completed`.

Correct answer format in `question_audio_video_paragraph` is position-based CSV: `",,3,,,"` (option C correct) or short `"3"`.

Practice test IDs are offset by `+1_000_000` in our exposed IDs to disambiguate from main exam IDs.

## Key patterns

- Every API route uses Zod for input validation
- API responses follow `{ ok: true, data }` or `{ ok: false, error }`
- BigInt serialization is patched globally in `api-utils.ts` (MySQL views return BIGINT for arithmetic like `pe.exam_id + 1000000`)
- Always cast view-returned ids with `Number(r.id)` before passing to Prisma (Prisma rejects BigInt for Int fields)
- Auth via `getSession()` / `requireAuth("student" | "admin")`
- Soft delete via `status = 0` on legacy entities; `isActive = false` on tq_* entities

## Decisions log (the must-knows)

1. **Vanilla PHP legacy, not Laravel** (verified — no framework)
2. **Compatibility VIEWs over legacy** — read-only; mobile app keeps working unchanged
3. **Admin writes directly to legacy** — single source of truth
4. **New attempts → legacy result tables** — shared with mobile
5. **Subject dedup by `(Class × English name)`** — collapses 28 duplicates of "Life Process" etc.
6. **Stateless JWT** — no `student_token` table
7. **Razorpay only** — no PayU/PayPal
8. **Chapter taxonomy deferred** — questions belong to subject directly
9. **Practice test IDs offset by +1M** — disambiguates main vs practice without a column
10. **English only** for MVP (legacy `languages_id = 3`)

Full decision history with rationale: [`docs/USER_JOURNEY.md`](./docs/USER_JOURNEY.md) §9.

## Known gotchas

- `student.encrypt_password` has plaintext for some legacy rows — **never read this column**
- `main_exam.subject_id` is a CSV like `"25,24,31"` — take the first
- Some `correct_answer` values are empty strings (legacy data quality)
- `subjects_id = 0` orphans exist
- Hostinger's `max_statement_time` is 10s — avoid per-row correlated subqueries on 28k+ row queries
- Hostinger shared hosting blocks Prisma's shadow DB for migrations → we use raw ALTER TABLE

## Seeded admin

For testing:
- Email: `admin@testquest.in`
- Password: `admin123`

## Roles

Two roles in MVP: **Student** and **Admin**. Faculty + Center deferred.
