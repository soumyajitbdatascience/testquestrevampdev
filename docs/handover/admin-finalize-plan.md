# Admin Module — Finalize Plan (Review · Critical Analysis · Next Steps)

**Version 1.0 · August 2026 · New DB `<db-user>_TquestTestEnv`.** This is the "lock the Admin Module before we start Student" plan. Read order: this doc → the unit-test brief in §3 goes to Claude Code now; §4 (the 148 damaged questions) is a data fix I run from the old DB; §2 (UI/UX) is the next pass, documented here so nothing is lost.

---

## 1. Honest read of where the admin stands

The revamp landed and the structure is right. The workspace model works, 30 offerings exist, the masters are clean (no test-set posing as a subject anymore), questions render, and Launch Readiness is live. That was the hard part.

Three things sit between "it renders" and "it's truthfully finished," and only one is cosmetic:

1. **Launch Readiness shows 0 of 30 ready — and it's correct.** Nothing is priced, so every offering fails the last check ("plan priced & active"). This is an empty field, not a bug. Fixing it is data entry, but the UI should make it a five-minute job, not a 30-cell grind (see §2, P0).
2. **The "content damaged" counter is real but over-counted.** The tray flagged ~221; the true number of questions with run-together words (e.g. "vegetativelythrough", "followingcompounds") is **148** — about 2.7% of the bank. The other ~70 were false alarms: base64 image data and MathML that the flag mistook for damage. The 148 came from my migration cleaning step (I stripped HTML tags without leaving a space where two words met). This is a **data fix from the old DB**, not an admin UI task — see §4.
3. **The small content gaps are legitimate to-dos**, and the Needs-Attention tray already lists them correctly: 3 Social Science offerings with no chapters, 4 offerings with no free sample, 3 with no tests, 1 test with no questions. Not defects — a work queue.

Mental model to hold: **one data-entry gap (pricing), one data-quality fix I owe you (148 questions), a handful of real content to-dos, and a solid structure underneath.**

---

## 2. UI/UX fixes — prioritized (NEXT pass, not this one)

Split by "unblocks a truthful green admin" vs "makes it feel finished," so we don't polish pixels while pricing is empty. *(You scoped this pass to unit testing, so this section is the plan of record for the pass after tests land.)*

**P0 — flips Launch Readiness off zero**

- **Bulk pricing on the Plans grid.** Let one price fill all three of 3/6/12 columns, and "copy this row to all classes." Pricing 7 board+class rows should take a minute. This is the single highest-leverage fix — it's what moves readiness from 0/30.
- **Readiness deep links land on the exact tab, thing-to-fix in focus.** Every unmet check is already meant to be a one-click jump into that offering's workspace; verify it opens the right tab (Chapters/Questions/Tests/Free-sample) and not just the offering home.

**P1 — makes it trustworthy**

- **"Needs review" filter in each offering's Questions tab** — surfaces the suspected-damaged rows as a reviewable queue (after §4's source fix, for eyeballing stragglers), instead of a scary global counter.
- **Guided empty states** on the chapterless/testless offerings — "No chapters yet — add your first," with the button right there.

**P2 — polish**

- Compact density, keyboard nav (`/` focus search, Enter commits, Esc cancels), undo toasts, consistent purple tokens, ≥44px targets, WCAG AA. Real, but after P0/P1.

---

## 3. Unit-testing brief (THIS pass · for Claude Code)

**Goal:** pin down the admin's behaviour so we can finalize it and refactor later without fear. Not chasing 100% coverage — cover the API routes and the two pieces of logic that quietly corrupt data or lie to the user if wrong: **launch-readiness** and **pricing/access resolution**.

### 3.1 Framework & setup

- **Vitest** (fast, TS-native, works with Next 16). Add `vitest`, `@vitest/coverage-v8`, and `vitest-mock-extended` (or `prismock`) for mocking Prisma.
- Put tests in `src/**/__tests__/*.test.ts` or `tests/`. Add `"test": "vitest run"` and `"test:watch": "vitest"` to `package.json`.
- **Mock Prisma for logic/route tests** — do NOT hit Hostinger in unit tests. Inject a mocked `PrismaClient` (deep mock) so tests are deterministic and offline.
- Keep a **small integration set** (optional, tagged separately) for DB-enforced invariants against a disposable schema — but the app must ALSO guard these in code (see below), and that guard is what we unit-test.

### 3.2 What to test

**A. API route handlers — CRUD + validation** (boards, classes, subjects, offerings, chapters, questions, tests, plans, free-tests). For each resource:

