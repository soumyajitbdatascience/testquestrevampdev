# Testquest — Coaching Centre Implementation Plan

> **Purpose:** ticket-by-ticket plan for a solo engineer building the Coaching Centre B2B layer on top of the existing Testquest web app, using Claude Code. Companion to `USER_JOURNEY.md`.

Last updated: 2026-05-26

---

## 0. How to use this doc with Claude Code

This plan is designed to be consumed one **task** at a time, not read end-to-end before starting. Each task is sized at 1–4 hours of work with Claude Code's assistance and is self-contained: paste the task block into a Claude Code session, let it execute, review the diff, commit, move on.

### Setup before you start

1. Add a pointer to this file in your existing `CLAUDE.md` so every Claude Code session loads it as context:
   ```
   ## Active work
   Following IMPLEMENTATION_PLAN.md. Current phase: Phase 0.
   USER_JOURNEY.md is the product reference; IMPLEMENTATION_PLAN.md is the build plan.
   ```
2. Keep both `USER_JOURNEY.md` and `IMPLEMENTATION_PLAN.md` in repo root, committed.
3. After each phase, update `CLAUDE.md` with which phase is active and what's now built.

### Working pattern per task

1. Read the task block in this doc.
2. Open a Claude Code session in your repo.
3. Paste the task block. Optionally prefix with `Use plan mode first` if the task is non-trivial.
4. Review Claude Code's plan, push back where wrong, approve.
5. Let it execute. Review every file diff before accepting.
6. Run the task's verification steps yourself (don't trust Claude Code's "done").
7. Commit with the task ID in the message: `feat(coaching): 1.3 self-serve signup form`.
8. Cross off the task in this doc (or in your tracker).

### Anti-patterns to avoid

- **Don't paste multiple tasks at once.** Claude Code works best when scope is bounded. A 4-task batch will produce mediocre output across all four.
- **Don't skip the verification step.** Especially the "mobile app still works" checks — that's the highest-risk regression and Claude Code can't test it for you.
- **Don't let it touch legacy tables structurally.** Schema changes to `student`, `main_exam_*`, `question` and their siblings break the mobile app. Additive `tq_*` tables and new mapping tables only.
- **Don't accept Prisma migrations on legacy tables.** Use raw SQL migrations for any legacy interaction. Prisma owns `tq_*` only.

---

## 1. Approach and timeline

Six phases, each shippable. Solo + Claude Code timeline: **~14 weeks** end-to-end. Phases cannot overlap (solo) but Claude Code compresses the build time per phase considerably.

| Phase | Scope | Weeks | What ships at end |
|---|---|---|---|
| 0 | Foundation: schema, auth refactor, seed data | 1 | Nothing user-facing; infra ready |
| 1 | Self-serve MVP for solo-owner centres | 3 | 2 friends-and-family centres live |
| 2 | Co-teachers, custom tests, sales-led admin | 3 | 3–5 paying centres on Growth/Pro |
| 3 | Parent reports + white-label | 2 | 10–20 centres, soft launch |
| 4 | Subscriptions, multi-branch, lifecycle | 3 | Recurring billing, chain customers possible |
| 5 | Hardening + public launch | 2 | Self-serve open, marketing site live |

Total: 14 weeks. Add 25% buffer for unknowns = **~18 calendar weeks**.

---

## 2. External setup to start Week 1 (non-code)

These have multi-week external lead times. Start in parallel with Phase 0 code work so they don't block later phases.

| Item | Lead time | Blocks |
|---|---|---|
| Razorpay live keys (Standard Checkout) | 2–3 weeks | Phase 1 trial-to-paid conversion |
| Razorpay Subscriptions product activation (separate KYC) | 2–3 weeks | Phase 4 recurring billing |
| WhatsApp Business API provider selection + Meta verification (Gupshup / MSG91 / Karix / Twilio) | 2–4 weeks | Phase 2 WhatsApp delivery |
| Question bank quality audit (sample 200 questions across Class 9–10 CBSE) | 1 week | Phase 1 friends-and-family launch |
| Identify 2 friendly coaching centres for Phase 1 beta | ongoing | Phase 1 end-of-phase validation |
| Identify 3–5 centres willing to pay for Phase 2 closed beta | ongoing | Phase 2 end-of-phase validation |

---

## 3. Cross-cutting conventions

Read this before starting any task. These rules govern every phase.

### Code organisation

| Concern | Pattern |
|---|---|
| New pages | `app/coaching/*` for centre-facing, `app/admin/organizations/*` for Testquest admin |
| API routes | `app/api/coaching/*` and `app/api/admin/organizations/*` |
| Services / business logic | `lib/services/*.service.ts` (create as needed, follow existing service style if present) |
| Prisma schema | `prisma/schema.prisma` — only for `tq_*` tables |
| Raw SQL migrations | `prisma/migrations/*/migration.sql` for legacy interactions |
| Shared types | `lib/types/*.ts` |
| UI primitives | Reuse existing `components/ui/*` (shadcn). Never reinvent. |
| Auth helpers | Extend existing JWT helpers, do not write new auth from scratch |

### Schema rules (non-negotiable)

