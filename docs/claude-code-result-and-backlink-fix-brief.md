# Claude Code Brief — Result page crash, submit error, and the "Subject not found" back link

**Version 1.0 · B2C student, post-purchase UAT.** A paid Class 7 student sat the free Biology sample and hit three failures: **Back** from the test page lands on "Subject not found", **View result** throws a runtime `TypeError`, and **Submit test** throws the same thing on landing. Two of the three are one bug. All root causes below are **confirmed by reading this repo** — file and line are given for each. Two further real bugs were found while reading and are included.

**This is a client/API contract fix plus two link/guard fixes. No schema change. Do not touch scoring, the attempt engine, the money math, or `hasClassAccess` / `resolveAccessForTests` gating semantics.** Produce a short plan and **stop before coding**.

Confirmed by reading:
`src/app/(student)/attempts/[id]/result/page.tsx` · `src/app/api/attempts/[id]/result/route.ts` · `src/app/api/attempts/[id]/submit/route.ts` · `src/app/attempts/[id]/page.tsx` · `src/app/tests/[id]/page.tsx` · `src/app/api/tests/[id]/route.ts` · `src/app/(student)/offerings/[id]/page.tsx` · `src/lib/access.ts` · `src/app/api/student/home/route.ts`

---

## Bug 1 (blocker) — Result page crashes: the page and the API disagree on the payload

`Cannot read properties of undefined (reading 'correct')` at `attempts/[id]/result/page.tsx:111`.

**Root cause (confirmed): a silent contract drift.** The page declares an interface the API does not satisfy, and the fetch is untyped (`r.json()` → `any`), so TypeScript never checked it:

```ts
// src/app/(student)/attempts/[id]/result/page.tsx:41-42  — what the page expects
summary: { total: number; correct: number; incorrect: number; skipped: number };
showSolutions: boolean;
```

```ts
// src/app/api/attempts/[id]/result/route.ts:135-159  — what the API actually returns
correctCount, wrongCount, unansweredCount,   // flat, differently named
solutionsLocked,                              // no `showSolutions`
// …no `summary` key at all
```

`result.summary` is therefore `undefined`, and the first read of it throws. **Three separate consequences, not one:**

| Where | Symptom |
|---|---|
| `page.tsx:111` (locked branch) and `:127`, `:135-137`, `:172` | crash — every `result.summary.*` read |
| `page.tsx:146`, `:149` | copy and the "Hide/Show solutions" toggle keyed off `result.showSolutions` → always `undefined` |
| `page.tsx:161` | `result.solutionsLocked ? true : (result.showSolutions && showSolutions)` → for a **pass holder** this is `undefined && …` = falsy, so **solutions would never render** even after the crash is fixed |

**Fix — make the API meet the page's contract (it is the only UI consumer).** Verified: nothing else in `src/app` or `src/components` reads `correctCount` / `wrongCount` / `unansweredCount` from this endpoint (the coaching monitor has its own API), so this is self-contained.

In `src/app/api/attempts/[id]/result/route.ts`, add to the `success({...})` payload:

```ts
summary: {
  total: attempt.answers.length,
  correct: attempt.correctCount,
  incorrect: attempt.wrongCount,
  skipped: attempt.unansweredCount,
},
showSolutions,          // the boolean already computed at line 68
```

Keep `correctCount` / `wrongCount` / `unansweredCount` / `solutionsLocked` as they are — additive change, no removal. Assert `summary.correct + summary.incorrect + summary.skipped === summary.total` in a unit test; if the stored counters ever disagree with `answers.length`, derive `total` from the counters instead and say so in a comment.

**Also harden the page so a payload gap can never white-screen again.** In `attempts/[id]/result/page.tsx`, treat a response missing `summary` as a load failure rather than rendering through it:

- after the fetch, validate the shape (`d.ok && d.data?.summary && Array.isArray(d.data.questions)`); anything else sets `error` and falls into the existing `!result` branch, which already renders a decent card.
- keep the existing `loading` and `!result` branches — they are fine; the bug is that the code path between them assumed a shape.

Do **not** paper over it with `result.summary?.correct ?? 0` everywhere — a zero that should be a number is a lie on a score screen. Fail to the error state instead.

---

## Bug 2 — "Submit test gives an error" is the same bug

**Confirmed.** `POST /api/attempts/[id]/submit` is healthy — it scores, returns `{ submitted, score, correctCount, … }`, and handles the already-submitted case with a 400. The player then does:

```ts
// src/app/attempts/[id]/page.tsx:136
if (data.ok) router.push(`/attempts/${id}/result`);
```