- create returns the row / 200; missing required field → 400.
- update/patch persists; unknown id → 404.
- list is server-paginated (assert it passes `take`/`skip`, never fetches all 5,473 questions unbounded).

**B. Invariants (the ones that cause silent corruption):**

- **Offering uniqueness** — creating a second offering with the same (boardId, classId, subjectId) is rejected by the app layer, not just the DB constraint.
- **Subject is a pure master** — the create/update path has no `classId` and rejects it if sent.
- **Free sample validity** — you cannot set an offering's free sample to a test that has zero questions.
- **Chapter/Test belong to an offering** — creating a chapter or test requires a valid `offeringId`; content never attaches to a bare subject.
- **Plan durations** — only 3 / 6 / 12 months accepted; price ≥ 0.

**C. Launch-readiness computation** (the function behind the home page). Feed fixtures and assert the rolled-up state + which checks fail + which tab the deep link targets:

- fully-populated, priced offering → `ready`.
- everything but price → `in progress`, failing check = "plan priced", link → Commerce/Plans.
- no chapters → failing check = "chapters", link → Chapters tab.
- no questions tagged / no test / no free sample → each maps to the right failing check and tab.
- top-line "X of 30 ready" count matches the per-offering states.

**D. Pricing / access resolution** (cheap to test, expensive to get wrong once students pay):

- given a board+class and its plans, the resolver returns the right price per duration and the correct paywall/locked state.
- an offering with no active plan resolves to "locked / not purchasable," never to free-by-accident.

### 3.3 What NOT to test this pass

React component rendering/snapshots, the Excel-import parser internals, auth middleware internals (smoke-test only), and anything student-facing. Keep it to admin routes + the two brains.

### 3.4 Fixtures

Build a tiny seed factory: 1 board (CBSE), 2 classes, 2 subjects, 2 offerings (one complete, one missing price), a handful of questions/options, 1 test, 1 free sample, plans for 3/6/12. Reuse across the readiness and pricing tests so states are explicit.

### 3.5 Build sequence & acceptance

1. Wire Vitest + Prisma mock + one green smoke test.
2. Readiness computation tests (highest value — the home page depends on it).
3. Pricing/access resolution tests.
4. Route CRUD + invariant tests, resource by resource.

*Before writing tests, produce a short plan: the exact functions/routes found in the codebase and their signatures, so the tests match reality rather than this brief's assumptions.* **Acceptance:** `npm run test` runs green; readiness and pricing logic have explicit fixtures for ready / missing-price / missing-content; every invariant in 3.2.B has a passing "rejected" test; no unit test touches the live DB.

---

## 4. The 148 damaged questions (data fix — I run this, needs a small export from you)

**Why not auto-fix:** I tested automatic word re-splitting (dictionary segmentation). It's unsafe — it wrongly breaks real single words ("Phototropism" → "Photo tropism", "Semiautonomous" → "Semi autonomous", "Phytohormones") and mangles the base64 images embedded in some questions. Applying that blind would damage good data. So the clean fix is to **re-read the original text from the old DB**, where the words were still separated, and re-clean it properly (replace each HTML tag with a space, then collapse). That repairs the 148 exactly and touches nothing else.

**What I need from you (tiny, targeted):** export just the 148 affected rows from the OLD database `<db-user>_testquest_db26`. In DBeaver, connected to the old DB, run a `SELECT` of the question id + the raw question/option HTML columns `WHERE id IN (…the 148 ids…)`, and export the result as CSV or JSON, then upload it here. The 148 ids are saved in `damaged_legacy_ids.txt` (they are the old question `id`s / our `legacyId`s). Tell me the old question table's exact name and its text column, and I'll hand you the ready-to-run export query.

**Then I produce** targeted `UPDATE tq_questions … WHERE legacyId = …` (and the matching option updates), single-line and DBeaver-safe, which you run against the new DB. Net effect: 148 questions read cleanly; the tray's "content damaged" drops to ~0.

This does **not** block finalizing the admin structure — it can run in parallel with the unit-test pass.

---

## 5. Sequence to "Admin done"

1. **Claude Code:** unit tests (§3) → green suite.
2. **You:** set prices (bulk once §2 P0 ships; or manually now to see readiness go green) + export the 148 rows (§4).
3. **Me:** source re-clean → UPDATE scripts for the 148.
4. **Claude Code (next pass):** P0/P1 UI fixes (§2).
5. **Then** we start the Student Module.
