# 7. Database & migrations

> **What this file tells you:** what's in the database, and the exact procedure for changing it safely. Read [06-shared-database-contract.md](./06-shared-database-contract.md) first.

## What's in the database

One MySQL database at Hostinger (`<db-host>`), containing:

- **94 legacy tables** — the old system's schema, still used by the production mobile app. Not modelled in Prisma, on purpose.
- **19 new `tq_*` tables** — everything web-only. Fully modelled in [prisma/schema.prisma](../../prisma/schema.prisma).
- **9 `vw_*` views** — read-only windows onto legacy data ([definitions](../../prisma/migration/sql/create-views.sql)).

### The `tq_*` models (from schema.prisma)

| Area | Models |
|---|---|
| Commerce | `Order`, `Coupon`, `CouponUsage`, `Bundle`, `BundleTest`, `StudentAccess`, `WebhookEvent` |
| Platform | `Admin`, `Setting`, `PasswordResetToken` (defined but **unused** — resets use legacy columns) |
| Coaching | `Organization`, `OrgMembership`, `Batch`, `BatchTeacher`, `BatchEnrollment`, `Assignment`, `AssignmentAttempt`, `OrgQuestion`, `OrgTest`, `SubscriptionPlan`, `Subscription`, `InviteToken`, `TeamInvite`, `OtpCode`, `WeeklyReportRun` |
| Content mirror | `Class`, `Subject`, `Chapter`, `Question`, `QuestionOption`, `Test`, `TestQuestion`, `Student`, `Attempt`, `AttemptAnswer` — created during the original migration project; current content still lives in legacy tables (see the contract doc) |

Each model maps to a `tq_*` table via `@@map` in the schema.

## How schema changes work here (important — it's non-standard)

This project does **not** use `prisma migrate`. Hostinger's shared hosting blocks the "shadow database" Prisma migrate needs, and Prisma must never manage the legacy tables. Instead, schema changes are **hand-written TypeScript scripts** in [prisma/migration/](../../prisma/migration/), numbered in order: `01-profile.ts` … `20-add-subscription-razorpay.ts`. Each script connects with Prisma and runs raw `CREATE TABLE` / `ALTER TABLE` statements against `tq_*` tables only.

### To make a schema change

1. Write the next numbered script, e.g. `prisma/migration/21-add-my-feature.ts`. Copy the shape of [20-add-subscription-razorpay.ts](../../prisma/migration/20-add-subscription-razorpay.ts): raw SQL, `tq_*` tables only, idempotent where possible (`CREATE TABLE IF NOT EXISTS`, check-before-ALTER).
2. Run it: `npx tsx prisma/migration/21-add-my-feature.ts` (it uses `DATABASE_URL` from `.env` — remember there is **one shared database**, so this touches live data).
3. Update [prisma/schema.prisma](../../prisma/schema.prisma) to match the new shape.
4. Regenerate the client: `npx prisma generate`.
5. Commit script + schema together, so the numbered scripts remain a complete history.

**Never** run `npx prisma db push` (see the contract doc — it once dropped all legacy tables), and never point a migration script at a legacy table.

## Useful commands

```bash
npx prisma generate                        # regenerate the client after schema.prisma changes
npx prisma studio                          # visual DB browser (works on legacy tables too)
npx tsx prisma/migration/apply-views.ts    # (re)create the 9 vw_* views
npm run seed:coaching                      # seed coaching demo data
```

## What the other scripts in prisma/migration/ are

- `migrate-01-classes.ts` … `migrate-10-verify.ts` — the **one-time** legacy→new data migration from the original build. Already run; historical.
- `rollback-content-migration.ts`, `drop-*-fk.ts` — historical fix-ups.
- `_check*.ts`, `_probe*.ts`, `_progress.ts` — read-only diagnostics used during migration; harmless but not needed day-to-day.
- [prisma/seed.ts](../../prisma/seed.ts), [seed-sample-tests.ts](../../prisma/seed-sample-tests.ts) — seeds.

## One database, no staging

Development and production share the same database. Until a staging database exists (a recommended improvement — see [12-known-gaps-and-risks.md](./12-known-gaps-and-risks.md)), treat every migration script run as a production operation: read it twice, back up first (Hostinger's phpMyAdmin/panel can export dumps), and run during low-traffic hours.
