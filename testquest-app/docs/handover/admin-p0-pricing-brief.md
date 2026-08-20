# Claude Code Brief — Admin P0: Bulk Pricing + Readiness Deep Links

**Version 1.0 · Queue AFTER the unit-test suite is green.** This is the P0 pass from `admin-finalize-plan.md` §2 — the two fixes that flip Launch Readiness off 0/30. Small, surgical, no schema changes. Read `admin-finalize-plan.md` first for context.

## 0. Why this pass

Launch Readiness shows "0 of 30 offerings ready" because **no plan is priced** — every offering fails the last check. The data isn't wrong; entering it is just too slow (a Board·Class × 3/6/12 grid is up to 30+ cells by hand). Make pricing a one-minute job and make sure readiness reacts the moment a plan is priced and active.

## 1. Bulk pricing on the Plans & pricing grid

Keep the existing grid (Board·Class rows × 3/6/12 columns + paywall preview). Add three affordances:

1. **Fill across durations** — on a row, an action "set 3-month price, auto-fill 6 & 12" using a simple multiplier (default ×2 and ×3.6, both editable) OR let the user type one value and click "apply to 6 & 12". The point: type once per row, not three times.
2. **Copy row to all classes** — a per-row "apply this row's prices to every class in this board" action, with a confirm showing how many rows will change.
3. **Copy board to all boards** (optional, lower value now with only CBSE populated) — same idea one level up.

Rules:

- Setting a price also sets the plan **active** (or expose the active toggle inline so a priced-but-inactive plan can't silently block readiness). A price with no active flag is the most likely "why is it still red" trap — surface it.
- Prices are integers ≥ 0 (paise or rupees — match whatever `tq_b2c_plans` already stores; do not change the unit). Reject negatives and non-numbers inline.
- **Undo toast** after any bulk action ("Priced 7 rows · Undo"), and confirm bulk actions with a count. No destructive overwrite without the toast.
- Grey/disable rows for board+class combos that have **no content offerings** yet (nothing to sell), so pricing effort goes where it matters.

## 2. Readiness reacts immediately

- After a save/bulk action, the **Launch Readiness** count and the affected offerings' rings must recompute (revalidate the readiness query / refetch — do not require a manual reload).
- Confirm the readiness "plan priced & active" check reads the same source the grid writes (`tq_b2c_plans` for that board+class), so a freshly priced row turns its offerings green.

## 3. Deep links land on the exact tab

Every unmet check on Launch Readiness is a one-click link into the offering workspace. Verify (and fix if needed) that each lands on the **right tab with the item in focus**:

- "chapters" → Chapters tab · "questions" → Questions tab · "test" → Tests tab · "free sample" → Free-sample tab · "plan priced" → Commerce ▸ Plans & pricing, scrolled/focused to that board+class row.

If any currently open only the offering home (not the specific tab), fix the link target. This is what makes the home page actually drive the work.

## 4. Out of scope

Checkout/payment wiring, coupon logic, new plan durations, any schema change, and the P1/P2 UI polish (review-queue filter, empty states, keyboard nav) — those are the next pass. This brief is only: bulk-price fast, readiness reacts, links land right.

## 5. Acceptance

Pricing all of CBSE's board+class rows takes a handful of clicks, not 30 edits; a priced+active row immediately turns its offerings' readiness green and moves the "X of 30 ready" count; every Launch Readiness link opens the correct tab (or the Plans row) with the thing-to-fix in view; bulk actions show a count + undo. No schema change; unit tests still green (add a test for the "priced+active → ready" transition in the readiness fixtures).
