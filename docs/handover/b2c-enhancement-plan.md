# Testquest B2C Enhancement Plan — Subscription Model

**Version 1.2 · July 2026 · Requirement baseline for implementation**
*(v1.1 added the Board layer, Board+Class prepaid subscriptions, multiple subscriptions with context toggle, and the Android phase-2 direction. v1.2: Android phase 2 = audit-then-enhance the existing app; video governance — server-gated video ids, locked placeholders, admin embed workflow.)*

> **What this document is:** the agreed, refined requirement for the B2C self-prep relaunch. It supersedes the phased composition of [b2c-self-prep-roadmap.md](./b2c-self-prep-roadmap.md) (the business model has changed) while [b2c-self-prep-gap-analysis.md](./b2c-self-prep-gap-analysis.md) remains valid with the corrections in §7. Implementation is split into three companion briefs: [claude-code-implementation-brief.md](./claude-code-implementation-brief.md) (engineering), [claude-design-brief.md](./claude-design-brief.md) (student UI/UX), and [claude-admin-design-brief.md](./claude-admin-design-brief.md) (admin UI/UX). **No code changes begin until those briefs are picked up.**

## 1. The model in one paragraph

Testquest B2C moves from pay-per-test to **prepaid Board+Class subscriptions**. Content is organised **Board → Class → Subject → Chapter → Tests + Videos** (boards admin-configured: CBSE, ICSE, State boards…). A student onboards by picking a board, then a class (optional second class; more contexts addable anytime). A **subscription covers one Board+Class** — every subject, all chapter-wise tests, and all complementary videos (YouTube unlisted embeds) in it — bought as a **one-time prepaid plan of 3, 6, or 12 months**, each priced by admin. Per subject, one admin-designated test is **free to sample**. Students can hold **multiple subscriptions** and toggle between contexts in the header. Per-test purchases and bundles retire for new users; existing purchases are grandfathered forever. The same API backend will later serve the **enhanced Android app (phase 2)**.

## 2. Decision log (agreed with owner, July 2026)

| # | Decision | Choice |
|---|---|---|
| D1 | Revenue timing | **Wait for subscription launch** — single cutover; live Razorpay keys installed at deploy (owner holds them) |
| D2 | Content hierarchy | **Board → Class → Subject → Chapter → Tests + Videos**; boards are admin-configured |
| D3 | Subscription unit | **Board + Class** (all subjects included). Subject-level granularity is a planned future extension — plan tables carry an unused subject field from day one |
| D4 | Billing mechanics | **Prepaid fixed-term**: one-time Razorpay payment for **3 / 6 / 12 months** of access; expiry reminders drive re-purchase. No auto-debit mandates |
| D5 | Multiple subscriptions | Allowed, unlimited; header **context toggle** switches between board+class contexts |
| D6 | Browsing contexts | Board + class (optional second class) at onboarding; **add more anytime**; every subscription auto-adds its context |
| D7 | Old commerce | **Retire for new users**; grandfather all existing `tq_student_access` rows permanently |
| D8 | Free sample | **One free test per subject** within each board+class, admin-designated |
| D9 | Video hosting | **YouTube unlisted embeds** for v1 (no DRM; accepted trade-off) |
| D10 | Android | **Enhance the existing Android app, phase 2** — owner holds the source. Phase 2 opens with a codebase audit; the app then gains the new-model screens (boards, chapters, videos, passes) calling the **same API backend as web** (API-first design starts now). Its current flows keep working during the transition; rebuild fresh only if the audit disqualifies the codebase |
| D11 | Providers | Email + SMS **provider selection is part of this plan** (§6, WS-1) |
| D12 | Out of scope / non-negotiables | None declared beyond standing constraints (§8) |

## 3. Student experience specification

**3.1 Onboarding (first login after signup).** Full-screen, ~20 seconds: (1) "Which board?" — admin-configured list; (2) "Which class?" — Classes 6–12; (3) optional second class, or skip. Stored web-side (`tq_student_contexts`); the legacy `student.class` field is untouched. Pre-existing accounts with no context get the same prompt once. "Edit contexts" reachable from the header toggle and settings.