1. **Never alter legacy tables structurally.** This includes adding columns to `student`, `question`, `main_exam`, `practice_exam`, or their description/audio/video siblings. Mobile app reads these directly.
2. **All new state goes in `tq_*` tables.** Mapping tables are fine (e.g. `tq_org_questions` maps an org to a legacy `question.question_id`).
3. **Prisma owns `tq_*` only.** Legacy reads continue via the MySQL VIEWs in `vw_*`.
4. **Writes to legacy tables (e.g. attempts to `main_exam_result`) follow existing service patterns.** Don't re-architect; the journey doc covers what's already working.
5. **Soft-delete via `status = 0`** continues to be the convention.

### Auth conventions

- JWT remains `httpOnly` cookie. Existing student auth path stays intact.
- JWT payload gets two new optional fields: `orgId` and `orgRole`. Existing tokens without these fields keep working for B2C students.
- On every login (any URL), the backend now resolves: (1) is this user an org member? (2) is this user a legacy student? (3) is this user a tq_admin? In that order. Route accordingly.
- Mobile OTP login is a new path needed for student invite flow. SMS-only in Phase 1; WhatsApp added in Phase 2.

### Testing approach

For each task:
- **Manual verification**: explicit steps listed in each task's "Verify" section.
- **Mobile DB regression**: at end of every phase, run a 10-minute smoke test on the mobile app pointing at the same DB. Login, browse, take a test, view result. If any of these break, the phase is not done.
- **Don't write unit tests for everything.** Solo + Claude Code reality: integration tests for critical flows (signup, test assignment, payment) and manual verification for the rest. Don't let test-writing slow you down to under-15-LOC component tests.

### Claude Code prompting patterns specific to this codebase

When a task involves matching an existing pattern, always prompt with the reference. Example:

> ✅ Good: "Build the coaching signup page at `app/coaching/signup/page.tsx`. Match the structure, styling, and form-state pattern from `app/signup/page.tsx`. Use the same shadcn components (Card, Input, Button, Label). Form fields: ..."
>
> ❌ Bad: "Build a coaching signup page."

When introducing a new pattern (no existing reference), explicitly tell Claude Code it's a new pattern and to keep it minimal:

> "This is a new pattern — there's no existing org-aware page yet. Keep the implementation small and idiomatic; we'll refine the pattern after seeing it in this first instance."

---

## 4. Phase 0 — Foundation (Week 1)

Goal: schema and auth groundwork. Nothing user-facing ships. End of phase: a seeded fake centre exists in dev DB; you can log in as its owner; an empty `/coaching/dashboard` route loads with the org context.

### Task 0.1 — Add `tq_organizations` and related schema

**Why:** Foundation for all coaching centre work. Org is the parent entity; everything hangs off it.

**Files to modify:**
- `prisma/schema.prisma` — add models
- `prisma/migrations/[timestamp]_add_organizations/migration.sql` — generated

**Models to add (Prisma):**
- `Organization` → table `tq_organizations`: `id`, `type` (enum: COACHING_CENTRE, SCHOOL, B2C_FAMILY), `name`, `logoUrl`, `city`, `brandingJson`, `parentOrgId` (self-ref nullable), `ownerUserId`, `status` (1/0), `createdAt`, `updatedAt`
- `OrgMembership` → `tq_org_memberships`: `id`, `orgId`, `userId` (refers to legacy `student.student_id` — store as Int, no Prisma FK), `role` (enum: OWNER, ADMIN, TEACHER, STUDENT, PARENT), `status`, `joinedAt`, unique on (`orgId`, `userId`, `role`)
- `Batch` → `tq_batches`: `id`, `orgId`, `name`, `classId` (Int, refs legacy), `board`, `subjectsCsv`, `status`, `createdAt`
- `BatchEnrollment` → `tq_batch_enrollments`: `id`, `batchId`, `studentId` (Int, refs legacy), `enrolledAt`, `status`, unique on (`batchId`, `studentId`)

**Acceptance criteria:**
- `npx prisma migrate dev` succeeds; new tables exist in MySQL.
- Indices on: `tq_org_memberships.userId`, `tq_batches.orgId`, `tq_batch_enrollments.studentId`.
- No alterations to any legacy table.

**Verify:**
1. Run `SHOW CREATE TABLE tq_organizations;` in MySQL — confirm structure.
2. Run `SHOW CREATE TABLE student;` — confirm unchanged from before.
3. Mobile app smoke test: log in, browse tests. Should work identically.

**Complexity:** S (2–3h)

---

### Task 0.2 — Add `tq_subscriptions`, `tq_subscription_plans`, `tq_org_questions`

**Why:** Billing data model and the org-scoped question mapping table. Doing this in Phase 0 so they exist when Phase 1 needs them.

**Files to modify:** same as 0.1.

