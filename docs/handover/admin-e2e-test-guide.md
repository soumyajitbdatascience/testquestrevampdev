# Admin Module — End-to-End Test Guide (Manual UAT)

**Plain-English walkthrough to test the whole admin by hand.** This is the human counterpart to the automated unit suite: the unit tests prove the logic in isolation; this proves the *journeys* work in a real browser. Work top to bottom. Each step says **do this** → **expect this**. When something doesn't match, note the screen + what you saw (template at the end).

Sign in first: `localhost:3000/admin`, `admin@testquest.in` / `admin123`.

---

## Part 0 — The four things I most suspect (do these first)

These are the specific risks from the screenshots. Confirm them before the long pass.

1. **Does readiness react to pricing?** Open **Plans & pricing** (it says "26 of 30 ready"). Now open **Launch readiness** and the **Dashboard**. *Expect:* both also say **26 of 30** (or 26/30). *If they say 0/30* → readiness isn't recomputing after a price save. This is a bug — report it.
2. **Shared subject pool scope.** Open any offering → **Questions** → click **Shared subject pool**. *Expect:* you understand whether it shows only this subject (all classes) or this subject **for this class**. Note which it is — it decides whether pulling from the pool can mix a Class 7 question into a Class 6 test.
3. **Damaged counter.** On Launch readiness, the "Content carried over damaged" row shows **221**. *Expect:* know that the true count is ~148 (rest are false positives). Don't chase the 221 — the real fix is the source re-clean.
4. **Coupon Create button.** Open **Coupons → New**, fill code + type + value. *Expect:* the **Create** button becomes enabled. If it stays greyed, note what field it's waiting on.

---

## Part 1 — The money path (one full happy journey)

Do this as a single story, start to finish. It mirrors what a real content admin does to launch one shelf.

