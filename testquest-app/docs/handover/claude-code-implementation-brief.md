# Claude Code Implementation Brief — Testquest B2C Subscription Model

**Version 1.2** *(v1.1: Board layer; subscription unit = Board+Class; billing = prepaid fixed-term 3/6/12 months via one-time orders — Razorpay mandate machinery is NOT used for B2C; APIs mobile-ready for phase-2 Android. v1.2: phase 2 = audit-then-enhance the existing Android app; video-id gating rules.)*

**Audience:** a Claude Code session working in the `testquest-app` repository. Read this first, then: `CLAUDE.md` (repo root), `docs/handover/06-shared-database-contract.md` (**before any DB work**), `docs/handover/b2c-enhancement-plan.md` (the requirement — source of truth for scope), and the feature files in `docs/handover/04-features/`.

## 0. Hard rules

1. **Never run `npx prisma db push`.** Schema changes = hand-written additive SQL migrations creating new `tq_*` tables only. Never ALTER/DROP legacy tables — a live legacy mobile app reads them.
2. Legacy data: read via `vw_*` views; write only through the existing audited paths (`legacy-students.ts`, `legacy-attempts.ts`, `legacy-admin.ts`). This project adds **no** new legacy writes.
3. Never flip legacy free/paid flags for the free-sample feature. Use the new `tq_free_tests` table.
4. Shared Hostinger MySQL kills queries >10 s — no per-row correlated subqueries; test list endpoints against the ~28k-question corpus.
5. Single production DB, no staging, no automated tests today. Extend `docs/MANUAL_TEST_CASES.md` per workstream; WS-4 adds a smoke script (auth → sample test → purchase plan → unlock).
6. Razorpay stays on test keys throughout the build; owner installs live keys at cutover. Payment paths must behave identically on both.
7. Student-facing UI (WS-3/4/5 screens) comes from the Claude Design handoff specs — do not invent those layouts; build WS-1/WS-2 first while design is in progress.
8. **API-first for Android phase 2:** every new/changed API must be consumable by a future mobile client — support `Authorization: Bearer <jwt>` alongside the httpOnly cookie in `lib/auth.ts`, keep responses as stable versioned JSON (no HTML-coupled shapes), and document each endpoint (path, auth, request/response) in a growing `docs/api-contract.md`. Breaking an API contract after launch is forbidden without versioning.

## 1. What exists that you must reuse

- **One-time order flow (this is now the B2C billing backbone):** `app/api/orders/create` + `orders/verify` (signature check, idempotent-ish grant) + `payment.captured` in `app/api/razorpay/webhook/route.ts` (with `tq_webhook_events` idempotency). Extend with a new order item type for plan purchases. The B2B `subscription.*` mandate handling stays untouched (coaching still uses it) — **do not** route B2C through it.
- **Notifications:** `lib/notifications.ts` orchestrator. **Critical:** its email channel `lib/email.ts` is a console stub returning `delivered: true` (see its `EMAIL_V2_TODO`). WS-1 replaces the stub body with a real provider, keeping the `sendEmail(msg)` interface. `lib/mail.ts` (Nodemailer, password reset) is real — consolidate onto the chosen provider.
- **Cron pattern:** `app/api/cron/weekly-reports/route.ts` + `CRON_SECRET` + `tq_weekly_report_runs` idempotency log. Copy for new jobs; production needs VPS crontab entries (document in `09-deployment-operations.md`).
- **Analytics queries:** `app/api/student/dashboard/route.ts` already computes per-subject averages and a 10-attempt trend — My Progress starts from these.
- **Auth/session:** JWT via `lib/auth.ts`; Zod on every route; `requireAuth("student")`.
- **Attempt engine:** untouched. Note the +1,000,000 practice-test id offset; `tq_student_access.testId` FK accepts only main-test ids (<1M). For new tables storing test ids, store the **encoded** id and document it consistently.

## 2. Data model (additive `tq_*` tables — proposed, refine as needed)

- `tq_boards` — id, name, code, sort_order, is_active. Admin CRUD.
- `tq_student_contexts` — id, student_id, board_id, class_id, is_primary, created_at. UNIQUE(student_id, board_id, class_id). Onboarding creates 1–2; students add more anytime; a purchase auto-creates its context if missing.
- `tq_chapters` — id, board_id, class_id, subject_id, name, sort_order, is_active. Chapter lists are **per board+class+subject**.
- `tq_chapter_tests` — chapter_id, test_id (encoded), sort_order. UNIQUE(chapter_id, test_id). A test may appear in chapters of different boards (syllabus reuse); within one board+class+subject it lives in one chapter (enforce in app code). Untagged tests render under a virtual "More tests" group — no DB row.
- `tq_videos` — id, board_id, class_id, subject_id, chapter_id (nullable), title, description, provider ENUM('YOUTUBE'), video_ref (YouTube id, not full URL), duration_seconds, sort_order, is_active. **Security rule: `video_ref` appears in API responses only when the requesting student's pass covers the video (or the caller is admin). Locked-video payloads carry title, duration, and lock state with a generic branded placeholder — never the YouTube id and never a YouTube thumbnail URL (`img.youtube.com/vi/<id>/…` leaks the id).**
- `tq_free_tests` — board_id, class_id, subject_id, test_id. UNIQUE(board_id, class_id, subject_id) — one sample per subject per board+class.
- `tq_b2c_plans` — id, board_id, class_id, subject_id (nullable — **NULL at launch**; reserved for future subject-level plans), duration_months (3|6|12), price, is_active. UNIQUE(board_id, class_id, subject_id, duration_months). No Razorpay plan objects needed — prepaid one-time payments.
- `tq_class_access` — id, student_id, board_id, class_id, plan_id, order_id, starts_at, expires_at, created_at. **One row per purchase** (history preserved). Renewal inserts a new row starting at `max(now, current expires_at)` so unused days are never lost. "Active pass" = any row with expires_at > now.
- `tq_orders` extension — new itemType `B2C_PLAN` + planId reference (additive column or reuse pattern consistent with existing soft refs; prefer an explicit nullable `planId`).
- `tq_events` — id, student_id (nullable), name, properties JSON, created_at. Index (name, created_at).