…and the crash the student sees is Bug 1 on the landing page. **Fixing Bug 1 fixes this.** Do not write a separate fix; verify by submitting a fresh attempt after the Bug 1 change.

**One real defect in the same block worth fixing while you are there** — auto-submit ignores its own result:

```ts
// src/app/attempts/[id]/page.tsx:128-129
await fetch(`/api/attempts/${id}/submit`, …);   // no ok check
router.push(`/attempts/${id}/result`);
```

When the timer hits zero and that POST fails (network drop at the worst possible moment), the student is pushed to a result page for an attempt that was never submitted, and the API answers `400 "This attempt hasn't been submitted yet"`. Mirror `manualSubmit`: read the response, and on failure keep the student on the player with a retry rather than navigating away from their answers.

---

## Bug 3 — "Back" from a test lands on "Subject not found"

**Root cause (confirmed) — the same offering-id/subject-id mix-up that hit the video page last round, still live on the test page:**

```ts
// src/app/tests/[id]/page.tsx:165
backHref={test.subject ? `/offerings/${test.subject.id}` : "/dashboard"}
```

`/offerings/[id]` is keyed by **offering id**. `test.subject.id` is a **subject id**. For Class 7 Biology the student came *from* offering 6, and back sends them to `/offerings/<subjectId>`, which the offerings page renders as its not-found state — `src/app/(student)/offerings/[id]/page.tsx:71` is literally the "Subject not found." line in the screenshot.

**Fix — one line. `GET /api/tests/[id]` already returns `offeringId`** (`src/app/api/tests/[id]/route.ts`, in the success payload). Add `offeringId: number` to the page's `TestDetail` interface (line 28) and change the back link to:

```ts
backHref={test.offeringId ? `/offerings/${test.offeringId}` : "/dashboard"}
```

**Sweep result — this was the only remaining offender.** Every other `/offerings/${…}` link in the student app is correct and should be left alone: `dashboard/page.tsx:200,221` and `progress/page.tsx:185` use `s.id` from `GET /api/student/home`, which is documented and confirmed to be the **offering** id (`src/app/api/student/home/route.ts:154-155`); `progress/page.tsx:220` uses an explicit `w.offeringId`; `videos/[id]/page.tsx:64` was fixed last round. Re-confirm with a grep after the change so the sweep is on record.

---

## Bug 4 (found while reading — real, and the student is hitting it now) — a paying student is shown the locked review and an upsell for a class they already bought

`resolveAccessForTests` checks free samples **before** passes (`src/lib/access.ts:118-125`), so a free-sample test always resolves `reason: "FREE_SAMPLE"` — even for a student holding the class pass. The result API then derives:

```ts
// src/app/api/attempts/[id]/result/route.ts:68
const showSolutions = reason === "CLASS_PASS";
```

So our Class 7 pass holder reviewing the Biology sample gets `solutionsLocked: true`, blurred explanations, and a "See where you went wrong — from ₹X" CTA for a pass they already own. (This is also why the crash landed on line 111, the locked branch.)

**Fix — change the derivation, not the gating.** Leave `resolveAccessForTests` exactly as it is; its precedence is correct for *access* (a sample is public), and the last brief's guardrail stands. In the result route, decide solutions from the pass itself — `offering` is already in scope at line 70:

```ts
const showSolutions =
  reason === "CLASS_PASS" ||
  (await hasClassAccess(session.id, offering.boardId, offering.classId));
```

`hasClassAccess(studentId, boardId, classId)` is exported from `src/lib/access.ts:47`. One extra indexed query on a page that already runs several — acceptable; do not push this into the bulk resolver.

**Related, smaller:** in the locked variant the API flattens every option to `isCorrect: false` (line 116), and the page then styles the student's own selection with the destructive/red treatment (`page.tsx:293,304`) — so a free-sample sitter sees **all** their answers rendered as wrong. Render the selection neutrally ("Your answer", primary/muted, no ✗) when `solutionsLocked` is true. Keep the answer key server-side; this is styling only.

---

## Bug 5 — "View result" is offered for an attempt that was never finished

`src/app/tests/[id]/page.tsx:221` renders the "Your last attempt / View result" card whenever `lastAttempt.percentage !== null` — and `percentage` is computed as a number for **every** attempt (`api/tests/[id]/route.ts:70`, `0` when `totalMarks` is 0), including `IN_PROGRESS` and `PAUSED` ones. Clicking through hits `400 "This attempt hasn't been submitted yet"`. This is the "it looks like no test was given" case you flagged.

**Fix, both ends:**

