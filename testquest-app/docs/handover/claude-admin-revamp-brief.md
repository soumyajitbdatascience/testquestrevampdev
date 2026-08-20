# Claude Code Brief — Admin Revamp to the Decoupled Model (Workspace UX)

**Version 1.1 · For a Claude Code session in `testquest-app`.** *(v1.1 adds the phased build sequence in §10.)* Read first: `docs/handover/testquest-schema-design-decoupled.md` (the model), `docs/handover/migration/README.md` (what's in the new DB), and this brief. Companion DDL: `docs/handover/migration/05-create-app-schema.sql`.

## 0. The situation (why this is a revamp, not a tweak)

The current admin is a **hybrid**: some screens already speak the new model (Boards, Plans & pricing, Subscriptions, and the context-anchored Chapters/Videos/Free-samples), but the **content spine is still the old flat model** and points at the old data:

- "Classes" shows legacy categories (Pre-Foundation, JEE, NEET mixed with Class 8).
- "Subjects" shows the **817 test-sets** ("Class 9 English Set 1") as if they were subjects — the exact confusion the migration removed. Everything downstream inherits it (Free samples shows "0/95").
- Questions render **raw HTML**, attach to Class+Subject only, no board/offering/chapter.
- There is **no Offerings screen** — the keystone of the model is missing.

Goal: rebuild the content spine on the decoupled model, **point the app at the new clean DB**, add the missing Offerings hub, and reorganize the whole admin around a **workspace** interaction so content teams fly through it.

## 1. Point the app at the new database

- Switch `DATABASE_URL` to `u710649289_TquestTestEnv` (env only — do not touch the old DB).
- Run `05-create-app-schema.sql` on the new DB (adds the ~15 app-layer tables: students, plans, orders, class_access, coupons, attempts, videos, events, admins, etc.). Content tables are already loaded.
- **Students start empty** — signups populate `tq_students`. Do not migrate legacy students.

## 2. Rework the Prisma schema to the decoupled model

The current schema ties Subject→single Class and has no Offering. Change to:

- `Board` (master), `Class` (master, no boardId), `BoardClass` (map) → `tq_board_classes`.
- `Subject` (master, **remove `classId`**).
- **`Offering`** (new) → `tq_offerings` (boardId, classId, subjectId, unique triple). This is the anchor.
- `Chapter` → belongs to `offeringId` (not board/class/subject columns).
- `Question` → subjectId (master) + chapterId (nullable); shared bank; `TestQuestion` join.
- `Test` → `offeringId` (not classId+subjectId).
- `FreeTest` → offeringId + testId.
- New models for: `Video`(offering/chapter), `B2cPlan`, `Order`, `ClassAccess`, `Coupon`, `CouponUsage`, `WebhookEvent`, `Attempt`, `AttemptAnswer`, `Event`, `Student`, `StudentContext`, `Admin`, `EmailToken`, `Setting` — all mapping to the `05-` tables.

**Never `prisma db push`.** The tables already exist (from the SQL scripts); use `prisma db pull` / introspect or hand-align the schema to match, then generate the client.

## 3. Navigation — reorganize around three intents

Replace the current flat sidebar with:

```
OVERVIEW
  Launch readiness   ← new HOME (landing page)
  Dashboard

CURRICULUM SETUP   (rarely touched)
  Boards
  Classes            ← clean master (Class 6–12), board mapping inline
  Subjects           ← clean master (8 subjects), no class column

OFFERINGS            ← the hub: list of shelves, click to enter workspace

COMMERCE
  Plans & pricing
  Subscriptions      (class passes)
  Orders
  Coupons

PEOPLE
  Students
```

Retire from the primary nav: the old flat "Questions", "Tests", "Chapters & tagging", "Videos", "Free samples" as *standalone* screens — they move **inside the offering workspace** (§5). Bundles → drop (legacy, not in new model).

## 4. Launch Readiness = the home page

One row per offering with a readiness checklist and progress ring:

- chapters added? · questions tagged (count) · at least one test? · free sample set? · plan priced & active?
- Rolls up to **Ready / In progress / Not started**, and a top-line "X of 30 offerings ready".
- Every unmet item is a **one-click deep link** into that offering's workspace, on the right tab.
- Add a **"Needs attention" tray**: offerings with no free sample, tests with no questions, and the migration's known gaps (the 18 tests with no subject, questions with no chapter). Turn cleanup into a visible to-do list.

## 5. The Offering workspace (the core interaction)

Clicking an offering opens **one page, scoped to that offering**, with a sticky header ("CBSE ▸ Class 10 ▸ Mathematics") and tabs:

- **Chapters** — ordered list; add/rename/reorder/drag; per-chapter test & question counts. (Reuse the good "Chapters & tagging" logic, but pre-scoped — no board/class/subject pickers.)
- **Questions** — the offering's question bank: dense table with **rendered** question preview (HTML/MathML, never raw tags), type, difficulty, chapter, "used in N tests". Excel import + single create. Multi-select → assign chapter. Search + filter by chapter/type/difficulty.
- **Tests** — tests in this offering; create test = name, duration, flags, then pick questions from this offering's bank (with a live "N selected · M marks"). Show attempts count, live/draft.
- **Videos** — paste YouTube unlisted URL → extract id + fetch title; map to a chapter or subject-level; ordered; active/hide. (Keep the current Videos logic; just scope it.)
- **Free sample** — pick the one free test for this offering (from its tests that have questions).

The header carries the offering's readiness ring, so progress is always visible while working. This replaces five separate global screens with one continuous place.

## 6. Keep / fix the commerce screens (mostly data re-point)

- **Plans & pricing** — already the right shape (Board·Class × 3/6/12 grid + paywall preview). Re-point to `tq_b2c_plans` and the new offerings; grey rows with no content; keep the "copy across" affordance and live preview.
- **Subscriptions** — the class-pass list; read `tq_class_access`. Keep stat tiles + expiring-soon.
- **Orders** — read `tq_orders`. Keep search/filter.
- **Coupons** — read `tq_coupons`. Keep as-is.
- **Students** — read `tq_students` (starts at 0). Simple list + counts for now; per-student detail is v2.

## 7. Curriculum setup screens (simplify)

- **Boards** — keep (it's good). Name/code/sortOrder/active + active-passes count.
- **Classes** — clean master list (Class 6–12). Inline "offered by boards" chips (edit the `tq_board_classes` map here). Drop the legacy Subjects/Students/Tests columns.
- **Subjects** — clean master (8 rows). No class column. This screen just names the shared subjects; nothing hangs off it directly.
- Add a small **"New offering"** flow (from the Offerings hub): pick board → class → subject → create the shelf.

## 8. UI/UX principles (make it "hooked")

- **Density for experts**: compact tables, 13px, keyboard nav (`/` focus search, Enter commits, Esc cancels), inline edit.
- **Rendered content everywhere** — never show raw HTML; render questions/options with MathML support (MathJax/KaTeX).
- **Bulk-first** — Excel import prominent; multi-select + one-action tagging; select-all-filtered.
- **Progress & momentum** — readiness rings, "N left" counters ticking down, celebratory 100% state.
- **Save-as-you-go** with undo toasts; destructive = "archive" not "delete"; confirm bulk actions with a count.
- **Guided empty states** ("No chapters yet — add your first").
- Stay inside the existing **purple token system** (`05-ui-theming.md`); light default + dark; WCAG AA; ≥44px targets. Respect the 10-second query ceiling — server-paginate the question bank (5,473 rows).

## 9. Out of scope for this pass

Student-facing app changes (separate phase), the Android app, subscriptions/coupons *checkout* wiring (this pass is admin management + reading; the buy-flow rework comes with the B2C student phase), the 27 empty boards' content (admin just needs to support adding it), per-student profile management (v2).

## 10. Build sequence (phased — do NOT do it all at once)

Follow this order so the app is never left half-broken. **Stop after Phase 1 and show the result before continuing.**

**Phase 1 — Foundation (riskiest; verify before moving on).** The `.env` already points at the new DB (`u710649289_TquestTestEnv`) and all 27 tables exist. Align the Prisma schema to those tables (`prisma db pull` or hand-edit, then `prisma generate` — **never `prisma db push`, never recreate tables**): Subject loses `classId`; add `Offering`, `BoardClass`, `Video`, `B2cPlan`, `Order`, `ClassAccess`, `Coupon`, `CouponUsage`, `WebhookEvent`, `Attempt`, `AttemptAnswer`, `Event`, `Student`, `StudentContext`, `Admin`, `EmailToken`, `Setting`; Chapter/Test/FreeTest point at `offeringId`. Fix the DB client and get the app booting. *Exit check:* Boards/Classes/Subjects read the clean masters (4 / 7 / 8), and `admin@testquest.in` / `admin123` logs in.

**Phase 2 — Offerings hub + workspace.** The Offerings list (30 shelves) and the per-offering workspace with tabs (Chapters · Questions · Tests · Videos · Free sample), all scoped to the selected offering; questions rendered, bulk import, chapter tagging. *Exit check:* opening an offering shows its real chapters/questions/tests scoped correctly; no test-set appears as a subject.

**Phase 3 — Launch Readiness home + Needs-attention tray.** Per-offering readiness rings with deep links; the tray surfaces offerings missing a free sample, tests with no questions, and the 18 subject-less tests / questions with no chapter.

**Phase 4 — Commerce & people re-point.** Plans & pricing, Subscriptions, Orders, Coupons, and Students read the new tables. Students starts at 0.

Before writing code in any phase, produce a short plan (files to change + model diffs) and confirm before proceeding.

## 11. Acceptance criteria

Admin runs on the new DB; Boards/Classes/Subjects show the clean masters (4/7/8), not legacy; the Offerings hub lists 30 shelves; opening one shows its chapters/questions/tests/videos/free-sample scoped correctly with **rendered** questions; Launch Readiness reflects real completion and its links land on the right tab; Plans/Subscriptions/Orders read new-DB data; a fresh signup creates a `tq_students` row. No screen anywhere shows a test-set as a "subject".