**Models:**
- `SubscriptionPlan` → `tq_subscription_plans`: `id`, `name`, `targetAudience` (enum), `pricingModel` (enum: PER_SEAT, FLAT, TIERED), `featuresJson`, `durationDays`, `basePrice`, `status`
- `Subscription` → `tq_subscriptions`: `id`, `orgId` (nullable for B2C), `studentId` (nullable for B2B), `planId`, `seatsPurchased`, `seatsUsed`, `startsAt`, `expiresAt`, `billingCycle`, `autoRenew`, `status` (enum: TRIAL, ACTIVE, GRACE, EXPIRED, CANCELLED), check that exactly one of `orgId` / `studentId` is set
- `OrgQuestion` → `tq_org_questions`: `id`, `orgId`, `legacyQuestionId` (Int, refers to `question.question_id`), `createdBy` (user id), `createdAt`, `status`, unique on (`orgId`, `legacyQuestionId`)

**Acceptance criteria:**
- Migration runs clean.
- Seed three SubscriptionPlan rows: Starter / Growth / Pro for Coaching Centre. Use placeholder pricing from §3 of USER_JOURNEY.md.

**Verify:**
1. SELECT count from `tq_subscription_plans` returns 3.
2. Mobile smoke test still passes.

**Complexity:** S (2h)

---

### Task 0.3 — Extend JWT and auth backend for org context

**Why:** Single sign-in endpoint that resolves any user (student / org member / admin) and returns the right redirect.

**Files to modify:**
- `lib/auth/jwt.ts` (or equivalent — find via Claude Code) — extend payload type
- `lib/auth/login.ts` or wherever the login resolver lives
- `middleware.ts` — add route guards for `/coaching/*`

**Acceptance criteria:**
- JWT payload now includes optional `orgId: number | null` and `orgRole: 'OWNER' | 'ADMIN' | 'TEACHER' | 'STUDENT' | null`.
- Existing tokens (without these fields) continue to work — `orgId` defaults to `null`.
- Login flow: given email+password, look up in `tq_org_memberships` first (joined with legacy student via `userId`), then `student`, then `tq_admins`.
- New helper `requireOrgRole(roles: OrgRole[])` for route guards.
- `/coaching/*` routes require org membership; missing → redirect to `/coaching/login`.

**Verify:**
1. Existing student login still works, lands on `/tests`.
2. Existing admin login still works, lands on `/admin`.
3. New `/coaching/dashboard` page (placeholder empty) returns 401/redirect for unauthenticated.

**Complexity:** M (4–6h)

---

### Task 0.4 — Seed dev data + placeholder `/coaching/dashboard`

**Why:** End of Phase 0 you should be able to log in as a fake centre owner and see an empty dashboard. Proves the plumbing.

**Files:**
- `prisma/seed.ts` (extend) or new `scripts/seed-coaching.ts`
- `app/coaching/dashboard/page.tsx` (placeholder)
- `app/coaching/login/page.tsx` (basic form, posts to existing login endpoint)

**Seed content:**
- 1 `tq_organizations` row: "Sunrise Coaching Centre", Pune, type=COACHING_CENTRE
- 1 legacy `student` row: "Demo Owner", `demo-owner@testquest.local`, bcrypt password `demo1234`
- 1 `tq_org_memberships` row linking them as OWNER
- 1 `tq_subscriptions` row: TRIAL, 14 days, plan=Starter, seats=50
- 1 `tq_batches` row: "Class 10 CBSE Morning 2026"
- 5 student rows + their batch enrollments

**Acceptance criteria:**
- `npm run seed` creates everything idempotently (safe to re-run).
- Visit `/coaching/login` → log in as `demo-owner@testquest.local` / `demo1234` → land on `/coaching/dashboard` showing org name + role.

**Verify:**
1. Seed runs twice without errors.
2. Login flow lands on dashboard with correct org name visible.
3. Mobile smoke: still works against same DB.

**Complexity:** M (3–4h)

**End of Phase 0 milestone:** push everything to a branch, deploy to staging, run mobile smoke. Foundation ready.

---

## 5. Phase 1 — Self-serve MVP (Weeks 2–4)

Goal: a friends-and-family centre can sign up, configure, invite students, assign a Testquest-bank test, see results, and convert from trial to paid. Solo owner only (no co-teachers yet). No WhatsApp (SMS + email). No parent reports yet. No white-label.

### Task 1.1 — Build `/for-coaching-centres` landing page

**Why:** Entry point for self-serve. SEO surface for B2B keywords.

**Files:**
- `app/for-coaching-centres/page.tsx`
- Reuse design tokens from existing landing (saffron + indigo). Match typography (DM Sans + DM Serif).

**Sections:**
1. Hero: headline + subhead + dual CTAs ("Start 14-day free trial" → `/coaching/signup`, "Book a demo" → `/coaching/demo` for now just a contact form)
2. Three-column value props: (Question bank, Branded parent reports, Mobile-friendly)
3. Pricing tiers card row (Starter / Growth / Pro / Enterprise) with feature comparison
4. Two testimonial placeholders (real quotes come later)
5. FAQ accordion: data security, branding, contracts, support
6. Footer CTA

**Acceptance criteria:**
- Lighthouse mobile score > 85.
- All CTAs route correctly.
- Renders on a budget Android viewport (360x800) without horizontal scroll.

**Verify:**
1. Visit on a real phone (or DevTools mobile sim).
2. Click each CTA → lands on intended page.