**3.2 Home.** Header carries the **context toggle**: every board+class the student browses or is subscribed to, plus "+ add class". Below: the active context's **subject cards**. If the context is **subscribed**, all subjects show unlocked with progress (chapters attempted, next suggested test). If not, each subject card shows **Try free** (sample test CTA) and the card set sits under a single **class subscription banner** (3/6/12-month pricing teaser) — the paywall sells the whole class, not one subject.

**3.3 Subject page.** Chapters listed in order (defined per board+class+subject); each expands to its tests (ordered, with free/locked/done states and last score) and its videos (thumbnail, duration, lock state). Untagged tests appear under a trailing "More tests" group so nothing vanishes during content tagging.

**3.4 Paywall.** Tapping any locked item opens the **subscription sheet** for the active board+class: three duration cards (3 / 6 / 12 months) with admin-set prices, per-month math and savings highlighted on longer terms, included-content summary ("all N subjects · T tests · V videos"), plain statement that it's a **one-time payment valid until [date] — no auto-renewal**, pay via Razorpay. On success: instant unlock of the whole class, confirmation + receipt email, return to the exact item tapped.

**3.5 Post-subscribe.** "My subscriptions": active passes with validity dates, renew CTA (extends from current expiry, never loses days), payment history, grandfathered old purchases listed separately. "My progress" per subject: score trend, chapter completion, weak chapters (reuses analytics the dashboard API already computes). Videos playable inline. **Video governance:** the API returns a YouTube video id only to students whose pass covers it; locked video tiles show a branded placeholder with title/duration — never the YouTube thumbnail, whose URL embeds the id.

**3.6 Lifecycle communications (email-first; mobile optional for B2C).** Signup verification (non-blocking), welcome, receipt per purchase, **expiry series** (T-7 and T-1 reminders, day-of expiry notice, post-expiry win-back with renew link), unfinished-test nudge, day-7/21 idle win-back. All idempotent, all unsubscribable (transactional exempt). No dunning flow is needed — prepaid has no failed auto-charges.

## 4. Admin experience specification

New/changed admin capabilities: **board manager** (CRUD, ordering, activate); **chapter manager** (per board+class+subject; create/reorder); **bulk test→chapter tagging** (filter by board+class+subject, show untagged, multi-select assign; the same test may be tagged into chapters of multiple boards); **video manager** (paste YouTube unlisted URL → system extracts the video id and fetches the title via oEmbed; map to board/class/subject/chapter, order, activate; videos must be uploaded **Unlisted with embedding allowed** on the brand channel, and a replacement means updating the mapping — re-uploads change the id); **free-sample designation** (one test per subject per board+class); **B2C plan pricing** (per board+class: 3/6/12-month prices, activate/deactivate; schema reserves optional subject-level plans for later); **B2C revenue views** (active passes, revenue by board/class/duration, upcoming expiries, renewal rate). Bundles/coupons screens remain for legacy visibility but leave the new-user storefront.

## 5. Content-ops workstream (owner + admin, parallel to build)

Chapter-wise browsing now multiplies by board: for **each board+class you launch**, define the chapter list per subject, tag tests into chapters (reusing tests across boards where syllabi overlap), pick the free sample per subject, and curate the video library. **Decide the launch matrix early** (e.g., CBSE × Classes 9–12 first) — it bounds the tagging effort and is the true critical path for launch quality. Start the moment WS-2 admin tooling lands.

## 6. Build sequencing

Two tracks in parallel:

- **Claude Design (starts now):** onboarding (board → class), home with context toggle, subject/chapter pages, class-subscription paywall sheet (duration cards), My subscriptions, My progress, video treatment, 8 email templates, polish pass on existing screens — under the token system in the design brief.
- **Claude Code track 1 (starts now, no design dependency):** WS-1 foundations — real email provider (the current `email.ts` is a console stub, a launch blocker; selection criteria below), email verification, VPS cron, `tq_events` instrumentation, and **mobile-ready API groundwork** (bearer-token auth alongside cookies, stable versioned JSON contracts) so the phase-2 Android app consumes the same backend unchanged. Then WS-2 data model + admin tooling (boards, chapters, tagging, videos, plans).
- **Claude Code track 2 (after design handoff):** WS-3 student surfaces, WS-4 checkout/access (simplified by D4 — prepaid reuses the existing one-time order flow; **no Razorpay mandate machinery for B2C**), WS-5 lifecycle + progress.
- **Cutover (single deploy):** live keys in env, live webhook registered, storefront switched, onboarding armed for existing users, launch-matrix content populated. Smoke test: one real 3-month class purchase end-to-end.
- **Phase 2 (post-launch): Android app** — audit the existing app's codebase first; then enhance it with the new-model surfaces (boards, chapters, videos, passes) consuming the same APIs (Razorpay Android SDK hits the same order endpoints), keeping its current flows working during the transition. Rebuild fresh only if the audit disqualifies the codebase. **Google Play billing policy** must be consciously addressed before store submission: digital-goods subscriptions normally require Play Billing (15–30% fee); India's user-choice billing permits offering Razorpay alongside.

**Provider selection (WS-1, decision task):** Email — shortlist Resend / Amazon SES / Brevo; criteria: deliverability to Indian inboxes, price at ~10–50k mails/month, HTML template support, bounce webhooks. SMS — not required for B2C v1; shortlist MSG91/Twilio and note **India DLT registration lead time** if coaching SMS is wanted soon.

## 7. Verified code findings folded into this plan (July 2026 review)

Corrections to the earlier gap analysis after code inspection: **search already exists** (catalogue search box + API param); the catalogue today does **not** filter by student class (defaults to "All classes", filters reset per visit) — replaced wholesale by the context-scoped home; **no receipt email exists** on any payment path (confirmed); **no `refund.*` webhook handling** (confirmed; refund workflow deferred, urgent post-launch); **in-flight attempts already survive access expiry** (resume path precedes the access check — keep deliberately, now as stated policy); **pause/resume timer integrity is client-side and approximate** — manual QA item, policy decided in WS-3. **Critical:** `notifications.ts` emails go through `lib/email.ts`, a console-log stub returning `delivered: true` — nudges, OTP email fallback, invites, and report links are silently undelivered in production today; only the password-reset email (`lib/mail.ts`, real SMTP) works. Fixing this (WS-1) also repairs live B2B delivery.

## 8. Standing constraints (non-negotiable)

Shared production MySQL with the live legacy mobile app: **additive `tq_*` tables only**, no legacy schema changes, no `prisma db push`, legacy reads via views, legacy writes only through existing audited paths ([06-shared-database-contract.md](./06-shared-database-contract.md)). 10-second query ceiling. The legacy free/paid flag is never flipped for the free-sample mechanic (web-side `tq_free_tests`). The Android app stays as-is at web launch and will not reflect the new model until its phase-2 enhancement (accepted for launch). No automated test suite exists — every workstream extends the manual QA pack; WS-4 adds a smoke script.

## 9. Success metrics

Activation: signup → context selected (near-100% given forced onboarding); sample-test start rate. Conversion: sample → paywall view → purchase; duration mix (3 vs 6 vs 12). Revenue: active passes, revenue by board/class, ARPU. Retention: renewal rate at expiry, expiry-series email conversion, week-4 return, video engagement per subscriber. Instrumented via `tq_events` (WS-1).

## 10. Theme direction (summary — full system in the design brief)

Palette confirmed and role-assigned: Primary #6134EB (white text passes AA), Primary-deep #642CC8 (hover/links), Ink #140C3D (text), Accent #815FE9 (icons/large text only — borderline contrast), Lavender #A790EA (decorative only, never text), Background #FFFFFF. Additions: wash #F4F0FE, secondary text #4B426E, muted #837CA3, border #E6E1F5, success #1B8A5A, warning #B45309, error #D92D20. Dark mode maps primary → #815FE9. All landing in the existing token system per [05-ui-theming.md](./05-ui-theming.md).
