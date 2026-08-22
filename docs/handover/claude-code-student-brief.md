# Claude Code Brief — B2C Student Experience (Engineering)

**Version 1.0 · For a Claude Code session in `testquest-app`.** Read first, in order: `docs/handover/b2c-self-prep-persona-journey.md` (who/what — the story), `docs/handover/b2c-student-plan-v2.md` (the full spec + decisions), then this brief (the build). Companion: `docs/handover/claude-student-design-brief.md` (UI/UX). **Produce a short plan and pause for confirmation before writing code in each phase.**

## 0. The situation

The admin is done and runs on the **new clean DB** (`<db-user>_TquestTestEnv`). The **student** app is still the **old model**: it reads legacy tables (`Subscription`, `StudentAccess`, `Bundle`) and shows a legacy catalogue (competitive tracks, "386 tests", test-sets shown as subjects, everything free, a raw `&ndash;` rendering bug). It cannot run against the new DB as-is.

The good news: the machinery mostly exists. The repo already has a **full attempt engine** (`/api/attempts/*`: answer/pause/resume/submit/result), auth (`/api/auth/*`: signup/login/google/reset), a `/boards` API, and route stubs for `onboarding`, `dashboard`, `tests`, `subjects`, `videos`, `progress`, `my-subscriptions`, `pass` + `pass/success`, `checkout`. The job is to **re-point these to the new offering model and wire the subscription gate that's currently missing** — not a rewrite.

## 1. Locked decisions (do not re-litigate)
- **Sell the class, never a single test.** The purchasable unit is a **Board+Class pass** (`tq_class_access`), one-time prepaid 3/6/12 months (`tq_b2c_plans`), all subjects included.
- **Free sample:** one admin-designated test per offering (`tq_free_tests`) is sit-able without a pass; everything else is locked.
- **Videos:** chapter-linked, **complimentary with the pass**, never sold alone, **server-gated** (paid students only get the playable YouTube id).
- **Science split:** none — render whatever offerings exist per board+class.
- **Email:** **Resend** (React email templates), all sending behind one `email.ts` module so SES is a clean swap later.
- **Students start at zero.** Clean slate; no legacy user migration.

## 2. Step 0 — verify the DB and prune the phantom models (before any feature code)

The new DB has **exactly 27 `tq_*` tables** (verified): admins, attempt_answers, attempts, b2c_plans, board_classes, boards, chapters, class_access, classes, coupon_usages, coupons, email_tokens, events, free_tests, offerings, orders, question_options, questions, settings, student_contexts, students, subject_legacy_map, subjects, test_questions, tests, videos, webhook_events.

1. Run `SHOW TABLES;` against the new DB and confirm the schema matches. **Never `prisma db push`; never recreate tables.**
2. The Prisma schema still defines **legacy models with no table in this DB**: `Subscription`, `SubscriptionPlan`, `StudentAccess`, `Bundle`, `BundleTest`, and the entire B2B coaching set (`Organization`, `Batch`, `Assignment`, `OrgQuestion`, `OrgTest`, `OrgMembership`, `TeamInvite`, `InviteToken`, `OtpCode`, `PasswordResetToken`, `WeeklyReportRun`, etc.). **Any query to these crashes against this DB.**
   - Identify every **student-facing** code path that references a legacy model and re-point it to the new model (`ClassAccess` / `Order` / `B2cPlan` / `Offering` / `Chapter` / `FreeTest` / `Video`).
   - Do **not** delete the coaching (B2B) routes/models in this pass — just ensure **no student path imports or queries them**. If pruning legacy commerce models (`Subscription`/`StudentAccess`/`Bundle`) is safe (no live dependency), prune them; otherwise isolate them so student code can't reach them.
3. *Exit check:* the app boots against the new DB; `/api/auth/me`, `/boards`, and a student page load without "table doesn't exist" errors.

## 3. Access resolution — one helper, fail closed (the money-critical core)