**Complexity:** M (4–6h)

---

### Task 1.2 — Add "For Coaching Centres" to main site nav

**Why:** Visibility for B2B path from the main site.

**Files:**
- Main header component (find via Claude Code; likely `components/site-header.tsx` or similar)

**Change:** add nav link between existing items. On mobile menu, include in the hamburger drawer.

**Verify:** link present on `/`, `/tests`, all public pages.

**Complexity:** S (1h)

---

### Task 1.3 — Build `/coaching/signup` self-serve form

**Why:** Owner creates a new coaching centre + trial subscription.

**Files:**
- `app/coaching/signup/page.tsx`
- `app/api/coaching/signup/route.ts`
- `lib/services/organization.service.ts` — new service file

**Form fields:** centre name, owner full name, mobile (E.164), email, password (≥8), city, expected student count (select: 0–25, 26–50, 51–100, 101–250, 250+). No OTP in Phase 1; we trust mobile for now and verify in Phase 2 when WhatsApp lands.

**On submit (`POST /api/coaching/signup`):**
1. Validate uniqueness: email not in `student`, `tq_admins`, or as an org owner.
2. Create `tq_organizations` row (type=COACHING_CENTRE, status=1).
3. Create legacy `student` row for the owner (so they have an identity; treat owners as enhanced students in DB).
4. Create `tq_org_memberships` row (role=OWNER).
5. Create `tq_subscriptions` row (status=TRIAL, plan=Starter, 14 days, seats=expected student count rounded up to nearest tier).
6. Issue JWT with `orgId` + `orgRole=OWNER`.
7. Redirect to `/coaching/setup`.

**Acceptance criteria:**
- All 5 rows created atomically (use Prisma transaction).
- Failure cases: duplicate email returns 409 with clear message.
- JWT cookie set with `httpOnly`, `secure`, `sameSite=lax`.

**Verify:**
1. Sign up new centre → check 5 rows in DB.
2. JWT decodes with correct `orgId`.
3. Existing student with same email → blocked with clean error.
4. Sign up → land on `/coaching/setup`.

**Complexity:** M (5–6h)

---

### Task 1.4 — Build setup wizard `/coaching/setup` (5 steps)

**Why:** First-time owner needs to be guided from empty state to first batch with students.

**Files:**
- `app/coaching/setup/page.tsx` (multi-step state machine)
- `app/coaching/setup/steps/` directory with 5 step components
- `app/api/coaching/setup/[step]/route.ts` — POST endpoint per step
- `lib/services/batch.service.ts` — new

**Steps:**
1. Branding: logo upload (skip OK), display name (defaults to centre name), city confirmation, primary color picker (default to saffron)
2. Boards + classes taught (multi-select; populate from `vw_classes`)
3. Create first batch: name, class (from selections in step 2), board, subjects (multi-select from `vw_subjects` filtered by class)
4. Invite students: three options shown
   - (a) Generate invite link (returns shareable URL)
   - (b) Paste names + mobiles (textarea, comma or newline separated; preview parsed rows before submit)
   - (c) Skip for now
5. Done: brief summary + "Go to your dashboard" CTA

**Persist:** each step is a separate API call so refreshing doesn't lose state. Store wizard progress in `tq_organizations.brandingJson` temporarily under a `setupProgress` key.

**Acceptance criteria:**
- Owner can finish all 5 steps and land on dashboard.
- Skipping step 4 is allowed; the wizard ends regardless.
- Branding step uploads logo to existing file storage (find pattern; if none, use a simple local /uploads folder for now and flag for v2).

**Verify:**
1. Complete the wizard happy path end-to-end.
2. Refresh mid-wizard → resume at last completed step.
3. Skip step 4 → end up on dashboard with empty batch.

**Complexity:** L (10–12h)

---

### Task 1.5 — Student invite link join flow

**Why:** Students of a coaching centre must come in via owner's invite, not via `/signup`.

**Files:**
- `app/coaching/join/[token]/page.tsx`
- `app/api/coaching/join/[token]/route.ts`
- `lib/services/invite.service.ts`
- `lib/sms.ts` — extend or create for SMS OTP (use existing SMS provider; if none configured, use console-log stub for dev)

**Flow:**
1. Owner generates invite link in setup step 4 or from batch settings — token encodes `batchId` + `orgId` + 30-day expiry.
2. Student visits `/coaching/join/[token]` → sees "Join [Centre Name] — [Batch Name]" + form: full name, mobile, OTP.
3. Submit mobile → SMS OTP sent.
4. Submit OTP → backend creates legacy `student` row (or matches existing by mobile), creates `tq_batch_enrollments` row, creates `tq_org_memberships` row (role=STUDENT).
5. JWT issued, student redirected to `/tests` with org context banner shown.

**Acceptance criteria:**
- Token validation: expired or unknown token → friendly error page.
- Mobile collision: if a `student` row with that mobile exists, link to that student rather than create duplicate.
- Seat enforcement: if `seatsUsed >= seatsPurchased`, block enrollment with clear message ("This centre is at capacity. Contact the centre owner.").