1. **Page** — gate the card on `test.lastAttempt.status === "COMPLETED"`. For an unfinished attempt the sticky **Resume attempt** button (line 262, already guarded by `hasInProgress`) is the correct and only affordance.
2. **Result page** — when the API answers with the "hasn't been submitted yet" 400, don't show a bare error heading. Show an honest state: *"You haven't finished this test yet"* with a **Resume test** primary action to `/attempts/[id]` and a quiet "Back to home". A 404 (`Attempt not found`, or someone else's attempt) keeps the existing "Result not found" card. Route both through the same `!result` branch with a distinguishing `errorKind` rather than adding a second full-page layout.

---

## Sweep — the class of defect, not just the instances

Both crash-class bugs come from the same place: **student pages fetch untyped JSON and re-declare the response shape by hand.** `fetch(...).then(r => r.json())` returns `any`, the local `interface` is decorative, and `npx tsc --noEmit` and `npm run build` both stay green while the page reads a key the route never sends. That is exactly how this reached a paying student.

Do the minimum that makes it structural, not a one-off patch:

1. **Audit each student page against its route** — for every page under `src/app/(student)/` plus `src/app/tests/[id]` and `src/app/attempts/[id]`, list the fields the JSX actually reads and diff them against the keys in that route's `success({...})`. Report the diff **before** changing anything beyond the bugs above; I want to see whether the result page was the only drift. (Spot-checked already and consistent: `dashboard` ↔ `/api/student/home`, `progress` ↔ `/api/student/dashboard`.)
2. **Type the boundary for the result endpoint at least.** Either export the response type from the route and import it in the page, or parse with Zod at the fetch site (Zod is already a dependency and every route validates input with it — this is the same discipline on the way out). Whichever you pick, apply it to `attempts/[id]/result` in this pass and note the pattern for the rest.
3. **Every fetch-and-render student page needs three states** — loading, empty/error, content — and must never render content on a partial payload. Where a page is missing one, add it; report which pages needed it.

---

## Guardrails

- **Do not touch** `resolveAccessForTests` / `hasClassAccess` semantics, `submitAttempt` / scoring (`src/lib/attempts.ts`, `src/lib/scoring.ts`), the paywall/checkout path, or the money math. Bug 4's fix is a derivation change **inside the result route only**.
- The answer key stays server-side. The locked variant must keep flattening `isCorrect` and replacing the explanation — Bug 4's styling note changes CSS, never the payload.
- No schema change, no `prisma db push`, no new dependency.
- Reuse existing primitives: `SecondaryBar`, `Button`, `Paywall`, `friendlyAuthError`. Keep ≥44px targets and the single student shell.
- Keep the diff small and reviewable: five commits, in this order — (1) result API `summary` + `showSolutions`, (2) result page shape-guard + submitted-yet state, (3) test page back link + `offeringId`, (4) `showSolutions` from `hasClassAccess` + locked-answer styling, (5) last-attempt card gate + auto-submit guard.

## Acceptance

- A **pass-holding** Class 7 student opens `/attempts/4/result`: the page renders — score, `X of 40 correct`, the three summary tiles, **and full solutions with the Hide/Show toggle**. No upsell CTA, no blurred explanations.
- An **unsubscribed** student who sat the same free sample sees score + their own answers, explanations blurred, the upsell CTA present, and their selected options styled neutrally — never all-red.
- **Submitting** a test lands on a working result page. Killing the network at auto-submit keeps the student on the player with a retry, never on a result page for an unsubmitted attempt.
- **Back** from `/tests/19` returns to `/offerings/6` (Biology), not "Subject not found". Grep confirms no `/offerings/${…subject.id}` remains.
- A test whose last attempt is **in progress** shows **Resume attempt** and **no** "View result" card; navigating to that attempt's result URL directly shows "You haven't finished this test yet → Resume", not a stack trace. A stranger's attempt id shows "Result not found".
- `npm run build` and `npx tsc --noEmit` green; `npm run test` green.

**Tests to add (this is why it shipped — `e2e/student/` currently holds only `00-shell-and-onboarding.spec.ts`):**
- Unit, `src/lib/__tests__/` (alongside `attempt-scoring.test.ts`): the result payload includes a `summary` whose parts sum to `total`, and `showSolutions` is **true** for a pass holder sitting a free sample (the Bug 4 regression) and **false** for a student with no pass.
- E2E, new `e2e/student/10-attempt-result.spec.ts`: sit the free sample → submit → assert the result page renders a score and question review with no page error; assert Back from the test page reaches the subject page; assert an in-progress attempt offers Resume and not View result.

**Plan first, then stop and show me.**
