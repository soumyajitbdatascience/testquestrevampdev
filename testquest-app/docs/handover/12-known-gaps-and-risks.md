# 12. Known gaps, pending work & risks

> **What this file tells you:** what is unfinished, fragile, or deliberately deferred — so nothing here surprises you later — plus an index of all the older documents in this repo.

## Pending before real revenue

| Item | Status | What's needed |
|---|---|---|
| **Razorpay live keys** | The gateway runs in **test mode** — no real money can be collected | Complete Razorpay KYC/activation, generate live keys, update the three `RAZORPAY_*` env vars, register the webhook URL + secret in the live dashboard, rebuild & restart, make one real small purchase end-to-end |
| **Weekly-report cron on the VPS** | [vercel.json](../../vercel.json) schedules it only on Vercel; production is a VPS | Confirm/add the crontab entry — see the verify box in [09-deployment-operations.md](./09-deployment-operations.md) |
| **Seeded admin password** | `admin@testquest.in` shipped with a documented default password | Change immediately ([10-accounts-checklist.md](./10-accounts-checklist.md)) |

## Engineering gaps (recommended roadmap)

1. **No automated tests** — see [11-testing-qa.md](./11-testing-qa.md) for the suggested starting points.
2. **No CI/CD** — deploys are manual SSH sessions; a GitHub Action for build/lint/type-check would catch breakage before it reaches the server.
3. **No staging environment** — one shared live database for dev and prod. Even a periodic copy of the DB for development would reduce risk substantially.
4. **Database backups** — confirm a schedule exists (see [10-accounts-checklist.md](./10-accounts-checklist.md)); if not, set up scheduled dumps first.
5. **WhatsApp channel is a stub** — [src/lib/whatsapp.ts](../../src/lib/whatsapp.ts) has no real provider behind it; messages silently fall through to SMS/email.
6. **Unused `tq_password_reset_tokens` table** — the model exists in [prisma/schema.prisma](../../prisma/schema.prisma) but resets actually use columns on the legacy `student` table. Either migrate to it properly or remove the model to avoid confusion.

## Inherited data & platform quirks (accepted, not bugs to "fix")

All detailed in [06-shared-database-contract.md](./06-shared-database-contract.md): plain-text passwords in the never-read `encrypt_password` column, CSV `subject_id` values, empty correct answers, `subjects_id = 0` orphans, duplicated subjects (de-duplicated in code), the +1,000,000 practice-test id offset, and Hostinger's 10-second query kill. Also: English-only content and no chapter-level taxonomy — both deliberate MVP scoping.

## Performance & UX audit findings

Two audits were run in May 2026 and their reports kept: [../audit/5.1-performance.md](../audit/5.1-performance.md) and [../audit/5.2-mobile-ux.md](../audit/5.2-mobile-ux.md). Skim them before doing performance or mobile work — some findings may still be open.

## Index of all other documents in this repo

**Current / useful:**

| Document | What it is |
|---|---|
| [../../CLAUDE.md](../../CLAUDE.md) | Dense engineer cheat sheet (same facts as this pack, compressed) |
| [../USER_JOURNEY.md](../USER_JOURNEY.md) | The product + flow reference; §9 is the decision log with rationale |
| [../MANUAL_TEST_CASES.md](../MANUAL_TEST_CASES.md), [../test-scenarios.md](../test-scenarios.md), [../user-personas.md](../user-personas.md) | The manual QA pack |
| [../../ANIMATIONS.md](../../ANIMATIONS.md) | The landing-page animation design system |
| [../../AGENTS.md](../../AGENTS.md) | Note that this is Next.js 16 (breaking changes vs 14/15) |

**Historical — context only, don't treat as current instructions:**

| Document | What it was |
|---|---|
| [../HOSTINGER_DEPLOYMENT.md](../HOSTINGER_DEPLOYMENT.md) | Pre-launch deployment guide; superseded by [09-deployment-operations.md](./09-deployment-operations.md) for the as-built server |
| [../IMPLEMENTATION_PLAN.md](../IMPLEMENTATION_PLAN.md), [../UI_PLAN.md](../UI_PLAN.md), [../PHASE_4.1_PLAN.md](../PHASE_4.1_PLAN.md) | Build-time plans for the coaching layer and subscriptions |
| [../SESSION_HANDOFF.md](../SESSION_HANDOFF.md) | AI-assistant session notes from development |
| [../migration/](../migration/) (`inventory.md`, `profile.md`, `plan.md`) | The legacy-database profiling and plan from the migration project. Note: the migration docs mention the live DB host/name — treat as sensitive-ish |
| [../audit/](../audit/), [../test-results/](../test-results/) | Point-in-time audit reports and QA run logs |
