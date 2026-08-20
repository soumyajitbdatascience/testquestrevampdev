# Student Module — End-to-End Test Guide (Manual UAT)

**Plain-English walkthrough to test the whole student experience by hand.** The counterpart to the admin UAT: unit tests prove the logic; this proves the *journey* in a real browser, and it's how you sign the module off before cutover. Work top to bottom. Each step: **do this → expect this**. Note anything that doesn't match (template at the end).

**Before you start:**
- Run against the new-DB app (the one all five phases were built on), signed out.
- Have a Razorpay **test** card ready: `4111 1111 1111 1111`, any future expiry, any CVV (or UPI `success@razorpay`).
- Two known conditions so they don't surprise you: **videos** — add one unlisted YouTube video via admin first (otherwise video tiles are correctly empty and there's nothing to prove gating against). **Email links** point at `localhost` until production sets `NEXT_PUBLIC_APP_URL` — fine for testing.

---

## Part 0 — Things to confirm first
1. Signed out, open `/onboarding` (or any student page) directly → **expect** bounced to login, not a dead 401.
2. The old catalogue is gone → **expect** no competitive tracks (UPSC/IPM), no "386 tests", no test-set shown as a subject anywhere.
3. Questions render cleanly → **expect** no raw `&ndash;`, no run-together words on the fixed set (e.g. the ex-"locomotaryorgan" question now reads "locomotary organ").

---

## Part 1 — The money path (one full journey, ~10 min)
Do it as one story — this is the revenue loop end to end.

1. **Sign up** (email + password) → verify email → **expect** a verification email and a welcome email (check `soumy.zit@gmail.com`; both should render on-brand).
2. **Onboard** → pick **CBSE → Class 9** (optionally a second class) → **expect** ~20-second flow, lands on a home scoped to that context.
3. **Home** → **expect** subject cards for Class 9, each with **"Try free"**, and one **class-subscription banner** (3/6/12) above the grid. No prices trusted from the page.
4. **Sit a free sample** → open a subject → its one free test → **expect** the real player (question navigator, flag, practice mode), a **result** page with score, and a nudge to unlock.
5. **Hit the paywall** → tap any *locked* test → **expect** the subscription sheet for CBSE·Class 9: three cards (3/6/12), per-month math, "one-time payment, valid until [date] — no auto-renewal", included-content summary.
6. **Apply a coupon** (e.g. `LAUNCH25`) → **expect** the discount recomputes server-side and shows on the sheet.
7. **Pay** with the test card → **expect** order → **PAID**, the **whole class unlocks** (not just that test), you **land back on the exact test you tapped**, and a **receipt email** arrives (₹ amounts + "valid until" correct).
8. **My subscriptions** → **expect** the active pass with its validity date and a **renew** CTA that says it extends from expiry.

If all 8 hold, the revenue engine works.

---

## Part 2 — Screen by screen
- **Context toggle** (header) — switch between classes / "+ add class" → **expect** the whole home re-scopes.
- **Subject page** — chapters in order; each shows its **tests** (free / locked / done + last score) and **videos** together; untagged tests under "More tests".
- **Attempt engine** — pause and resume mid-test → **expect** same questions, same order, answers preserved; paused time not counted. Multi-select question → **expect** all-correct-required scoring.
- **Result / history** — **expect** score, and History lists every attempt.
- **Progress** — **expect** score trend, weak chapters (needs ≥5 answers before flagging), honest empty states.
- **Renew** — buy again while active → **expect** it **extends from current expiry** (never loses days), not a restart.

---

## Part 3 — Negative & edge (try to break it)
- **Locked gating** — with no pass, everything but the sample is locked; a locked test routes to the paywall, never opens.
- **Fail-closed** — you cannot reach a locked test's questions or a locked video's id by fiddling the URL.
- **Video gating** — with the seeded video: no pass → locked branded placeholder (never a YouTube thumbnail); active pass → plays. A pass that **hasn't started yet** → still locked.
- **Payment failure / closed modal** — cancel Razorpay → **expect** no pass granted, order not PAID.
- **Unsubscribe** — click unsubscribe in a marketing email → **expect** marketing emails stop, but a **receipt still sends** (transactional).
- **Expired pass** (if you can set one) → **expect** the class locks again.

---

## Part 4 — The money path, watched closely (this is the sign-off)
This is the live proof still outstanding. After the purchase in Part 1:
- **Order** flips PENDING → PAID (one row).
- **One `tq_class_access`** row with the right window (today → +3 months).
- `hasClassAccess` true → every locked test in the class opens.
- **Exactly one receipt** (buy once → one email; the duplicate-suppression ledger prevents doubles).
- Amounts in the receipt match the sheet (₹ shown, no raw paise).

---

## How to report
```
Screen / step:
What I did:
Expected:
Got:
Severity: blocker / annoying / cosmetic
```
Send me the list; I'll turn real bugs into a Claude Code fix brief and confirm the money-path result before you flip production. When this pass is clean, the Student Module is signed off and we move to the cutover config (`§3/§4` of the cutover checklist).
