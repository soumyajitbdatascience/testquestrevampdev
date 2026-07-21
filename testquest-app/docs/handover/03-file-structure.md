# 3. File structure

> **What this file tells you:** where every important file lives and what it does, so you can find the right file to edit without searching. For "which files power feature X", see the feature files in [04-features/](./04-features/).

## Top level

```
testquest-app/
├── src/                  — all application code
├── prisma/               — database schema, migration scripts, seeds
├── docs/                 — documentation (this handover lives in docs/handover/)
├── public/               — static assets served as-is
├── package.json          — dependencies and npm scripts
├── vercel.json           — cron definition (weekly reports)
├── next.config.ts        — Next.js config (default/empty)
├── prisma.config.ts      — Prisma configuration
├── postcss.config.mjs    — Tailwind v4 pipeline (note: there is NO tailwind.config file)
├── components.json       — shadcn/ui component generator config
├── .nvmrc                — Node version (22)
├── CLAUDE.md             — engineer cheat sheet for the repo
└── ANIMATIONS.md         — documentation of the landing-page animation system
```

## `src/` — the application

### `src/app/` — pages (what users see)

Next.js App Router: each folder is a URL, `page.tsx` inside it is the screen.

| Path | Screen |
|---|---|
| `page.tsx` | Public landing page |
| `login/`, `signup/`, `forgot-password/`, `reset-password/` | Student auth screens |
| `dashboard/` | Student home after login |
| `tests/`, `tests/[id]/` | Browse tests; test detail with "Start" button |
| `attempts/[id]/`, `attempts/[id]/result/` | The test-taking screen and the result/review screen |
| `my-attempts/` | Student's attempt history |
| `profile/` | Student profile editing |
| `checkout/`, `checkout/success/` | Payment flow |
| `help/` | FAQ page (`faq-data.ts` holds the content) |
| `for-coaching-centres/` | Public marketing page for the B2B offering |
| `admin/login/` | Admin login |
| `admin/(authenticated)/` | Admin panel — `layout.tsx` is the shared shell with the auth gate; subfolders: `classes/`, `subjects/`, `questions/`, `tests/`, `bundles/`, `coupons/`, `orders/`, `students/`, `organizations/` |
| `coaching/` | Coaching-centre portal: `signup/`, `login/`, `setup/` (onboarding wizard), `dashboard/`, `branches/`, `batches/`, `assignments/`, `questions/`, `tests/`, `team/`, `billing/`, `settings/branding/`, `join/[token]/` (student joins a batch), `welcome/[token]/`, `_actions/auth.ts` |
| `layout.tsx`, `globals.css` | Root layout (fonts, providers) and the global stylesheet / design tokens |

### `src/app/api/` — API endpoints (the backend)

Each folder is an endpoint; `route.ts` inside it handles the HTTP methods.

| Folder | Endpoints for |
|---|---|
| `auth/` | `signup`, `login`, `google`, `logout`, `me`, `forgot-password`, `reset-password` |
| `tests/`, `tests/[id]/` | Public test list and detail |
| `taxonomy/` | Public class/subject tree |
| `attempts/` | Start attempt; `[id]/` get, `answer`, `pause`, `resume`, `submit`, `result` |
| `student/` | `dashboard`, `profile`, `attempts`, `assignments`, `purchases`, `branding` |
| `orders/` | `create`, `verify` (Razorpay handshake) |
| `razorpay/webhook/` | Razorpay server-to-server notifications |
| `coupons/validate/` | Coupon check at checkout |
| `bundles/[id]/` | Public bundle detail |
| `admin/` | Admin CRUD: `tests`, `questions` (+ `import`, `template`), `taxonomy/{classes,subjects,chapters}`, `bundles`, `coupons`, `orders`, `revenue`, `students`, `organizations` |
| `coaching/` | The whole B2B API: `signup`, `login/otp`, `join/[token]`, `setup`, `settings/branding`, `branches`, `batches` (students, teachers, import), `assignments` (+ `bulk`, `remind`, `results`), `team` (+ invites), `questions`, `tests`, `reminders/bulk`, `parent-reports/generate`, `billing/*`, `sample-data`, `welcome/[token]` |
| `cron/weekly-reports/` | The scheduled weekly-report job (protected by `CRON_SECRET`) |

### `src/lib/` — shared backend logic