**Verify:**
1. Owner generates link → opens incognito → submits flow → student row + enrollment + membership created.
2. Try same mobile twice → second time joins same student to additional batch, doesn't duplicate.
3. Try expired token → friendly error.

**Complexity:** L (8–10h)

---

### Task 1.6 — `/coaching/dashboard` with real data

**Why:** Owner's home page once setup is done.

**Files:**
- `app/coaching/dashboard/page.tsx`

**Sections:**
- Header: centre name, days left in trial (if applicable), upgrade CTA
- Stat tiles: total students, active batches, assignments this week, average score
- Recent activity feed (last 10 assignment completions)
- Batch list with quick "Assign test" action per batch

**Data sources:**
- Counts from `tq_org_memberships` + `tq_batches` + `tq_assignments`
- Recent activity from legacy `main_exam_status` joined to `tq_batch_enrollments` to scope to this org's students
- Average score: SUM(score) / SUM(total_marks) across all this org's attempts

**Acceptance criteria:**
- Loads in < 800ms on a seeded dev DB (test with 5 batches, 50 students, 100 attempts).
- Empty states: if no batches, show "Create your first batch" CTA.

**Verify:**
1. Seed data shows correct counts.
2. Take a test as a seeded student → activity appears within 5s on dashboard refresh.

**Complexity:** M (5–6h)

---

### Task 1.7 — Batch detail page `/coaching/batches/[id]`

**Why:** Day-to-day operational screen — owner spends most of their time here.

**Files:**
- `app/coaching/batches/[id]/page.tsx`
- `app/api/coaching/batches/[id]/route.ts` (GET)

**Sections:**
- Header: batch name, class/board/subjects, student count, "Assign test" CTA, settings dropdown
- Tabs: Students | Assignments | Reports (Reports tab is placeholder until Phase 3)
- Students tab: list of enrolled students, score average per student, last activity, remove button
- Assignments tab: list of all assignments to this batch (status: active / past), with completion %

**Authorization:** must be OWNER or TEACHER of the parent org.

**Acceptance criteria:**
- Page is responsive; works on phone.
- Empty state on Assignments tab: "Assign your first test" CTA.
- Removing a student: soft-delete `tq_batch_enrollments.status = 0`.

**Verify:**
1. Seed batch with 5 students renders all of them.
2. Remove a student → disappears from list; seat freed up.
3. Try accessing as a non-owner-non-teacher → 403.

**Complexity:** M (5–7h)

---

### Task 1.8 — Assign test to batch flow

**Why:** Core action — connects existing test bank to a batch.

**Files:**
- `app/coaching/batches/[id]/assign/page.tsx`
- `app/api/coaching/assignments/route.ts` (POST)
- `lib/services/assignment.service.ts`
- Notification helper using existing SMS path + email (WhatsApp lands Phase 2)

**Flow:**
1. Picker: search `vw_tests` filtered to batch's class + subjects. Show test name, question count, duration, marks.
2. Owner selects one test, sets due date and optional instructions.
3. POST → creates `tq_assignments` row.
4. Background job (or sync for Phase 1) — send SMS + email to all enrolled students with link `/coaching/assignments/[id]`.

**Schema reminder:** `tq_assignments` has `batch_id`, `test_id` (legacy ID with the +1M offset for practice), `assigned_by`, `due_at`, `instructions`, `settings_json`.

