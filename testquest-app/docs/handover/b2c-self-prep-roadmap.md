# Testquest B2C — Self-Prep Student: Improvement Roadmap (PRD)

**Version 1.0 · July 2026**

> **What this document is:** a phased, forward-looking plan to close the gaps in the self-prep (B2C) journey, sequenced from go-live blockers to growth bets. Each item references its gap (G-xx in [b2c-self-prep-gap-analysis.md](./b2c-self-prep-gap-analysis.md)) and SRS requirement (FR-xx in [14-srs.md](./14-srs.md)). Effort: S ≤ days · M = 1–2 wks · L = multi-week.

## 1. Problem statement

The B2C funnel is fully built but not yet fully *alive*: the purchase step can't take real money, the first session has an undefined state for new users, and after the first visit the platform never contacts the student again. The test-taking core is excellent; the surrounding journey — activation, conversion, retention, recovery — is where the product loses people it never had to lose.

## 2. Goals & success metrics

| Goal | Metric to watch |
|---|---|
| Turn on revenue | First real paid order; then paid conversion rate (signups → first purchase) |
| Fix activation | % of new signups who start a test in session 1 |
| Build retention | Week-2 / week-4 return rate; paused-test completion rate |
| Reduce stranded accounts | Password-reset failure contacts; % accounts with verified email |
| Protect trust | Support tickets about expired bundles / missing receipts (target ~0) |

*Note:* no analytics/event instrumentation is documented today — R-1.5 makes measurement possible at all.

**Non-goals of this roadmap:** mobile-app changes, B2B/coaching features (except shared infrastructure), multi-language content, parent accounts, chapter taxonomy delivery (only groundwork).

## 3. Phase 0 — Turn the revenue on (days; ops, not code)

**R-0.1 · Go live on Razorpay** *(G-01, FR-4.7 · S)* — Complete KYC/activation; install live `RAZORPAY_KEY_ID` / `KEY_SECRET` / `WEBHOOK_SECRET`; register the live webhook URL + secret; rebuild & restart; make one real small purchase end-to-end (order paid, access granted, webhook logged in `tq_webhook_events`). *Acceptance:* a real UPI payment unlocks a test and appears in admin revenue.

**R-0.2 · Verify/add the VPS crontab** *(FR-7.2 · S)* — Production is a VPS; `vercel.json` scheduling is inert there. Confirm a crontab entry calls `GET /api/cron/weekly-reports` with the `CRON_SECRET` header; extend the same pattern for the B2C jobs below. *Acceptance:* `tq_weekly_report_runs` shows a fresh row each Sunday. **This is the prerequisite for R-1.4 and all of Phase 2.**

**R-0.3 · Rotate the seeded admin password & secrets** *(NFR-1 · S)* — Housekeeping that protects everything else ([10-accounts-checklist.md](./10-accounts-checklist.md)).

## 4. Phase 1 — First-session & trust quick wins (1–2 weeks)

**R-1.1 · Defined class-less catalogue state** *(G-03, FR-2.2 · S)* — First catalogue visit with no class set shows a one-tap "Which class are you in?" picker (writes to the profile, same API as profile edit); until answered, show all classes grouped rather than an empty/undefined list. *Files:* `src/app/tests/page.tsx`, `api/student/profile`. *Acceptance:* a fresh account with no class always sees a populated, actionable catalogue.

**R-1.2 · Email verification (non-blocking)** *(G-02, FR-1.1/1.5 · M)* — Send a verification link at signup via the existing SMTP path (`mail.ts`); banner until verified; never gate test-taking on it. Store the flag in an additive `tq_` table or an approved additive column per the [shared-DB contract](./06-shared-database-contract.md) — no legacy schema restructuring. *Acceptance:* typo'd emails are surfaced within the first session, while frictionless signup is preserved.

**R-1.3 · Purchase receipt email** *(G-07, FR-4.6 · S)* — On verified payment (both `orders/verify` and the webhook path, idempotently), send a branded receipt: items, amount, coupon applied, order ID, bundle validity end-date. *Acceptance:* every paid order produces exactly one receipt email.

**R-1.4 · Bundle expiry visibility & warnings** *(G-05, FR-4.1 · S; depends on R-0.2)* — Show the expiry date on "My purchases"; cron-driven T-3-days and day-of emails, idempotent per order (mirror the `tq_weekly_report_runs` pattern). *Acceptance:* no bundle lapses without two prior notices.

