# Testquest B2C — Self-Prep Student: Journey Gap Analysis

**Version 1.0 · July 2026**

> **What this document is:** a prioritized analysis of gaps in the self-prep (B2C) student journey, from first visit to long-term retention. Each gap is mapped to the SRS requirement IDs in [14-srs.md](./14-srs.md) so fixes stay traceable. Gaps inferred from documentation but not yet confirmed against the codebase are tagged **[verify]**.

**Sources:** 13-user-journeys.md (ch. 1–2), 14-srs.md (FR-1 to FR-4, FR-7, FR-8, NFR-1), 12-known-gaps-and-risks.md, 04-features/01–05.

---

## 1. The journey today — stage map

| # | Stage | What happens today | Assessment |
|---|---|---|---|
| 0 | **Discover** | Lands on testquest.in: value prop, subjects, pricing, counters, testimonials, FAQ. Guest can browse the full catalogue signed out. | Solid. Guest browsing with sign-in continuation (FR-2.3 ✅) is a real strength. |
| 1 | **Sign up** | Name + email + password (min 6 chars), mobile optional — or Google one-tap. No class/board asked; no email verification. | Low friction (good), but **no email verification** and no recovery fallback (G-02). |
| 2 | **First session** | Lands on dashboard: welcome, recent activity, catalogue shortcuts. Catalogue is "filtered to their class" — but class may not be set yet. | **Undefined class-less state** is a likely first-session drop-off (G-03). |
| 3 | **Browse** | Class → subject filtering; cards show questions, duration, marks, free/paid. | Works, but subject-level only: no search, no chapters (G-08). |
| 4 | **Free attempt** | Timer, per-answer autosave, pause/resume, auto-submit at zero. | Strong. Best-engineered part of the journey (FR-3 all ✅). |
| 5 | **Result** | Instant score, correct/wrong/skipped, full review; permanent in "My attempts". | Strong, but a dead end — no "what next" recommendation (G-09). |
| 6 | **Purchase** | Buy → checkout → coupon → Razorpay (card/UPI/netbanking) → instant unlock. Zero-total coupons skip payment. | Well-built commerce engine — **but on test keys, so no real revenue** (G-01). |
| 7 | **Post-purchase** | "My purchases" lists unlocks; bundles valid for N days. | **Silent bundle expiry** (G-05); receipt/invoice email undocumented (G-07). |
| 8 | **Return & retain** | "My attempts" history, shared with the mobile app. | **Zero outbound lifecycle communication** — the platform never reaches out (G-04). |
| 9 | **Recover** | Forgot password → email link (1 h expiry). Google users re-auth with Google. | Single point of failure: the (unverified) email address (G-02, G-11). |

---

## 2. Gap register (prioritized)

Severity: 🔴 Critical · 🟠 High · 🟡 Medium · ⚪ Low — Effort: S (≤ days) / M (1–2 wks) / L (multi-week)

| ID | Gap | Stage | Sev. | Effort | FR refs |
|---|---|---|---|---|---|
| G-01 | Payments run on Razorpay **test keys** — the journey dead-ends at "Buy"; no real revenue possible | 6 | 🔴 | S (ops) | FR-4.7 🟡 |
| G-02 | **No email verification at signup** — a typo creates a working account whose only recovery path (reset email) can never arrive | 1, 9 | 🟠 | M | FR-1.1, FR-1.5 |
| G-03 | **Class-less first session undefined** — class is optional at signup, but the catalogue filters by class; what a new user sees is unspecified **[verify]** | 2 | 🟠 | S | FR-1.1, FR-2.2 |
| G-04 | **No B2C lifecycle communications** — no welcome email, no unfinished-test nudge, no re-engagement; the notification stack (notifications.ts, cron) exists but serves only coaching flows | 8 | 🟠 | M | FR-7 (scope) |
| G-05 | **Silent bundle expiry** — bundles lapse after N validity days with no warning → surprise lockouts, support load, refund demands | 7 | 🟡 | S* | FR-4.1 |
| G-06 | **Mid-attempt edge cases unspecified** — paused attempt on a test the admin later archives; bundle validity expiring while an attempt is paused/in progress **[verify]** | 4, 7 | 🟡 | S–M | FR-3.3, FR-4.1, FR-5.2 |
| G-07 | **No purchase receipt/invoice email documented** — trust signal + GST invoice expectation for Indian payments **[verify]** | 7 | 🟡 | S | FR-4.6 |
| G-08 | **No catalogue search; no chapter-level taxonomy** — ~28k questions reachable only via class → subject filters; chapters were deliberate MVP scoping | 3 | 🟡 | L | FR-2.1, FR-2.5 |
| G-09 | **No self-serve progress view** — students see a flat attempt list; trend/weak-topic analytics already exist but only inside B2B parent reports | 5, 8 | 🟡 | M | FR-7.1 (reuse) |
| G-10 | **No refund/cancellation mechanism documented** — nothing in the admin panel or policy surface for reversing an order **[verify]** | 7 | 🟡 | M | FR-4.6, FR-5.6 |
| G-11 | **Mobile number collected but unused** — optional, never verified, not usable as a recovery channel or second factor | 1, 9 | ⚪ | M | FR-1.1 |
| G-12 | **English-only content** — accepted MVP scope, but caps the State-board market the product targets | 3 | ⚪ | L | FR-2.5 (by design) |