**Access resolution (heart of WS-4):** one helper, `lib/access.ts` → `resolveTestAccess(studentId, testId)` returning `{access, reason: 'FREE_SAMPLE'|'GRANDFATHERED'|'CLASS_PASS'|'ASSIGNMENT'|'NONE'}`: free sample via `tq_free_tests`; grandfathered via `tq_student_access` (existing expiry semantics); active `tq_class_access` row whose (board, class) covers the test — note a test's board comes from its chapter tagging; an untagged test in a subscribed class counts as covered ("More tests" bucket); org assignment (existing B2B path). Replace scattered checks in `api/tests`, `api/tests/[id]`, `api/attempts` with this helper. Preserve the verified behaviour that **in-flight attempts resume regardless of expiry** (resume check precedes access check in `api/attempts/route.ts`) — keep as explicit, commented policy.

## 3. Workstreams

**WS-1 Foundations (start immediately — no design dependency).**
(a) Email provider: evaluate Resend / SES / Brevo (deliverability to Indian inboxes, price at 10–50k/month, HTML support, bounce webhooks); implement inside `lib/email.ts` keeping its interface; migrate `mail.ts` onto it; env-flag preserves dev console logging. *Acceptance: a coaching reminder nudge lands in a real inbox.*
(b) Email verification: additive storage per DB contract; non-blocking banner flow. (c) Cron: verify/document VPS crontab. (d) `tq_events` + `track()` helper wired into signup, context-set, test start/submit, paywall view, purchase. (e) **Bearer-token auth**: `lib/auth.ts` accepts `Authorization: Bearer` as an alternative to the cookie; start `docs/api-contract.md`.

**WS-2 Taxonomy, videos, plans & admin tooling (start immediately).** Migrations for all §2 tables. Admin screens (existing patterns under `src/app/admin/(authenticated)/`): board manager; chapter manager; bulk test→chapter tagging (filter board+class+subject, show untagged, multi-select assign); video manager (paste unlisted URL → extract the 11-char id, fetch title via YouTube oEmbed — no API key needed — store the id, never the URL); free-sample picker; **plan pricing manager** (grid: board+class × {3,6,12} months, price + active). *Acceptance: admin can fully populate one board+class (chapters, tagged tests, videos, samples, 3 plan prices) without touching the DB.*

**WS-3 Onboarding & student surfaces (after design handoff).** Board→class onboarding (gate: student with zero `tq_student_contexts` rows → prompt once, including pre-existing accounts); context toggle (server-persisted active context; lists contexts + active passes + "add"); home subject cards (subscribed-class vs try-free/locked states per design); subject/chapter page; video embed (youtube-nocookie iframe, lazy-loaded); "More tests" bucket; retire per-test storefront entry points for new users. *Acceptance: matches design specs; a context-less legacy account is prompted exactly once.*

**WS-4 Checkout, passes & access (backend can start pre-design).** Purchase flow: subscription sheet → `orders/create` with itemType B2C_PLAN (server-side price from `tq_b2c_plans`) → Razorpay one-time checkout → `orders/verify` AND `payment.captured` webhook both (idempotently) insert the `tq_class_access` row and auto-create the student context. Renewal = same flow; new row chains from current expiry. `resolveTestAccess` rollout across tests/attempts APIs. My Subscriptions endpoint + cancel-nothing (prepaid: no cancellation mechanics, just expiry). Smoke script. *Acceptance: on test keys — sample test free; locked test paywalls; buying a 3-month plan unlocks every subject + video in the class instantly; webhook replay causes no duplicate access rows; renewal extends, never truncates.*

**WS-5 Lifecycle & progress (after WS-1 + design email templates).** Jobs (cron pattern, each idempotent via a run log): expiry series (T-7, T-1, day-of, post-expiry win-back with renew deep-link), unfinished-test nudge (24–48 h), idle win-back (day 7/21). Transactional: verification, welcome, receipt per purchase (from the verified-payment path). My Progress: extend dashboard queries to chapter-level completion per subscribed context; weak-chapter links into subject pages. *Acceptance: re-running any job sends nothing new; unsubscribe honored for non-transactional.*

## 4. Cutover checklist (owner + Claude Code together)

Env: live `RAZORPAY_KEY_ID/KEY_SECRET/WEBHOOK_SECRET` (owner holds keys), live webhook registered for payment events; email provider prod keys; `CRON_SECRET` + crontab verified. Deploy: storefront switch behind an env flag (rollback = flip flag, not revert), onboarding armed, launch-matrix boards/classes populated by content-ops. Verify: one real 3-month purchase — receipt email received, `tq_webhook_events` row present, whole class unlocked, admin revenue view correct.

## 5. Out of scope for this build

The Android app itself (phase 2 — this build's obligation is only the mobile-ready APIs of rule 8. Phase 2 audits the existing app's source, then enhances it against these same endpoints — Razorpay Android SDK for payments; Google Play billing-policy stance decided before store submission). Legacy mobile-app changes. WhatsApp provider. Refund workflow (post-launch priority — webhook currently ignores `refund.*`). Coupons for plans. Chapter tagging for individual *questions*. Parent accounts. Multi-language. B2B changes beyond the shared email fix.
