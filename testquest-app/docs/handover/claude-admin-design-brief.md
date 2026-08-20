# Claude Design Brief — Testquest Admin (Web) for the B2C Subscription Model

**Version 1.0** · Companion to [claude-design-brief.md](./claude-design-brief.md) (student surfaces). The requirement is [b2c-enhancement-plan.md](./b2c-enhancement-plan.md) §4 (admin) and §5 (content-ops); engineering constraints are in [claude-code-implementation-brief.md](./claude-code-implementation-brief.md) (WS-2). The existing admin panel is documented in [04-features/06-admin-panel.md](./04-features/06-admin-panel.md).

## 1. Who this is for and what it must achieve

The admin is the platform owner and a small team. With the subscription model, admin stops being just a content CRUD tool and becomes the **content-ops cockpit**: for every board+class that launches, someone must define chapters per subject, tag hundreds of tests into them, attach videos, pick free samples, and set 3/6/12-month prices. **The design goal is throughput** — the faster one person can fully populate a board+class, the sooner the product launches. Optimize for an expert user doing repetitive work: density, bulk actions, keyboard flow, and visible progress. This is the opposite optimization from the student app (which optimizes for first-time clarity).

**Existing panel to build on:** `/admin` with a left sidebar (`admin-sidebar.tsx`) + mobile nav, shadcn/ui + Tailwind, same token system as the student app, screens for Dashboard, Classes, Subjects, Questions, Tests, Bundles, Coupons, Orders, Students, Organizations. Desktop-first (admin work happens on laptops); must remain usable, not perfect, at mobile widths. Existing CRUD screens are **not redesigned** — they get nav regrouping and token alignment only.

## 2. Information architecture — revised sidebar

Group the growing sidebar into four sections (design the grouped pattern; final labels flexible):

| Section | Items |
|---|---|
| **Overview** | Dashboard (gains B2C tiles) · **Launch readiness** (new, §3.7) |
| **Content** | Classes · Subjects · Questions · Tests *(existing, unchanged)* |
| **Curriculum** *(new)* | Boards · Chapters & tagging · Videos · Free samples |
| **Commerce** | **Plans & pricing** (new) · **Subscriptions** (new) · Orders · Bundles ⌞legacy badge⌟ · Coupons ⌞legacy badge⌟ |
| **People** | Students · Organizations |

"Legacy" badge = a quiet tag marking screens kept for history/grandfathered data, removed from the new-user storefront.

## 3. New screens

Every screen needs default, loading, empty, error, and dark states. The **context selector** (§3.2) is a shared component — design it once, reuse everywhere.

**3.1 Board manager.** Simple CRUD table: name, code, sort order (drag), active toggle, and a coverage summary per board (classes with content). Guard state: deactivating a board that has active student passes → warning dialog explaining consequences (existing passes keep working; board disappears from onboarding).

**3.2 Curriculum context selector.** A persistent bar: **Board → Class → Subject**, sticky across the Curriculum screens, remembered per admin session. Every curriculum action happens inside this context — make the current context impossible to miss (this prevents the classic "tagged 50 tests into the wrong board" disaster). Include a compact coverage readout for the selected context ("14 chapters · 312/412 tests tagged · 18 videos · sample set ✓").