\* G-05's effort is small, but it depends on the weekly cron actually running on the VPS (FR-7.2 🟡 — currently unverified).

## 3. Gap detail & recommendations

**G-01 — Test-mode payments (the revenue switch).** Everything downstream of "Buy" is built and verified-by-design (server-side pricing, HMAC signature checks, idempotent webhooks — FR-4.3/4.5 ✅), but no money moves. *Recommendation:* complete Razorpay KYC, install the three live env vars, register the live webhook + secret, restart, and make one real small purchase end-to-end. This is days of ops work, not engineering, and it unblocks the entire B2C business model.

**G-02 — Unverified email as the single recovery path.** Signup accepts any email unchecked; that same address is the only way back into the account. A typo'd email is invisible until the day the student needs a reset — then the account (and their purchases) are stranded. *Recommendation:* send a verification email at signup (non-blocking — don't gate first use on it); show a "verify your email" banner until confirmed; longer-term, let a verified mobile number serve as a second recovery path (see G-11).

**G-03 — The class-less first session.** The journey doc says the catalogue is filtered to the student's class, but class is no longer collected at signup. The doc doesn't say what an unset-class user sees. *Recommendation:* verify the actual behaviour in `src/app/tests/page.tsx`; then make the empty state deliberate — a one-tap "Which class are you in?" prompt on first catalogue visit, falling back to showing all classes grouped.

**G-04 — The platform never speaks to B2C students.** The only outbound messages a self-prep student can ever receive are a password-reset link and the payment moment. No welcome, no "you left a test paused", no "your bundle expires in 3 days", no win-back. All the delivery infrastructure exists (`notifications.ts`, SMTP, the cron pattern with idempotency logging) — it's simply only wired to coaching flows. *Recommendation:* a small B2C lifecycle set (see roadmap R-2.1); prerequisite is fixing the VPS cron (FR-7.2).

**G-05 — Silent bundle expiry.** Access quietly disappears after the validity window. The student experiences it as "Testquest took my tests away". *Recommendation:* T-3-days and day-of expiry emails, plus an expiry date shown on "My purchases".

**G-06 — Mid-attempt edge cases.** Soft-deleted (archived) content keeps history intact (FR-5.2), but the docs don't specify: can a paused attempt on a since-archived test be resumed? What happens if bundle validity lapses while an attempt is paused? *Recommendation:* decide the policy (grandfather in-flight attempts is the defensible default), verify code behaviour, and add both cases to the manual QA pack.

**G-07 — Receipt email.** The journeys doc calls payment confirmation a "moment that matters" but no receipt/invoice email is documented anywhere in FR-4 or the notifications feature. *Recommendation:* verify; if absent, add a branded receipt email with order details (and GST fields if applicable) triggered from the same verified-payment path that grants access.

**G-08 — Discovery depth.** Subject-level browsing over a 28k-question corpus, no search box documented. Chapter taxonomy was consciously deferred and touches the legacy-DB contract, so treat it as a bigger bet: additive `tq_*` mapping tables (question → chapter) rather than legacy schema changes.

**G-09 — Progress, not just history.** The parent-report service already computes average score, batch comparison, 4-week trend, and weak topics. None of that reaches the B2C student. A "My progress" page reusing that service is the highest-leverage retention feature available — the analytics are already written.

**G-10 — Refunds.** Payments in India generate refund requests; admins currently have order *visibility* (FR-5.6) but no documented reversal path (refund via Razorpay + access revocation + coupon-usage rollback). *Recommendation:* verify, then add an admin-side refund action with an audit trail.

## 4. What's strong — protect these

The guest → sign-in → auto-continue flow (FR-2.3); per-answer autosave and pause/resume (FR-3.2/3.3); instant scoring with full review (FR-3.5); server-side pricing, timing-safe signature verification, and idempotent webhooks (FR-4.3/4.5, NFR-1); the coupon engine's scope/limit system (FR-4.2); and one shared history with the mobile app (FR-3.6). Any change from this analysis should leave these paths untouched or covered by the manual QA pack before deploy — there is no automated test safety net (NFR-4).

## 5. Verify-in-code checklist

Before acting on **[verify]**-tagged gaps, confirm in the codebase: (1) catalogue behaviour when `student.class` is unset — `src/app/tests/page.tsx`, `src/app/api/tests/route.ts`; (2) whether any receipt email is sent post-payment — `src/app/api/orders/verify/route.ts`, `src/lib/mail.ts`; (3) resume behaviour for paused attempts on archived tests and post-expiry access checks — `src/lib/legacy-attempts.ts`; (4) whether any search parameter exists on the tests API; (5) whether any refund handling exists in the webhook handler (`refund.*` events).
