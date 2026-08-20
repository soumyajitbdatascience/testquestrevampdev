# B2C Student — Go-Live (Cutover) Checklist

**August 2026 · v2 — refreshed after the flow consolidation + design polish.** The student experience is now built, consolidated to one shell, and visually finished. This is the list between "built" and "students can pay." Grouped: validate → content → config → deploy → watch. `[x]` = done.

## Status since v1
- [x] Student module — all five phases built, fail-closed, unit-tested.
- [x] Student flow **consolidated to one shell** (legacy `Dashboard/Tests/History` retired, cross-class browse gone, onboarding one-time, add-class flow, History folded into My progress).
- [x] Design **fidelity pass** (Phases 1 & 2) — shell, add-class sheet, Home (sub/unsub), My progress, My subscriptions; six additive API fields; 20/20 E2E.
- [x] Email live and **verified in a real inbox** (receipt + welcome, inbox not spam, unsubscribe works).
- [x] Question content cleaned (glue words + `Clasification` in names; residual subject typos parked for content QA).
- [x] Two count-consistency bugs fixed (`freeSampleCount`, active-test count) so selling surfaces agree with the paywall.

## 1. Validate (the proofs code can't self-give) — OUTSTANDING
- [ ] **Live Razorpay test-card purchase.** THE last money proof. **Reset the CBSE prices first** (the P0.1 E2E rewrote them to 499/599 in `TquestTestEnv` — set them back to the real 1000/2000/3600 in admin). Then buy a pass with card `4111 1111 1111 1111` (any future expiry/CVV; or UPI `success@razorpay`) and confirm: order → **PAID**, one `tq_class_access` row, class unlocks, land back on the item, **receipt email** arrives, **My subscriptions** shows the pass.
- [ ] **Manual admin UAT** — walk `admin-e2e-test-guide.md`; lean on readiness-recompute, deep links, invariants (duplicate-offering 409, free-sample-needs-questions, percentage coupon creates).
- [ ] **Manual student flow re-check** — sign in → lands on Home (one shell, never changes) → onboarding asked once → add a class reveals its free tests → sample → paywall. `student-uat-guide.md` covers it.
- [ ] **Small AA cleanup** — swap `--text-muted`→`--text-secondary` under 14px on `offerings/[id]`, `videos/[id]`, `pass/success`, `paywall.tsx` (color only). One-line each; worth closing before public launch.

## 2. Content readiness
- [x] Pricing — CBSE 26/30 priced (⚠ re-set after the E2E price rewrite, see §1).
- [ ] Free samples — confirm every launching offering has one (a few flagged in the admin tray).
- [x] Damaged questions — cleaned (safe pass applied; residual subject typos are a later content-QA sweep, not a blocker).
- [ ] At least one real **video** per launching offering (or accept empty video tabs at launch — gating is built and correct either way).
- [ ] Confirm the launch matrix = **CBSE Classes 6–12** (only board with content; onboarding hides empty boards automatically).

## 3. Production configuration (`.env` on the live deploy)
- [ ] `DATABASE_URL` → the **new** DB (`u710649289_TquestTestEnv`) — and **delete the dead second `DATABASE_URL` line** so there's exactly one (the two-line file is a footgun for pointing prod at the wrong DB).
- [ ] **Razorpay LIVE** key id + secret + register the **live webhook** URL and its secret.
- [ ] `RESEND_API_KEY` set; `EMAIL_FROM="TestQuest <no-reply@testquest.in>"`; **remove** the now-dead `RESEND_FROM` and `SMTP_*` lines.
- [ ] **`NEXT_PUBLIC_APP_URL=https://testquest.in`** — or every receipt/email link points at localhost.
- [ ] `CRON_SECRET` set (the daily expiry cron is fail-closed on it).
- [ ] JWT secret, Google OAuth id/secret — production values.
- [ ] Confirm Vercel cron (`0 4 * * *` = 09:30 IST) registered.

## 4. Cutover (the switch)
- [ ] Deploy the new-model app to production.
- [ ] Point **testquest.in** at the new app. *(The current live site is the OLD app on the OLD DB — this is a real switch. Students start at zero; clean slate as decided.)*
- [ ] Final production smoke: one real ₹ purchase (or a ₹1 test plan) → unlock → receipt.
- [ ] Keep the old app + old DB reachable briefly as **rollback**.

## 5. Watch (first 48h)
- [ ] `tq_events` funnel: signup → context → sample → paywall view → purchase.
- [ ] First purchases: order→PAID, one ClassAccess each, no double-grants (unique indexes back this).
- [ ] First emails: receipts send, no duplicates (ledger backs this), expiry cron fires 09:30 IST.
- [ ] Logs: no dead-view queries, no "table doesn't exist", no route-build 500s, header consistent across student pages.

## Parked (not launch blockers)
- Residual subject typos (`prependicular`, `Cryrtallisation`…) — content-QA sweep.
- "Edit contexts" manage-contexts UI on `/profile` (add-class sheet ships without it).
- Fuller admin E2E suite (only 2 P0 smokes automated; admin UAT is manual for now).
- Android app (phase 2) — audit-then-enhance on the same APIs; address Google Play billing.

---
*The only things between here and live: the live purchase (§1, after the price reset), a manual admin + student pass, the small AA one-liners, then §3/§4 config + deploy.*