**3.3 Chapters & tagging — the workhorse screen; spend disproportionate care here.** Two-pane layout within the context: left pane = chapter list (add inline, rename inline, drag to reorder, per-chapter test/video counts, archive); right pane = tests. The right pane has two tabs: **In chapter** (the selected chapter's tests, drag to reorder) and **Untagged** (everything in this board+class+subject not yet in a chapter — the work queue, with count badge). Untagged tab: dense table (name, question count, duration, free/paid, other-board tags as small chips), search + filters, checkbox multi-select, and one primary action — "Move to chapter →" with a chapter picker. Must support select-all-filtered. Per-row quick-assign for singles. Progress persists visibly ("100 left" ticking down is the motivation loop). Cross-board reuse: a test already tagged in another board shows that board's chip — tagging here is additive, never a move.

**3.4 Video manager.** Within the same context, per chapter (or subject-level for unattached videos): "Add video" = paste YouTube URL → live validation states: extracting id → fetched (title + thumbnail preview shown to admin — admin may see thumbnails; students must not, per the student brief) → error variants (invalid URL / video private / embedding disabled — each with a one-line fix instruction). Then: editable title, duration, chapter assignment, sort order (drag), active toggle. List view mirrors the chapter test list so the mental model transfers.

**3.5 Free-sample picker.** One slot per board+class+subject, shown as a card: current sample (name, question count) + "Change" → searchable picker limited to that context's active tagged tests. Empty state = prominent, because a subject without a sample can't sell itself ("No free sample set — students see no try-free test for this subject"). Guard: picking an archived/empty test is impossible.

**3.6 Plans & pricing.** A grid: rows = board+class (only combos with content, others greyed with "no content yet" hint); columns = 3 / 6 / 12 months; cells = price input + active toggle. Bulk affordance: "copy this row's pricing to…" (other classes/boards). Validation inline (empty/zero price can't be activated). A right-side preview panel renders the student paywall sheet for the selected row — the admin sees exactly what students will see before activating. Layout must not preclude the planned future row-expansion to per-subject plans (design the row as expandable).

**3.7 Launch readiness (new, recommended).** The content-ops dashboard: one row per board+class with checklist meters — chapters defined (per subject), % tests tagged, videos added, samples set (n of subjects), plans priced & active — rolling up to a Ready / In progress / Not started status. This is the owner's daily screen during the build and the honest answer to "can we launch CBSE Class 10 yet?". Clicking any deficit deep-links into the exact curriculum context to fix it.

**3.8 Subscriptions (B2C revenue).** Top: stat tiles (active passes, revenue this month, expiring in next 7 days, renewal rate). Below: passes table (student, board+class, duration, purchase date, expiry, amount, status active/expired) with filters (board, class, duration, status, expiring-soon preset) and CSV export. A secondary "Upcoming expiries" view supports proactive outreach. Charts, if any, follow the same token rules as the student brief (single-hue purple for magnitude; no dual axes; labels in ink, never series color).

**3.9 Dashboard additions.** Four B2C tiles on the existing admin dashboard (active passes, revenue this month, tagging progress overall, expiring soon) linking into §3.7 and §3.8. No other dashboard changes.

## 4. Admin-specific design principles

Density over whitespace: tables, 13px body, compact rows — but same tokens, same type scale logic. Every bulk action shows a preview count before commit ("Move 37 tests to 'Trigonometry'?") and confirms with an undo toast after. Destructive language is always "archive", never "delete" (soft-delete platform rule). Long operations (bulk tagging) show determinate progress. Keyboard: full tab order, Enter commits inline edits, Esc cancels, `/` focuses search on list screens. All mutations show who-and-when where the data model provides it. Error states name the fix, not just the failure. Light + dark both required; AA contrast per the shared token table (see student brief §2 — identical tokens apply).

## 5. Deliverables expected

(1) Revised IA/navigation spec (grouped sidebar, legacy badges, mobile nav behaviour). (2) Screen designs for §3.1–3.9, desktop-first (1280px reference) with a workable ≤768px behaviour note per screen, light + dark. (3) States matrix per screen. (4) Interaction specs for the two complex flows — bulk tagging (§3.3) and URL-paste validation (§3.4) — detailed enough for Claude Code to implement without judgment calls: selection model, drag behaviour, optimistic updates, failure recovery. (5) The shared context-selector component spec. (6) Handoff format per the student brief §6 conventions.

## 6. Constraints & cautions

shadcn/ui + Tailwind only; extend `admin-sidebar.tsx` patterns rather than replacing the shell. Existing CRUD screens (Classes, Subjects, Questions, Tests, Bundles, Coupons, Orders, Students, Organizations) are out of scope beyond nav regrouping and token alignment — flag improvement ideas, don't design them. Respect the engineering realities from the code brief: the 10-second query ceiling shapes list screens (design for server pagination, not infinite client lists — the tests pool is ~28k questions / hundreds of tests per context); tagging is additive `tq_*` data only; video thumbnails are admin-only. The admin panel has no dark-mode-critical audience but dark must still pass AA (the owner works at night).
