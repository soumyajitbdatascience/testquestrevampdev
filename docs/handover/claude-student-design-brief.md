# Claude Design Brief — B2C Student Experience (UI/UX)

**Version 1.0 · Companion to `claude-code-student-brief.md`.** Read `b2c-self-prep-persona-journey.md` for who we're designing for (Riya, Class 9, self-prep, price-sensitive, tries before buying). Stay inside the existing **purple token system** (`docs/handover/05-ui-theming.md`): Primary #6134EB, Ink #140C3D, wash #F4F0FE, success #1B8A5A, etc. Light default + dark; WCAG AA; ≥44px targets. The current student UI is already attractive — this is evolution, not a restyle.

## North star
Every screen should make Riya feel: *"this is mine (my board, my class), I can try before I pay, and paying is a clear one-time unlock — not a trap."* Sell the **class**, never a single test. Videos are a **complimentary** sweetener shown inside chapters.

## Screens & states

**Onboarding (new).** Full-screen, ~20s, 2–3 steps: board → class → optional second class (skippable). Big friendly choices, progress dots, no dead ends. Feels like setup, not a form.

**Home.** Header carries the **context toggle** (every board+class the student browses/owns + "＋ add class"). Body = subject cards for the active context.
- *Unsubscribed:* each card has a quiet **"Try free"**; the whole grid sits under **one class-subscription banner** (3/6/12 teaser). The paywall sells the class.
- *Subscribed:* cards show progress (chapters attempted, next suggested test); no banner.
- Guided empty state if a context has no content yet.

**Subject page.** Chapters in order; each expands to its **tests** (state chips: free / locked / done + last score) and its **videos** (thumbnail/duration + lock state) — tests and videos together per chapter. Untagged tests under a trailing "More tests" group.

**Test-taking (reuse the existing player — it's good).** Keep the question navigator, flag-for-review, practice-mode messaging, and the submit-confirmation sheet. Just ensure content renders cleanly (no raw `&ndash;`, no run-together words) and locked tests route to the paywall instead of opening.

**Paywall sheet.** One sheet for the active board+class: three duration cards (3/6/12), admin prices, **per-month math** + savings highlighted on longer terms, included-content summary ("all N subjects · T tests · V videos"), a plain line: **"One-time payment, valid until [date] — no auto-renewal."** Coupon field. Razorpay CTA. On success: a celebratory confirmation → return to the exact item tapped.

**My subscriptions.** Active passes with validity dates; **renew** CTA (extends from expiry); payment history; grandfathered/none for v1.

**Progress.** Score trend, chapter completion, weak chapters — reuse the dashboard's visual language. Honest empty states ("complete more tests to see your trend").

**Video treatment.** Playable inline when unlocked. When locked: a **branded placeholder** with title + duration — **never** the YouTube thumbnail (its URL leaks the id). Locked videos still visible as "what you'll unlock."

**Emails (8 templates).** Verification, welcome, receipt, expiry T-7 / T-1 / day-of / win-back, nudges — on-brand, mobile-first, clear single CTA, unsubscribe on non-transactional.

## Principles
- **Lock states sell, not scold** — a locked item should look like value waiting, with a soft path to the paywall.
- **Momentum:** progress rings, "next suggested test", score-up moments.
- **Honesty in commerce:** always show it's one-time, the exact expiry date, and exactly what's included.
- **Mobile-first layouts** (Android is phase 2, but design for small screens now).
- Consistent purple tokens, dark mode, AA contrast, ≥44px targets, keyboard-friendly.

## Out of scope
B2B coaching screens, Android-native work, per-test pricing (retired). Hand finished screens/states to the engineering phases in `claude-code-student-brief.md`.