Build a single server-side helper, e.g. `hasClassAccess(studentId, boardId, classId)`:
- Returns true only if a **non-expired** `tq_class_access` row covers that board+class **now**.
- **Fail closed:** no pass, expired, or ambiguous → locked. Never free-by-accident. (Mirror the admin's fail-closed pricing resolver.)
- A **free-sample** test is the *only* exception — sit-able without a pass.
- Gate **every** locked resource on the server: test questions on attempt-start, and video ids. Never rely on the client to hide.
- **In-flight attempts survive expiry** — the resume path precedes the access check (deliberate policy).

## 4. Phased build (do NOT do it all at once; stop and show after each phase)

**Phase 1 — Foundation: re-point + auth + onboarding.**
Point the student app at the new DB/model (Step 0). Make signup/login/Google/verify work on `tq_students` + `tq_email_tokens`. Build onboarding: board → class (→ optional second) writing `tq_student_contexts` (mark one `isPrimary`). Existing accounts with no context get the prompt once.
*Exit:* a new user signs up, verifies, onboards to CBSE·Class 9, and lands on a (possibly empty) home scoped to that context. No legacy-table errors.

**Phase 2 — Home + subject/chapter browse + free-sample spine.**
Home = `tq_student_contexts` toggle in the header + the active context's **subject cards** (offerings for that board+class). Subject page = chapters in order, each showing its tests (state: free/locked/done + last score) and videos (locked tiles for now). Wire the **free sample**: the one `tq_free_tests` test per offering is sit-able; reuse the existing attempt engine end-to-end (start→answer→submit→result). Fix the rendering (`&ndash;`, run-together text render cleanly). Everything non-sample shows **locked**.
*Exit:* onboarded user browses their class, sits a free sample via the real engine, sees a result; all non-sample items are locked.

**Phase 3 — Paywall + purchase + unlock.**
The subscription sheet for the active board+class: 3/6/12 cards priced via the shared `resolvePlanPricing` (admin's helper — reuse, don't reimplement), per-month math, "one-time, no auto-renewal", included-content summary, optional coupon (`tq_coupons`/`tq_coupon_usages`). Razorpay one-time order → verify webhook (idempotent on `tq_webhook_events`) → write `tq_orders` + grant `tq_class_access` → **instant unlock of the whole class** → return to the tapped item → receipt email. **No Razorpay mandate/auto-renew machinery.**
*Exit:* a real test purchase (test keys) unlocks the whole class, lands back on the tapped test, and `hasClassAccess` now returns true; receipt sent.

**Phase 4 — My subscriptions + videos + progress.**
My subscriptions: active passes with validity + renew (extends from current expiry, never loses days) + payment history. Videos: server-gated id (paid only), chapter-linked, playable inline; locked branded placeholder otherwise. Progress: score trend / chapter completion / weak chapters from `tq_attempts` + `tq_attempt_answers` (keep queries under the 10s ceiling).
*Exit:* a subscribed user watches a gated video, sees progress, and can renew.

**Phase 5 — Email lifecycle (Resend).**
Wire Resend behind `email.ts` (React email templates). Verification, welcome, **receipt**, **expiry series** (T-7, T-1, day-of, post-expiry win-back), unfinished-test nudge, idle win-back. All idempotent + unsubscribable (transactional exempt). Cron for the scheduled sends. Instrument `tq_events` across the funnel.
*Exit:* a purchase sends a receipt; a pass near expiry triggers the reminder; all sends idempotent.

## 5. API / mobile-readiness
Keep student read/write APIs as **stable, versioned JSON** with **bearer-token auth alongside cookies**, so the phase-2 Android app consumes the same backend unchanged. Server-paginate any large list (question banks, history).

## 6. Acceptance criteria
App runs on the new DB with **no legacy-table queries on any student path**; a fresh user can sign up → verify → onboard → browse their class → sit the free sample on the real engine → hit the paywall → buy a 3/6/12 pass → unlock the whole class → watch a gated video → see progress → renew; questions render cleanly (no raw entities / run-together text on the fixed set); videos and test questions are server-gated and fail closed; a receipt and an expiry reminder send via Resend. No `prisma db push`; no table recreated.