**Acceptance criteria:**
- Test picker scopes correctly (only tests matching the batch's class + at least one subject).
- Notifications fire to all enrolled students (verify by checking SMS provider logs in dev / console output).
- Race condition handled: assigning the same test twice creates two assignments (intentional — owner may re-assign).

**Verify:**
1. Assign test → 5 SMS + 5 emails sent (or stubbed in dev).
2. Student receives link → can open it → it routes to the test-taking page with the assignment context.

**Complexity:** L (8–10h)

---

### Task 1.9 — Student-side assignment view + linking to existing test flow

**Why:** Students need a way to see assigned tests and take them. Reuses your existing test-taking screen but with assignment context.

**Files:**
- `app/coaching/assignments/[id]/page.tsx` (assignment intro screen)
- Modify existing `app/tests/[id]` to optionally accept an `?assignmentId=` query param for context tracking
- Modify existing attempt-create logic to record assignment context (new column `tq_assignments_attempts` mapping table: `assignment_id`, `attempt_token`, `student_id`)

**Acceptance criteria:**
- Student clicks SMS link → sees assignment intro (batch name, due date, test details) → "Start test" → existing test-taking screen (unchanged) → submit → result.
- The attempt is recorded in legacy `main_exam_status` (unchanged) AND in `tq_assignments_attempts` (new).
- "Assigned to me" section appears on student dashboard `/tests` if the student has any org memberships, listing pending assignments.

**Verify:**
1. Student takes assigned test end-to-end.
2. Result page works as before.
3. Mobile app: same student logs in via mobile, takes a non-assignment test — works identically (no regression).

**Complexity:** L (8–10h)

---

### Task 1.10 — Assignment progress + results view for owner

**Why:** Owner needs to see who's done what, with topic-level analysis.

**Files:**
- `app/coaching/batches/[id]/assignments/[id]/page.tsx`
- `app/api/coaching/assignments/[id]/results/route.ts`

**Sections:**
- Status header: X/Y completed, average score, due date, "Send reminder" bulk action
- Student list: each student with score, completion time, status badge
- "Topic insights" panel: which topics had highest wrong-answer rates (group questions by subject + difficulty as a proxy until you add tags)
- Per-question panel: which questions tripped most students

**Data sources:**
- `tq_assignments_attempts` joined to `main_exam_status` for status
- `main_exam_result` for per-question correctness
- `vw_questions` for question metadata

**Acceptance criteria:**
- Loads in < 1.5s for a 50-student assignment.
- "Send reminder" sends SMS to all `not-started` students (de-duped if mobile is shared).

**Verify:**
1. 5 students take the test, 3 complete, 2 don't → screen reflects 3/5.
2. Topic insights shows correct breakdown.
3. Send reminder → 2 SMS go out.

**Complexity:** L (8–10h)

---

### Task 1.11 — Trial expiry + paid conversion (using existing Razorpay one-time)

**Why:** Convert trial centres to paying customers.

**Files:**
- `app/coaching/billing/page.tsx`
- Reuse existing `/checkout` flow for the actual payment step
- `lib/services/subscription.service.ts`
- Background job (or on-request check): mark subscriptions as GRACE/EXPIRED based on `expiresAt`

**Behaviour:**
- Day 1–11 of trial: no banner.
- Day 12–14: banner on every page "Your trial ends in N days — upgrade now to save 30%".
- Day 15+ (status=GRACE): banner "Trial ended. New assignments paused. Upgrade to continue." Existing assignments still viewable, students can still log in. Owner cannot create new assignments.
- Day 22+ (status=EXPIRED): full lockout for owner. Students can still log in (data preserved). Banner: "Subscription expired. Contact support."
- "Upgrade" CTA goes to `/coaching/billing` → shows plan options → click → existing Razorpay checkout flow with `type=ORG_SUB` (extend existing checkout to handle this).
- On payment success: update `tq_subscriptions.status = ACTIVE`, extend `expiresAt`, record in `tq_orders`.

**Acceptance criteria:**
- Status transitions tested by manipulating `expiresAt` in DB.
- Webhook handler updates subscription correctly (reuse existing webhook signature verification).

**Verify:**
1. Set seed centre `expiresAt` to yesterday → banner appears, new-assignment button disabled.
2. Set `expiresAt` to 8 days ago → owner sees full lockout.
3. Pay via Razorpay test mode → subscription extends.

**Complexity:** L (10–12h)

---

### Task 1.12 — Phase 1 polish + friends-and-family launch

**Why:** Final pass before showing real users.

**Items:**
- Error handling on every form (network failures, validation messages in plain English)
- Empty states everywhere (no batches, no students, no assignments)
- Loading skeletons (no spinners on slow networks)
- Mobile responsiveness pass — test on a real budget phone
- Logout flow (clear JWT, redirect to `/coaching/login`)
- Basic onboarding tooltip/walkthrough on first dashboard visit (skippable)

**Acceptance criteria:**
- No console errors on happy paths.
- Lighthouse mobile score > 80 on key pages.
- Walk through end-to-end as a brand-new owner without referring to docs.

**Verify:**
1. Onboard one real friends-and-family centre.
2. Have the owner complete signup → setup → first assignment → review results, alone, while you watch silently.
3. Note every friction point. File as Phase 2 backlog or hotfix.

**Complexity:** M (one full week of polish + onboarding)

**End of Phase 1 milestone:** 2 friends-and-family centres on the product, free Pro tier, founder-led support. Heavy instrumentation (analytics events on every step of the wizard, signup, first assignment).

---

## 6. Phase 2 — Co-teachers, custom tests, sales-led onboarding (Weeks 5–7)

Goal: enable Growth and Pro tiers. Teachers can be invited. Owners can build custom tests by picking individual questions. Centres can upload their own questions (org-scoped). Testquest admin can onboard centres via sales-led path. WhatsApp Business API replaces SMS as default.

Task-level detail below is intentionally lighter than Phase 1 — refine when you get here based on what you learned in Phase 1.

### Task 2.1 — Teacher invite + role management

- New page `/coaching/team` — list members, invite new teacher (email + name), revoke role
- Invite token + email to teacher with set-password link
- Owner-as-teacher collapse: if org has 1 member, hide role concept entirely; surface roles in UI once a second member is invited

**Complexity:** M (6h)

### Task 2.2 — Custom test builder

- `/coaching/tests/new` — question picker with search, filters (class, subject, difficulty, type), preview
- Save test → writes to legacy `main_exam` + `main_exam_description` + `main_exam_to_question`
- Tests created by an org get a new mapping in `tq_org_tests` so they're scoped (don't show in B2C `/tests` browse)
- Reuse existing admin test-creation backend logic; thin coaching-facing UI on top

**Complexity:** L (12–15h)

### Task 2.3 — Rewire `/api/admin/questions/import` for org scope

- Re-enable the disabled endpoint, but with org context
- Excel template unchanged from existing (find file, follow structure)
- On import: write to legacy `question` + `question_description` + `question_audio_video_paragraph` AND `tq_org_questions` mapping rows
- New page `/coaching/questions` for owner/teacher to import + browse private bank