| File | Purpose |
|---|---|
| [db.ts](../../src/lib/db.ts) | The single Prisma client instance |
| [auth.ts](../../src/lib/auth.ts) | Password hashing (bcrypt), JWT sign/verify, `getSession`, `requireAuth` |
| [api-utils.ts](../../src/lib/api-utils.ts) | `{ok, data/error}` response helpers, Zod error formatting, BigInt JSON patch |
| [legacy-content.ts](../../src/lib/legacy-content.ts) | READ legacy content via the `vw_*` views (classes, subjects, tests, questions) |
| [legacy-students.ts](../../src/lib/legacy-students.ts) | READ + WRITE the legacy `student` table (signup, login, profile, password reset) |
| [legacy-attempts.ts](../../src/lib/legacy-attempts.ts) | WRITE attempts to legacy `main_exam_status` / `main_exam_result` |
| [legacy-admin.ts](../../src/lib/legacy-admin.ts) | Admin WRITE to legacy content tables (classes, subjects, questions, tests) |
| [legacy-lookups.ts](../../src/lib/legacy-lookups.ts) | Small shared legacy lookups |
| [scoring.ts](../../src/lib/scoring.ts) | Answer-checking and score calculation |
| [razorpay.ts](../../src/lib/razorpay.ts) | Razorpay client + signature verification |
| [mail.ts](../../src/lib/mail.ts) / [email.ts](../../src/lib/email.ts) | Nodemailer SMTP sending / email templates |
| [sms.ts](../../src/lib/sms.ts) | SMS/OTP sending |
| [whatsapp.ts](../../src/lib/whatsapp.ts) | WhatsApp channel — currently a **stub** (not wired to a real provider) |
| [notifications.ts](../../src/lib/notifications.ts) | Channel orchestration: tries WhatsApp → SMS → email |
| [org-branding.ts](../../src/lib/org-branding.ts) / [branding-for-email.ts](../../src/lib/branding-for-email.ts) | Resolve a coaching centre's logo/colours for UI and emails |
| [parent-report/report-doc.tsx](../../src/lib/parent-report/report-doc.tsx) | The parent-report PDF layout (react-pdf) |
| [utils.ts](../../src/lib/utils.ts) | `cn()` class-name helper etc. |

### `src/lib/services/` — coaching (B2B) domain logic

One file per domain; API routes stay thin and call these.

`organization-admin`, `organization-hierarchy`, `branding`, `batch`, `batch-teachers`, `batch.service`, `assignment`, `bulk-assign`, `bulk-reminder`, `coaching-login` (OTP flows), `invite`, `team`, `dashboard`, `question-bank`, `test-builder`, `csv-import` (student roster import), `sample-data`, `parent-report`, `subscription`, `razorpay-subscription`, `weekly-report-cron` — all named `*.service.ts`.

### `src/components/` — reusable UI pieces

| Folder | Contents |
|---|---|
| `ui/` | shadcn primitives: button, card, dialog, input, select, table, tabs, dropdown-menu, accordion, badge, label, textarea, skeleton, mobile-drawer. **Edit these to restyle a control everywhere.** |
| `theme/` | `theme-provider.tsx`, `theme-toggle.tsx` (dark/light switching) |
| `brand/` | `logo.tsx` — the Testquest logo |
| `student/` | Student-facing shell: `student-header.tsx`, `branding-provider.tsx` (white-label context), `org-logo.tsx`, `assigned-to-me.tsx`, `powered-by-testquest.tsx` |
| `admin/` | `admin-sidebar.tsx`, `admin-mobile-nav.tsx` |
| `coaching/` | ~20 B2B components: header, mobile nav, stat tiles, assignment cards, wizard shell, CSV dropzones, banners, skeletons |
| `decor/` | Decorative animations: `quest-constellation`, `rotating-yantra`, `drifting-formulas`, `achievement-pulse-rings` (documented in [ANIMATIONS.md](../../ANIMATIONS.md)) |

### Other `src/` items

- [src/middleware.ts](../../src/middleware.ts) — runs before every request; redirects logged-out users away from protected pages.
- `src/hooks/` — `use-count-up.ts`, `use-reveal.ts` (small UI hooks).
- `src/generated/prisma/` — auto-generated Prisma client. **Never edit**; regenerate with `npx prisma generate`.

## `prisma/` — database

| Path | Purpose |
|---|---|
| [schema.prisma](../../prisma/schema.prisma) | Models for the 19 `tq_*` tables only (legacy tables are deliberately absent) |
| `migration/01-*.ts` … `20-*.ts` | Hand-written, numbered schema-change scripts (run with `npx tsx`). **This project does not use `prisma migrate`** — see [07-database-and-migrations.md](./07-database-and-migrations.md) |
| [migration/apply-views.ts](../../prisma/migration/apply-views.ts) | (Re)creates the 9 `vw_*` views |
| `migration/sql/create-views.sql` | The view definitions |
| `migration/migrate-01…10-*.ts` | Historical one-time data-migration scripts from the legacy system (already run; keep for reference) |
| `migration/_check*.ts`, `_probe*.ts` | Historical diagnostic scripts (safe to ignore) |
| [migration/seed-coaching.ts](../../prisma/migration/seed-coaching.ts) | Seeds coaching demo data (`npm run seed:coaching`) |
| [seed.ts](../../prisma/seed.ts), [seed-sample-tests.ts](../../prisma/seed-sample-tests.ts) | Other seed scripts |

## `docs/` — documentation

This handover pack is `docs/handover/`. The other documents are indexed, with a note on which are current vs historical, at the end of [12-known-gaps-and-risks.md](./12-known-gaps-and-risks.md).