1. **Launch readiness → pick an In-progress offering** (e.g. CBSE ▸ Class 6 ▸ Mathematics). Click the row / an unmet check. *Expect:* it opens that offering's workspace on the tab for the thing that's missing.
2. **Chapters tab** → type a chapter name → **Add chapter**. *Expect:* it appears in the list with 0 questions/tests. Rename it (pencil). Reorder with the up/down arrows. *Expect:* order persists on refresh.
3. **Questions tab** → search for a word in a question. *Expect:* list filters. Change **All chapters / All types / Any level** filters. *Expect:* list narrows. Tick 2–3 rows → assign them to the chapter you made. *Expect:* their Chapter column updates.
4. **Import** → click **Template**, then **Import** with a small file. *Expect:* new questions land in this offering only. (If you don't have a file, skip — just confirm the Template downloads.)
5. **Tests tab → New test** → name it, 30 min, leave flags off → **Create draft**. *Expect:* a **draft** row with 0 questions. Open it (the list icon) → add several questions → *Expect:* live "N selected · M marks" updates. Save. Set the test **live**. *Expect:* status flips draft → live; the Questions count on the row is no longer "none".
6. **Free sample tab** → set the free sample to that live test. *Expect:* it's accepted (test has questions). Try to set it to a test with **0 questions** (the "Test Math 1" draft). *Expect:* **rejected** with a clear message.
7. **Plans & pricing** → find CBSE · Class 6 → confirm 3/6/12 are priced and **Live**. If not, price them (Part 4).
8. **Back to Launch readiness.** *Expect:* that offering's ring is now **Ready / 100%**, and the top count went up by one. Every check has a tick.

If all 8 hold, the core loop works.

---

## Part 2 — Screen by screen (functional coverage)

### Launch readiness (home)
- Top tiles (All / Ready / In progress / Not started) add up to 30. *Expect:* Ready + In progress + Not started = 30.
- **Needs attention** rows expand. *Expect:* each expands to the actual offerings/tests behind the number.
- Each unmet item is a link. *Expect:* it lands on the **correct tab** (chapters→Chapters, questions→Questions, test→Tests, free sample→Free-sample, plan→Plans).
- After you fix something (add a free sample, price a plan), come back. *Expect:* the count and rings **update without a hard reload** (or after a normal refresh at worst — note which).

### Offerings hub
- **Search** by subject/board. *Expect:* cards filter live.
- **All boards / All classes** dropdowns. *Expect:* grid narrows.
- Card badges: "Free sample set" (green), "No free sample" (amber), "1 empty test" (red). *Expect:* they match what's inside the offering.
- **New offering** → pick board → class → subject → create. *Expect:* a new empty shelf. Now try to create the **same** board+class+subject again. *Expect:* **rejected — already exists** (not a crash, not a duplicate).

### Offering workspace — Chapters
- Add / rename / reorder / delete. *Expect:* each persists.
- Delete a chapter that has questions. *Expect:* a sensible outcome — either blocked, or questions fall back to "General" (note which; it shouldn't silently delete questions).
- Empty state on a chapterless offering. *Expect:* a guided "add your first chapter" prompt, not a blank box.

### Offering workspace — Questions
- **This offering** vs **Shared subject pool** (see Part 0 #2).
- Search + the three filters combine. *Expect:* narrowing stacks.
- Questions render properly (HTML/math), never raw tags. *Expect:* clean text. *Known:* a few show run-together words (locomotaryorgan) — that's the 148 we fix at source; note but don't file as new.
- Multi-select → assign chapter. *Expect:* bulk update works; select-all respects the current filter.
- Scroll/paginate the big banks (Biology 2,465). *Expect:* it stays fast and paginates — it must not try to load thousands at once.

### Offering workspace — Tests
- New draft → add questions → make live → edit → delete.
- A test with 0 questions. *Expect:* it's flagged (the "1 empty test" badge / cannot be a free sample / cannot go live — note the exact rule).
- "Free to all" and "Practice test" flags. *Expect:* they save and show on the row.

### Offering workspace — Videos
- Paste an **unlisted YouTube URL**. *Expect:* the title is fetched automatically; you can map it to a chapter and hide/show it.
- Paste a bad URL. *Expect:* a clear error, no crash.

### Offering workspace — Free sample
- Set / clear. *Expect:* only tests **with questions** and **in this offering** are selectable (try to trick it — see Part 3).

### Boards
- New board (name + code). *Expect:* appears. Try a **duplicate code** (e.g. another "CBSE"). *Expect:* rejected.
- Edit, and deactivate (the crossed-eye). *Expect:* status flips; a deactivated board shouldn't appear in student onboarding (verify later in the student phase).

### Classes
- New class; confirm **no board is "owned"** — the "Offered by" chips are the mapping. *Expect:* you can map/unmap a class to CBSE here.
- **Offerings** count per class matches the hub.

### Subjects
- New subject. *Expect:* **no class column** (it's a pure master).
- Delete a subject **that has offerings** (e.g. Biology). *Expect:* blocked or clearly warned — deleting it must not orphan 2,465 questions.
- Note the **"Science" master with 0 offerings** (see critical read #3) — decide if that's intended.

### Plans & pricing  (the P0 work — test hard, Part 4)

### Subscriptions / Orders / Students
- All three start empty (0 students, 0 passes, 0 orders). *Expect:* clean empty states, working filters/search, Export CSV downloads (even if empty).

### Coupons
- Create a **percentage** coupon (10%, cap ₹200, min order ₹500, dates). *Expect:* saves and lists.
- Create a **flat** coupon. *Expect:* the "max discount cap" field behaves sensibly (a cap on a flat amount is meaningless — note if it's hidden/ignored).
- Bad dates (valid-until before valid-from), value 0, value > 100% for percentage. *Expect:* each rejected.

---

## Part 3 — Negative & edge scenarios (try to break it)

- **Free sample cross-offering:** in offering A's free-sample tab, try to select a test that belongs to offering B (e.g. by fiddling the URL/testId). *Expect:* rejected — "pick a test that belongs to this offering."
- **Duplicate offering** (covered above) — must 409, not 500.
- **Negative / zero / blank price** in Plans. *Expect:* rejected; the row does **not** go Live and the offering does **not** count as ready.
- **Priced but inactive plan.** Price a row but leave it inactive (if the toggle exists). *Expect:* readiness stays **not** ready — a priced-but-inactive plan is the classic "why is it still red" trap.
- **Subject create with a class field** (shouldn't be possible in the UI) — confirm the form has no class picker.
- **Direct URL access while logged out:** sign out, then paste `localhost:3000/admin/plans`. *Expect:* bounced to login, not shown.
- **Delete guards:** deleting a chapter/subject/board that's in use should warn or block, never silently orphan content.
- **Refresh mid-flow:** after each save, refresh the page. *Expect:* the change stuck (it was really saved, not just in the UI).

---

## Part 4 — Plans & pricing deep test (P0 acceptance)

1. Set the top multipliers (6 mo = 2 × 3mo, 12 mo = 3.6 × 3mo). Type a 3-month price on **one** CBSE row → use the per-row **wand** (fill across). *Expect:* 6mo and 12mo auto-fill by the multipliers.
2. **Copy row to all classes** (the copy icon). *Expect:* every CBSE class row gets those prices; a confirm shows the count. Undo if offered.
3. **Fill every row.** *Expect:* all content rows priced at once; rows with **no offerings** (ICSE etc.) stay greyed "nothing to sell yet."
4. **Save all changes.** *Expect:* rows show **Live**; the "X of 30 ready" bar moves.
5. **Student paywall preview** (right panel / eye icon). *Expect:* per-month math is right (₹3600/12 = ₹300/mo, −10% badge) and matches the row.
6. **Readiness reacts** (Part 0 #1) — the single most important check on this screen.
7. Edit one row's price and save just that row (its own **Save**). *Expect:* only that row changes.

---

## How to report what you find

For anything off, jot:

```
Screen:            (e.g. Launch readiness)
What I did:        (e.g. priced all CBSE rows, opened Launch readiness)
What I expected:   (26 of 30 ready)
What happened:     (still shows 0 of 30)
Severity:          blocker / annoying / cosmetic
```

Send me the list and I'll turn the real bugs into a fix brief for Claude Code, and the content decisions (Science-vs-split, shared-pool scope) into calls for you to make. When this pass is clean, the Admin Module is done and we move to the Student Module.