**Complexity:** L (10h)

### Task 2.4 — Mixed test builder (Testquest bank + own bank)

- Extend question picker from 2.2 to show source labels ("Testquest" / "Your bank")
- Filter toggle: show only my bank, only Testquest, or both
- Reuse the same backend; question source determined by checking `tq_org_questions`

**Complexity:** M (4h)

### Task 2.5 — `/admin/organizations` family for sales-led

- `/admin/organizations` — list with filters (type, status, plan, sales stage)
- `/admin/organizations/new` — create org form for sales-led path
- Magic link email to invited owner (set password, then redirected to setup wizard)
- `/admin/organizations/[id]` — detail: members, batches, usage, billing, sales notes
- Add lightweight CRM fields to `tq_organizations.brandingJson` or new column: `sales_stage`, `next_followup_at`, `sales_notes`

**Complexity:** L (12h)

### Task 2.6 — WhatsApp Business API integration

- Add provider config (Gupshup / MSG91 / etc — depends on choice in week-1 setup)
- New `lib/notifications.ts` abstraction: `sendNotification({ channels: ['whatsapp', 'sms', 'email'], to, template, params })`
- Template registration with provider (assignment notification, reminder, OTP, welcome)
- Replace all SMS-only calls from Phase 1 with the notification abstraction; default order = whatsapp → sms → email

**Complexity:** L (10–12h)

### Task 2.7 — Mobile OTP login at `/coaching/login` (replacing email-only signup-time auth)

- Add "Sign in with mobile" option on `/coaching/login`
- Sends OTP via the notification abstraction (so WhatsApp where available)
- Same JWT issued

**Complexity:** M (5h)

### Task 2.8 — Phase 2 polish + closed beta

- Onboard 3–5 paying centres on Growth or Pro
- Heavy founder support continues; document every gap

**Complexity:** M (full week)

**End of Phase 2 milestone:** real money flowing, 3–5 centres paying, WhatsApp delivery working.

---

## 7. Phase 3 — Parent reports + white-label (Weeks 8–9)

Goal: ship the Pro-tier value-prop (parent reports) and the visual differentiator (white-label).

### Task 3.1 — Parent report PDF generation

- Use `@react-pdf/renderer` or similar (avoid Java/PHP dependencies)
- Report content: score trend (last 4 weeks), weak topics, attendance, comparison to batch average
- Data sources: `main_exam_result` + `main_exam_status` filtered to student + batch
- Generation endpoint: `POST /api/coaching/parent-reports/generate?studentId=X` returns signed URL

**Complexity:** L (12h)

### Task 3.2 — Weekly auto-report cron

- Scheduled job (e.g. Vercel cron or simple cron-job.org if simpler) running Sunday 9am IST
- For each active org, for each student with parent contact, generate report and send via notification abstraction
- Idempotent: don't send same week's report twice

**Complexity:** M (6h)

### Task 3.3 — On-demand report trigger from teacher UI

- Button on student row in batch view: "Send parent report"
- Generates + sends immediately

**Complexity:** S (2h)

### Task 3.4 — White-label settings page

- `/coaching/settings/branding` — only visible on Pro+ subscriptions
- Fields: primary color, secondary color, logo (light + dark variants), centre display name, support contact
- Stored in `tq_organizations.brandingJson`

**Complexity:** M (5h)

### Task 3.5 — Branding propagation through student UX

- Student test-taking screens read org branding from context
- Header logo swaps to centre logo for org students
- Primary color swap (CSS variables)
- "Powered by Testquest" footer only on non-Pro tiers

**Complexity:** L (10h)

### Task 3.6 — Branded emails + branded PDFs

- Email templates accept logo + colors as params
- PDF reports use org branding throughout

**Complexity:** M (5h)

### Task 3.7 — Phase 3 polish + soft launch

- Marketing site `/for-coaching-centres` updates (real testimonials, screenshots)
- 10–20 centres onboarded
- SEO content starts going live

**Complexity:** M (full week)

**End of Phase 3 milestone:** Pro tier sellable, parent reports live, white-label proven.

---

## 8. Phase 4 — Subscriptions, multi-branch, lifecycle (Weeks 10–12)

Goal: recurring revenue and chain customers.

### Task 4.1 — Razorpay Subscriptions integration (recurring)

- Separate from one-time checkout
- For monthly + quarterly plans only (annual stays one-time)
- Mandate creation via Razorpay → store `customer_id` and `subscription_id` in `tq_subscriptions.razorpay_meta` JSON
- Webhook updates: charge succeeded → extend expiresAt; charge failed → grace → retry → cancel

**Complexity:** L (15h)

### Task 4.2 — Mid-cycle seat addition with proration

- `/coaching/billing` → "Add seats"
- Calculate prorated charge: `(seats_added × plan_per_seat_price × days_remaining / total_days)`
- Charge via Razorpay using saved mandate (recurring) or one-time invoice link

**Complexity:** M (6h)

### Task 4.3 — Renewal flow with grace + lockout states

