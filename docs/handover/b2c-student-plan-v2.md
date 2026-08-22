# B2C Student Experience — Refreshed Plan (v2.0, post-cutover)

**August 2026 · Supersedes the pre-cutover assumptions in b2c-enhancement-plan.md v1.2.** The *experience* from v1.2 stands; this refresh re-bases it on the clean new DB + decoupled offering model, drops the obsolete legacy-shared-DB constraints, and plans the **full experience** (loop + videos + progress + email lifecycle) as the first release. Written **neutral on the Science-vs-split content decision** so design isn't blocked.

---

## 1. What changed since v1.2 (the foundation, not the experience)

v1.2 assumed the student app lived on the **shared legacy production DB**, so it carried heavy handcuffs (additive tables only, legacy reads via `vw_*` views, don't touch the free/paid flag, work around the old catalogue). **All of that is gone.** We did the clean cutover:

- New DB `<db-user>_TquestTestEnv`, decoupled model (Board · Class · Subject → **Offering** → Chapter → Tests + Videos; shared question bank).
- **Students start at zero** — no legacy migration, no grandfathering complexity for v1.
- The **admin already writes every table the student reads** (offerings, chapters, tests, free samples, videos, plans, orders, class-access) and the shared logic (`resolvePlanPricing`, launch-readiness) is built and unit-tested.

Net effect: the student side is now **greenfield, built in the same Next.js app**, reading a clean schema. The old gap-analysis (legacy catalogue quirks) is mostly moot.

**The schema is already there.** The admin's `05-create-app-schema.sql` created the full app layer: `tq_students`, `tq_student_contexts`, `tq_attempts`, `tq_attempt_answers`, `tq_orders`, `tq_class_access`, `tq_coupons`, `tq_coupon_usages`, `tq_webhook_events`, `tq_events`, `tq_email_tokens`, `tq_videos`, `tq_settings`. So this build is **surfaces + APIs + payment wiring + a real email provider**, not new tables.

---

## 2. The model in one paragraph (offering language)

A student onboards by picking a **board** then a **class** (optional second class) — that's a *context*, no payment. Each context shows its **subjects**; each subject is an **offering** (Board+Class+Subject) with chapter-wise tests and complementary videos. Per offering, one admin-designated test is a **free sample**. Everything else is unlocked by a **prepaid Board+Class pass** (`tq_class_access`) bought as a one-time **3 / 6 / 12-month** plan (`tq_b2c_plans`, admin-priced) via Razorpay — the pass covers **every subject in that Board+Class**. Students hold **multiple passes** and switch with a header **context toggle**. Passes expire; reminder emails drive re-purchase. No auto-renew.

---

## 3. Student journey specification (full experience)

### 3.1 Auth & onboarding
- Signup (email + password), **email verification** (non-blocking — they can look around, gated actions require verified). Uses `tq_students` + `tq_email_tokens`.
- **Onboarding, ~20s:** board → class → optional second class. Writes `tq_student_contexts`. Re-openable from the header ("+ add class") and settings.

### 3.2 Home + context toggle
- Header **context toggle**: every board+class the student browses or holds a pass for, plus "+ add class".
- Body: the active context's **subject cards**.
  - **Subscribed context:** all subjects unlocked, each card showing progress (chapters attempted, next suggested test).
  - **Unsubscribed context:** each card shows **Try free** (its sample), and the whole grid sits under **one class-subscription banner** (3/6/12 pricing teaser). The paywall sells the *class*, not a subject.

### 3.3 Subject (offering) page
- Chapters in admin-defined order; each expands to its **tests** (ordered; states: free / locked / done + last score) and **videos** (thumbnail, duration, lock state).
- Any untagged tests appear under a trailing **"More tests"** group so nothing vanishes mid-tagging.

### 3.4 Free sample
- The one sample test per offering is sit-able without a pass (reads `tq_free_tests`). Completing it records an attempt and nudges toward the paywall ("you scored X — unlock all N tests").

### 3.5 Paywall & purchase
- Tapping any locked item opens the **subscription sheet** for the active board+class: three duration cards (admin prices via `resolvePlanPricing`), per-month math + longer-term savings, included-content summary ("all N subjects · T tests · V videos"), plain "**one-time payment, valid until [date] — no auto-renewal**".
- Optional **coupon** field (reads `tq_coupons`, records `tq_coupon_usages`).
- Pay via **Razorpay** (one-time order — reuse the existing order flow; **no mandate machinery**). On success (`tq_webhook_events` → `tq_orders` → `tq_class_access`): instant unlock of the whole class, **receipt email**, land back on the exact item tapped.

### 3.6 Post-purchase: My subscriptions
- Active passes with validity dates; **renew** CTA extends from current expiry (never loses days); payment history.

### 3.7 Progress
- Per subject: score trend, chapter completion, weak chapters — from `tq_attempts` / `tq_attempt_answers`. Reuse whatever analytics the app already computes; keep queries under the 10s ceiling.

### 3.8 Videos & governance
- Complementary YouTube **unlisted** embeds, **mapped to a chapter**. On the subject page each chapter shows its **tests and its videos together**.
- **Complimentary, not a product:** videos are included with the class pass and are **never sold separately** — they're the value-add that makes the subscription feel richer.
- **Server-gated:** the API returns a YouTube video id **only** to students whose pass covers that class. Locked tiles show a **branded placeholder** with title/duration — never the YouTube thumbnail (its URL leaks the id). (An unsubscribed student sees videos exist, locked, as a selling point.)

### 3.9 Email lifecycle (full, from day one)
Signup verification, welcome, **receipt per purchase**, **expiry series** (T-7, T-1, day-of, post-expiry win-back with renew link), unfinished-test nudge, day-7/21 idle win-back. All idempotent, all unsubscribable (transactional exempt). No dunning (prepaid has no failed charges). **Blocker:** the current `email.ts` is a console stub — a **real provider** (Resend / SES / Brevo) must land first.

---

## 4. Data model — reuse vs build

**Already exists (admin build):** offerings, chapters, tests, questions, free_tests, videos, b2c_plans, coupons, orders, class_access, coupon_usages, webhook_events, students, student_contexts, attempts, attempt_answers, events, email_tokens, settings.

**To build (mostly logic/surfaces, not schema):**
- Student **read APIs**: context list, home grid (offerings for a board+class + lock state), subject page (chapters+tests+videos scoped to offering), free-sample fetch.
- **Access resolution**: "does this student's `tq_class_access` cover this offering right now?" — one shared helper, mirroring the admin's fail-closed pricing.
- **Attempt engine**: start/resume/submit a test → `tq_attempts` + `tq_attempt_answers`; score; last-score surfacing. (Confirm how much of this already exists vs needs building — first task of the build.)
- **Checkout/webhook**: order create → Razorpay → webhook verify → grant `tq_class_access`. Idempotent on `tq_webhook_events`.
- **Video id gating** endpoint.
- **Email**: real provider + templates + send/idempotency + `tq_email_tokens` for verify/unsubscribe.
- **Events**: `tq_events` instrumentation for the funnel.

---

## 5. Access control & security (the money-critical part)
- **Fail closed:** no pass, expired pass, or ambiguous state → locked. Never free-by-accident (same principle the admin's pricing resolver already unit-tests).
- Gate **server-side** on every locked resource (test questions, video ids) — never trust the client to hide.
- **In-flight attempts survive expiry** (resume path precedes the access check) — keep as deliberate policy.
- Webhook signature verified; grants are idempotent.

---

## 6. Neutral on the Science decision
Home renders **whatever offerings exist** for the board+class — one "Science" card or three (Biology/Chemistry/Physics) both just work, since each is an offering with its own free sample. The only user-visible difference is card count and number of free samples. **No design or code depends on the choice**; settle it as content during the admin pass and the home grid adapts.

---

## 7. Build sequencing (parallel tracks)

- **Design (starts now):** onboarding, home + context toggle, subject/chapter page, class paywall sheet, My subscriptions, progress, video treatment, email templates — under the purple token system.
- **Code track 1 (now, no design dependency):** real email provider + verification, `tq_events` instrumentation, mobile-ready API groundwork (bearer-token auth alongside cookies, versioned JSON), access-resolution helper.
- **Code track 2 (after design handoff):** student read surfaces → attempt engine → checkout/webhook/unlock → my-subscriptions/renew → progress → video gating → full email lifecycle.
- **Cutover (single deploy):** live Razorpay keys + webhook, onboarding armed, content priced (done in admin), smoke test = one real 3-month purchase end-to-end.
- **Phase 2 (post-launch):** Android — audit then enhance, same APIs; address Google Play billing (India user-choice billing lets Razorpay stand alongside).

---

## 8. Decisions (resolved) + remaining
**Resolved (Aug 2026):**
1. **Science split — dropped.** Home renders whatever subjects/offerings exist for the class (today: separate Bio/Chem/Physics as migrated). Optional admin consolidation later; not a blocker.
2. **Videos — chapter-linked, complimentary, gated.** Included with the class pass, shown under each chapter alongside tests, never sold alone (see §3.8).
3. **Email provider — Resend.** React email templates (matches the stack), fast domain verify, bounce/delivery webhooks, free tier covers launch (~$20/mo at 50k). All sending stays behind one `email.ts` module so **SES** is a clean migration later if volume makes cost matter.

**Remaining (audit at build start, not blockers):**
4. **Attempt engine reuse** — the repo already has the full engine (`/api/attempts/*`: answer/pause/resume/submit/result) and route stubs for onboarding, my-subscriptions, pass/checkout, subjects, videos, progress. First build task = confirm which read the old model vs new, and re-point.
5. **Grandfathering** — students start at zero; assume clean slate (no legacy users to carry) unless told otherwise.

---

## 9. Success metrics (via `tq_events`)
Activation: signup → context selected → sample started. Conversion: sample → paywall view → purchase; 3/6/12 mix. Revenue: active passes, revenue by board/class, ARPU. Retention: renewal rate at expiry, expiry-email conversion, week-4 return, video engagement per subscriber.