**R-1.5 · Minimal funnel instrumentation** *(new · S–M)* — Log the handful of events the metrics in §2 need (signup, class-set, test-started, test-submitted, checkout-opened, order-paid) to an additive `tq_events` table or a lightweight analytics tool. Without this, every later phase flies blind.

## 5. Phase 2 — The retention engine (2–4 weeks)

**R-2.1 · B2C lifecycle messaging** *(G-04, FR-7 scope · M; depends on R-0.2, R-1.2)* — Four messages, all through the existing `notifications.ts` orchestrator (email-first for B2C since mobile is optional), each idempotent and individually toggleable by env flag:

1. **Welcome** (on signup): what to try first, link to a recommended free test for their class.
2. **Unfinished test** (24–48 h after a pause with no resume): "Your attempt is saved — pick up where you left off."
3. **Next step after a result** (day after a completed free test): suggested next test in the same subject; natural slot for a first-purchase coupon.
4. **Win-back** (day 7 / day 21 inactive): fresh tests for their class.

*Acceptance:* each message fires at most once per trigger per student; unsubscribe honored across all four.

**R-2.2 · "My progress" page** *(G-09, FR-7.1 reuse · M)* — Surface the analytics that already exist in `parent-report.service.ts` — average score, 4-week trend, weak topics — to the student directly, adapted from batch-comparison to subject/class framing. Add "practice your weak topics" links into the catalogue. *Acceptance:* a student with ≥3 attempts sees trend + weak topics; fewer attempts gets the friendly "not enough activity yet" state (mirroring FR-7.1's empty-state behaviour).

## 6. Phase 3 — Depth & scale (4–8+ weeks, sequence by appetite)

**R-3.1 · Catalogue search** *(G-08 · M)* — Name/description search over `vw_tests` within the student's class; mind the 10-second shared-DB query ceiling (NFR-2) — simple `LIKE` with indexes first, nothing exotic.

**R-3.2 · Chapter taxonomy groundwork** *(G-08, FR-2.1 · L)* — Additive `tq_chapters` + `tq_question_chapters` mapping tables (legacy schema untouched, per the DB contract). Start by tagging the highest-traffic subjects; unlocks chapter filters and sharper weak-topic analytics (feeds back into R-2.2).

**R-3.3 · Refund workflow** *(G-10, FR-5.6 · M)* — Admin-side refund action: Razorpay refund API call, access revocation in `tq_student_access`, coupon-usage rollback, audit trail; handle `refund.*` webhook events idempotently alongside the existing ones.

**R-3.4 · Mobile as a recovery channel** *(G-11, G-02 · M)* — Optional mobile verification via the existing OTP stack (`tq_otp_codes`, `sms.ts`); a verified mobile becomes a second password-reset path, ending the single-point-of-failure on email.

**R-3.5 · Compliance & account hygiene** *(new · M)* — India DPDP-readiness basics: privacy policy surface, data-export/delete request handling (soft-delete consistent with the attempt-history retention model), and login-protected report links (already on the NFR-1 roadmap).

## 7. Risks & dependencies

- **Shared production database, no staging** (NFR-5, D1): every schema addition must be additive `tq_*` only, per [06-shared-database-contract.md](./06-shared-database-contract.md); test against throwaway accounts.
- **No automated tests or CI** (NFR-4): each phase should extend [MANUAL_TEST_CASES.md](../MANUAL_TEST_CASES.md); Phase 1 is the right moment to add a first smoke-test script for auth + checkout.
- **SMTP dependency**: Phases 1–2 lean on email; confirm the SMTP provider's sending limits and reputation before lifecycle volume ramps (D2).
- **Cron single-point**: R-0.2 underpins R-1.4 and R-2.1 — verify it first, and alert if a scheduled run is missed.

## 8. Suggested sequence at a glance

Phase 0 (this week: R-0.1 → R-0.2 → R-0.3) → Phase 1 (R-1.1 + R-1.5 first, then R-1.2/1.3/1.4) → Phase 2 (R-2.1, then R-2.2) → Phase 3 (pick by appetite; R-3.3 becomes urgent as soon as real money flows from R-0.1).