- Grace state already designed in Phase 1; extend to recurring
- 14-day grace for failed auto-renewals
- Manual renewal CTA always available

**Complexity:** M (5h)

### Task 4.4 — Multi-branch support

- Schema: `tq_organizations.parent_org_id` already exists from Phase 0
- Parent org sees consolidated dashboard across child orgs
- Branch-scoped roles: teacher of branch A can't access branch B by default
- Owner can manage all branches

**Complexity:** L (12h)

### Task 4.5 — Student transfer between batches

- One-click transfer with history preservation
- `tq_batch_enrollments.status = 0` on old batch, new row on new batch
- All assignment history remains linked to student

**Complexity:** S (3h)

### Task 4.6 — Teacher reassignment when teacher leaves

- Owner removes teacher → must pick a replacement for each batch teacher owned
- Or batches can be temporarily unassigned (owner takes over)

**Complexity:** M (5h)

### Task 4.7 — Dunning UX

- Failed auto-renewal → email + WhatsApp → in-app banner with "Retry payment" CTA
- 3 retry attempts at +2, +5, +10 days

**Complexity:** M (5h)

### Task 4.8 — Phase 4 polish + scaling prep

- Performance pass for orgs with 500+ students
- DB query optimisation where needed

**Complexity:** M (full week)

**End of Phase 4 milestone:** recurring billing live, multi-branch centres possible, full lifecycle handled.

---

## 9. Phase 5 — Hardening + public launch (Weeks 13–14)

### Task 5.1 — Performance audit + fixes

- Lighthouse runs on every key page; fix anything below 80 mobile
- Test on simulated 3G network (Chrome DevTools)
- DB query analysis: any N+1s or missing indices

**Complexity:** L (full week)

### Task 5.2 — Mobile UX final pass on real budget Android

- Spend a day testing on a sub-₹15k phone
- Fix tap targets, scroll issues, slow renders

**Complexity:** M (2 days)

### Task 5.3 — Bulk operations

- Bulk assign across batches
- Bulk reminder
- Bulk enrollment from CSV

**Complexity:** M (5h)

### Task 5.4 — Sample data for new trials

- On trial signup, optionally populate 1 demo batch with 10 fake students and 1 sample assignment
- Owner can dismiss / delete sample data easily

**Complexity:** M (4h)

### Task 5.5 — Support docs + onboarding video

- 5-minute walkthrough video (Hindi + English versions)
- FAQ page with common questions

**Complexity:** M (3 days, mostly content not code)

### Task 5.6 — Public launch

- Self-serve fully open for Starter + Growth
- Marketing site live with SEO content
- Programmatic pages for (board × class × subject) live or scheduled

**Complexity:** M (variable)

**End of Phase 5 milestone:** public launch.

---

## 10. Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Mobile app breaks due to legacy DB writes | Medium | High | Test mobile after every phase; never alter legacy schema structurally |
| WhatsApp API verification rejected by Meta | Medium | High | Apply Week 1; have SMS fallback always working |
| Razorpay live keys delayed | Medium | High | Apply Week 1; phase 1 trial-to-paid blocks if delayed |
| Question bank quality insufficient for paying centres | Medium | High | Audit in Week 1; budget content cleanup as parallel work |
| Solo developer burnout from 14-week sprint | High | High | Build buffer into estimates; ship Phase 1 in 4 weeks before committing to remaining 10 |
| Claude Code generates code that breaks legacy compat | Low | High | Review every diff; never let it touch legacy tables; mobile smoke test gate per phase |
| Feature scope creep from beta customers | High | Medium | Maintain strict phase scope; track all asks in a backlog, defer to v1.1 |

---

## 11. Open questions log

Track decisions you'll need to make as you go. Update this section as items are resolved.

- [ ] Logo upload storage — local disk acceptable for v1, or move to S3/Cloudinary now?
- [ ] WhatsApp Business API provider — Gupshup vs MSG91 vs Karix vs Twilio? Compare per-message pricing for Indian volume.
- [ ] PDF generation library — `@react-pdf/renderer` vs `puppeteer` vs `pdfkit`. Tradeoff: bundle size vs templating ease.
- [ ] Sample data for new trials — opt-in (checkbox at signup) or always-on with dismiss button?
- [ ] Mobile OTP cost — SMS at ~₹0.15 each, WhatsApp at ~₹0.50 each. Budget projection for Phase 1?
- [ ] Subscription cancellation policy — full refund within 7 days, prorated after? Indian consumer law angle?

---

## 12. Update protocol

When you complete a task:
1. Check it off in this doc.
2. Commit the doc update with the code: `chore: mark task 1.3 done`.
3. If you discover something material (new risk, scope change, decision point), add it to the relevant section.

When you complete a phase:
1. Run the end-of-phase milestone checks.
2. Update `CLAUDE.md` to reflect the new state.
3. Bump `Last updated` at top of this file.
4. Update `USER_JOURNEY.md` "Complete vs pending" section.

When you change strategic direction (e.g. cut a feature, add a new one):
1. Document the decision in `USER_JOURNEY.md` §9 (Architecture decisions log).
2. Adjust phases here if needed.
