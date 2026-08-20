# The Self-Prep Student — Quick Read

## Who
**Riya, Class 9, CBSE.** Studies at home on a laptop (phone later). Wants **chapter-wise practice for her own board** — not generic, not competitive (no UPSC/JEE). Price-sensitive: **tries before paying**, wants to **pay once**, no auto-renew surprises.

## Her loop (the whole thing in six beats)
1. **Signs up → 20-sec onboarding:** picks board (CBSE) + class (9). Now everything she sees is *hers*.
2. **Home = subject cards**, not a test list. Unsubscribed: each shows **"Try free"** under one banner that sells the *whole class*.
3. **Sits the free sample** — one per subject. Good question player (jump, flag, practice mode) → score + review → nudge to unlock.
4. **Paywall, honest:** one sheet for CBSE Class 9 — 3 / 6 / 12 months, admin prices, "one-time, no auto-renewal", lists everything included → pays once via Razorpay.
5. **Pays → the whole class unlocks** (not just that test), lands back where she was, gets a receipt. She now holds a **pass** with an expiry.
6. **Studies:** chapters in order — each chapter shows its **tests and its videos together**. **Videos are complimentary** (included with the pass, chapter-linked, never sold alone; gated so only paid students get the playable video). Progress, history. **Reminders** before expiry → one-tap renew. Adds another class anytime → **header toggle** switches contexts.

Core idea throughout: **we sell the class, never a single test** — and videos are the complimentary sweetener inside it.

## How close are we
The deployed app is still the **old model** (competitive tracks, "386 tests", test-sets shown as subjects, all free, no board/subscription, a `&ndash;` rendering bug) — can't ship as-is.

**Already built (reuse):** the full test engine (answer/pause/resume/submit/result), history, auth, and route stubs for onboarding, my-subscriptions, pass/checkout, subjects, videos, progress + a boards API.

**To build/re-point:** point to the new offering model · onboarding (board→class) · home with "Try free" + context toggle · free-sample gating · paywall→Razorpay→class pass→unlock→receipt · my-subscriptions/renew · gated videos · progress on new data · real email provider · fix rendering.

## Decisions (locked)
1. **Science split** — dropped. Home renders whatever subjects exist (today: separate Bio/Chem/Physics as migrated). Consolidate in admin later if ever wanted.
2. **Videos** — chapter-linked, complimentary with the pass, gated. Not sold separately.
3. **Email provider** — **Resend** (React templates, fast setup, bounce webhooks, free tier covers launch). SES kept as the future cost play behind one `email.ts` module.

---
*Next: turn this into the Claude Code handoff (engineering + design briefs), phased — re-point → onboarding → home → free sample first, then paywall.*
