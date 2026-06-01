# Testquest — User Journey & Flow Reference

> **Purpose of this doc:** a single self-contained reference for the current product, used to iterate on flows, propose features, and align with collaborators. Drop this into any Claude chat to give it full context.

Last updated: 2026-05-26

---

## 1. Product snapshot

**What it is:** an Indian edtech web app (Next.js) that gives Class 6–12 students a smart way to practice tests, see solutions, and track progress. CBSE / ICSE / State Board.

**Who uses it:**
- **Students** — browse, take, and review tests; pay for premium content
- **Admin** — Testquest staff who manage content (questions, tests, classes, subjects) and commerce (bundles, coupons, orders)
- **Mobile users** — there's an existing mobile app that reads/writes the same database. Web + mobile share users and content.

**Status:** content + attempts + commerce schema are wired up. Real legacy data flows through (28k questions, 1.3k students, 384 tests). Payment flow exists but is gated on Razorpay live keys.

---

## 2. Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript |
| Database | MySQL on Hostinger (shared with legacy + mobile) |
| ORM | Prisma 6 (for `tq_*` web-only tables) + raw SQL via `$queryRaw` for legacy views |
| Auth | Custom JWT in `httpOnly` cookies (no NextAuth) |
| Payments | Razorpay (test keys pending live) |
| UI | shadcn/ui + Tailwind v4, dark default, Meridian visual direction (gold + indigo) |
| Charts | Recharts |
| Fonts | DM Sans (body) + DM Serif Display (italic accents) |

---

## 3. Data architecture (essential context)

The most important thing to understand: **content + users + attempts live in legacy MySQL tables that the mobile app already uses. Web reads/writes them.** New web-only features (orders, coupons, bundles, paid access) live in new `tq_*` tables.

### Legacy tables (untouched — used as source of truth)

| Concept | Tables |
|---|---|
| Auth | `student`, `student_subject_selection` |
| Classes (Indian boards/courses) | `catigories` + `catigories_description` (i18n) |
| Subjects | `subjects` + `subjects_description` + `subcategories` (links subject → class) |
| Questions | `question` + `question_description` (i18n) + `question_audio_video_paragraph` (options) |
| Tests | `main_exam` + `main_exam_description` + `main_exam_to_question` |
| Practice tests | `practice_exam` + `practice_exam_description` + `practice_exam_to_question` |
| Attempts | `main_exam_status` (summary) + `main_exam_result` (per-answer) — grouped by `token` |
| Practice attempts | `practice_exam_status` + `practice_exam_result` |

### Web reads via MySQL VIEWs (read-only, present legacy in app-friendly shape)

| View | Source |
|---|---|
| `vw_classes` | `catigories` + English description |
| `vw_subjects` | `subjects` + English description (with derived `classId`) |
| `vw_questions` | `question` + English description; type maps `(answer_type, question_type)` codes to our enum |
| `vw_question_options` | Pivot of `question_audio_video_paragraph.options_1..6` into rows with `isCorrect` flag |
| `vw_question_meta` | Per-question explanation + marks |
| `vw_tests` | `main_exam` + `practice_exam` UNION (practice IDs offset by +1,000,000) |
| `vw_test_questions` | `main_exam_to_question` + `practice_exam_to_question` |
| `vw_students` | `student` (renamed columns) |
| `vw_attempts_legacy` | `main_exam_status` + `practice_exam_status` UNION |

### New `tq_*` tables (web-only features)

| Table | Purpose |
|---|---|
| `tq_admins` | Admin users (separate from students) |
| `tq_orders` | Razorpay transactions, status, coupon applied |
| `tq_coupons` + `tq_coupon_usages` | Discount codes with limits/scope |
| `tq_bundles` + `tq_bundle_tests` | Time-limited bundles of tests |
| `tq_student_access` | Per-student paid access map (expires after bundle validity) |
| `tq_password_reset_tokens` | (legacy `student.password_reset_token` is used instead — this table is unused) |
| `tq_settings` | Reserved for future global settings |

### Type code mappings (legacy ↔ new)

| New enum | Legacy `answer_type` | Legacy `question_type` |
|---|---|---|
| `SINGLE_MCQ` | 101 | 505 |
| `MULTI_MCQ` | 102 | 504 |
| `FILL_IN_BLANK` | 101 | 507 |
| `PARAGRAPH` | 101 or 102 | 501–503 (parent passage; sub-questions live in `question_audio_video_paragraph` with `sub_question_id > 0`) |

Legacy difficulty: `1 = EASY`, `2 = MEDIUM`, `3 = HARD`.

### Status semantics (gotchas)

- Legacy boolean-ish columns: **`1 = active/correct, 0 = inactive/missing, 2 = wrong`** (e.g. `main_exam_result.result`)
- `*_status` columns: **`1 = active, 0 = inactive (soft-deleted)`**
- `main_exam_status.status`: **`1 = in-progress, 2 = completed`**
- `sub_question_id = 0` is the "standalone question" indicator; paragraph children use 1, 2, 3…
- Correct answer format: position-based CSV like `",,3,,,"` (option C correct) **or** short form `"3"`
- `correct_answer = ""` means unanswered (FK-soft)

### MVP decisions (locked)

| Decision | Choice |
|---|---|
| Pricing model | Hybrid — free tier + per-test purchase + bundles + coupons |
| Payment | Razorpay direct checkout (no wallet) |
| Expiry | Bundles expire after `validity_days`; per-test purchases lifetime |
| Question types in web UI | Single MCQ + Multi MCQ + Fill-in-blank only (Paragraph/Subjective hidden in MVP) |
| Roles | Student + Admin (Faculty, Center deferred to v2) |
| Language | English only (legacy `languages_id = 3`) |
| Chapter taxonomy | Skipped — questions belong to a Subject directly. Tags system planned for v2. |
| Admin scope | Shared web + mobile (admin writes legacy tables) |
| Attempts | Written to legacy result tables so mobile sees web attempts and vice versa |

---

## 4. Personas

### 4.1 Student
- **Age:** 11–18 (Class 6 to Class 12)
- **Device:** primarily mobile (existing app), increasingly web
- **Goals:** practice for board exams, see where they stand, track improvement
- **Pain points:** legacy app's slow load, no detailed solutions on free tests, payment friction

### 4.2 Admin (Testquest staff)
- **Role:** content + commerce manager
- **Goals:** publish new questions and tests, run promos via coupons, monitor revenue
- **Pain points:** legacy admin (old PHP) is clunky; needs a modern panel that mobile + web both consume

### 4.3 Mobile user (shared data)
- Not a separate persona — same student profile as web, just accessed from the mobile app
- Treated as a constraint, not a feature: anything we do on web must not break their data

---

## 5. Student journeys

### 5.1 First visit (anonymous)

```
Landing page (/) 
  ├─ Hero, social proof, FAQ, pricing teaser
  ├─ CTA: "Start free" → /signup
  └─ CTA: "Sign in" → /login
```

Public pages:
- `/` — landing
- `/login` — sign in
- `/signup` — register
- `/forgot-password` → `/reset-password?token=…`

### 5.2 Signup → first test (happy path)

1. **`/signup`**
   - Fields: full name, email, mobile (optional), password (≥6), **class** (from legacy `catigories`), **board** (CBSE / ICSE / State)
   - Validation: email unique in legacy `student` table; password bcrypt-hashed
   - Writes to legacy `student` table (`first_name`, `surname_name`, `email_address`, `password`, `category_id`, `mobile_no`, `status=1`)
   - Issues a JWT cookie with `student.student_id` as the identity
2. Redirect → **`/tests`**
3. **`/tests` browse page**
   - Filters: class, subject, free/paid, search
   - Cards show: name, class/subject, free badge, question count, duration, marks, last score (if any)
4. Click a test → **`/tests/[id]` detail**
   - Stats, instructions, "Start test" CTA
   - For free tests: immediate access. For paid tests: "Unlock test" → `/checkout`
5. Click **Start test** → `POST /api/attempts`
   - Creates a row in `main_exam_status` (or `practice_exam_status` for practice tests, where exam_id ≥ 1,000,000)
   - Generates a 40-char token, attempt status = 1
6. Redirect → **`/attempts/[id]`** test-taking screen
   - Top bar: timer pill (color shifts amber < 5min, red < 1min), pause button, submit
   - Question palette on the right (green = answered, amber = flagged)
   - Auto-save answers via debounced `POST /api/attempts/[id]/answer`
   - Answers stored in `main_exam_result` (or practice variant), keyed by `token`
7. **Submit** → `POST /api/attempts/[id]/submit`
   - Aggregates correct/wrong/score from `main_exam_result`
   - Updates `main_exam_status.status = 2`, sets finish times
   - Redirect → `/attempts/[id]/result`
8. **`/attempts/[id]/result`**
   - Big score hero, summary tiles (correct / incorrect / skipped)
   - Per-question review (paid tests get correct answer + explanation; free tests get score only)
   - CTAs: "Retake test" / "More tests"

### 5.3 Returning user

- **`/tests`** — browse again. Last attempt score shown on each card.
- **`/dashboard`**
  - Stats: total attempts, completed, average %, available tests
  - Recent attempts (last 10)
  - Subject breakdown (avg % per subject, color-coded)
  - Score trend (last 10 percentages, gold-area chart)
- **`/my-attempts`** — full paginated attempt history
- **`/profile`** — edit name, mobile, class, board; view purchase history

### 5.4 Paused / resumed attempt

- Student clicks **Pause** mid-test → returns to `/tests`
- Legacy doesn't have an explicit "paused" status — we set `main_exam_status.on_exam_spend_time_by_children = NOW()`
- Returning to the same test detail page detects the in-progress attempt and shows **Resume attempt**
- Click resume → loads `/attempts/[id]` with previously saved answers

### 5.5 Purchase flow (Razorpay)

1. Student clicks **Unlock test** or **Buy bundle** → `/checkout?type=TEST&id=…`
2. Optional **coupon code** → `POST /api/coupons/validate` shows discount
3. Click **Pay** → `POST /api/orders/create`
   - Creates `tq_orders` row with `status = "PENDING"`
   - Returns Razorpay order ID + key for frontend SDK
4. Razorpay modal opens → student pays (cards / UPI / netbanking / wallets)
5. On success → `POST /api/orders/verify` with signature
   - Cryptographic verification (`crypto.timingSafeEqual`)
   - Marks order `PAID`
   - Inserts/updates `tq_student_access` row (`expiresAt` for bundles, `null` for lifetime per-test)
   - Records `tq_coupon_usages` if a coupon was used
6. Redirect → `/checkout/success`
7. Student goes back to `/tests/[id]` → now sees **Start test**

### 5.6 Password reset

1. **`/forgot-password`** → email submitted
2. `POST /api/auth/forgot-password` writes `student.password_reset_token` + 1-hour expiry, sends email
3. Email link → **`/reset-password?token=…`**
4. New password submitted → `POST /api/auth/reset-password` consumes token, updates `student.password`
5. Redirect → `/login`

### 5.7 Google sign-in

1. Frontend uses Google Identity SDK → gets verified ID token
2. `POST /api/auth/google` verifies token with Google's keys
3. Find by email in legacy `student`; create if absent (no password — Google-only account)
4. JWT issued, redirect → `/tests` or `/onboarding` if `classId` is missing

---

## 6. Admin journeys

### 6.1 Login & dashboard

- **`/admin/login`** — separate from student login
- Admins authenticate against `tq_admins` (web-only) with bcrypt
- Default credentials seeded: `admin@testquest.in` / `admin123`
- After login → **`/admin`**
  - Revenue chart (Recharts area chart, gold gradient)
  - Stat tiles: revenue (period + all-time), order count, students, avg order value
  - Recent orders feed
  - Top bundles
- Time period selector (7d / 30d / 90d / 1y)

### 6.2 Content management (writes to legacy tables)

| Page | Reads | Writes |
|---|---|---|
| `/admin/classes` | `vw_classes` + counts | `catigories` + `catigories_description` |
| `/admin/subjects` | `vw_subjects` + counts | `subjects` + `subjects_description` + `subcategories` |
| `/admin/questions` | `vw_questions` (lean) | `question` + `question_description` + `question_audio_video_paragraph` |
| `/admin/tests` | `vw_tests` + counts | `main_exam` + `main_exam_description` |
| `/admin/tests/[id]/questions` | `vw_test_questions` | `main_exam_to_question` |

**Create question flow:**
1. Admin clicks **New question** → dialog opens
2. Picks Class → Subject (cascading)
3. Picks Type: Single MCQ / Multi MCQ / Fill-in-blank
4. Picks Difficulty (Easy / Medium / Hard)
5. Enters question text + 2–6 options (marks correct via toggle) or fill-in answer
6. Optionally adds explanation
7. Save → INSERTs into 3 legacy tables in one shot
8. Question immediately visible to mobile app users

**Create test flow:**
1. Admin clicks **New test** → dialog opens
2. Picks Class → Subject; sets name, description, duration, price (or free), retake cooldown
3. Question picker on the right — searches `vw_questions` filtered by chosen subject
4. Selects questions in order (checkbox per question)
5. Save → INSERTs `main_exam` + `main_exam_description` + 1 row per question in `main_exam_to_question`
6. Test live for students immediately (web + mobile)

**Soft delete:** All entities use `*_status = 0` (not DELETE). Re-activate via PATCH `isActive: true`.

### 6.3 Commerce (writes to `tq_*`)

| Page | Reads / Writes |
|---|---|
| `/admin/bundles` | `tq_bundles` + `tq_bundle_tests` |
| `/admin/coupons` | `tq_coupons` with constraints (% / flat, max cap, min order, scope, validity dates, per-user / total limits) |
| `/admin/orders` | `tq_orders` (searchable by student name/email, payment ID, status filter) |
| `/admin/students` | `tq_admins`-side overview pulling from legacy `student` table + revenue stats |

### 6.4 Excel import (temporarily disabled)

- `/api/admin/questions/import` returns 503 with friendly message
- Will be rewired to write to legacy schema in a future iteration

---

## 7. Theme + UX details

- **Default theme:** dark. User can toggle dark / light / system from the header.
- **Brand palette:**
  - Primary: saffron gold `oklch(0.78 0.17 65)` (used on CTAs, active states, key numbers)
  - Surface: deep indigo dark `oklch(0.13 0.04 270)`
  - Score colors: emerald (≥75%), amber (≥50%), red (<50%)
- **Typography:**
  - Body: DM Sans
  - Headlines & numbers: DM Serif Display (italic accents)
- **Animations:** Quest Constellation (landing hero), Achievement Pulse Rings (dashboard tiles), Drifting Formulas (tests page background), Rotating Yantra (login pages). All respect `prefers-reduced-motion`.

---

## 8. What's complete vs pending

### ✅ Complete & verified

- Auth: signup, login, Google sign-in, password reset — all on legacy `student` table
- Browse 384 real legacy tests with filters (class, subject, free/paid, search)
- Start, take, submit a test — answers persisted to legacy `main_exam_result`
- Result page with per-question review
- Student dashboard, history, profile
- Admin: classes, subjects, questions, tests CRUD against legacy tables
- Admin: bundles, coupons, orders CRUD in `tq_*`
- Razorpay integration (test mode); webhook signature verified
- Dark / light theme toggle
- Premium Meridian visual design (saffron + indigo + DM Sans + DM Serif Display)

### 🚧 Partial / pending

| Item | Status |
|---|---|
| Excel question import | Disabled (returns 503). Needs rewire to legacy schema. |
| Paragraph / subjective questions | Flattened to standalone in views — paragraph passages lose grouping. v2 work. |
| Faculty grading UI | Out of MVP scope. Subjective answers stored but no grading interface. |
| Detailed solutions on free tests | Intentionally locked behind purchase. UX hides them on result page. |
| Multi-language i18n | English only. Hindi rows in legacy ignored. |
| Centers (legacy concept) | Dropped from MVP. Student rows have `center_id = 0`. |
| Order refund workflow | Stub — no admin UI yet. |
| Audit log for admin actions | Not implemented. |
| Email delivery (SMTP) | Configured in env, but not load-tested. Forgot-password emails depend on SMTP creds. |
| Razorpay live keys | Test keys only. Needs production credentials before go-live. |

### 🗑 Out of scope (explicit)

- Wallet system (legacy has one; we're dropping it for MVP)
- Multi-admin roles / permissions
- Proctoring / anti-cheat
- Native mobile app for this rebuild (existing mobile app stays as-is)
- CSV/Excel export of results
- Subscription auto-renewal

---

## 9. Architecture decisions log

| # | Decision | Why |
|---|---|---|
| 1 | Vanilla PHP legacy app is **not** Laravel | Reading the codebase confirmed procedural PHP with mysqli, no framework |
| 2 | Rebuild on Next.js + Node + MySQL | Owner's chosen target stack |
| 3 | Compatibility VIEWs over legacy tables | Lowest-risk path — mobile app keeps working unchanged, web sees same data live |
| 4 | Admin writes directly to legacy tables | Single source of truth between web + mobile |
| 5 | New attempts → legacy `main_exam_status` + `main_exam_result` | Shared attempt history; mobile sees web attempts and vice versa |
| 6 | Subject dedup by `(Class × English name)` | Legacy has 28 duplicates of "Life Process" across subcategories. Collapsing gives a clean admin experience. |
| 7 | Paragraph questions flatten to first sub-question only | Performance + simplicity. Loses passage UX. ~50 questions affected. |
| 8 | Stateless JWT in httpOnly cookie (no `student_token` table) | Simpler, faster, no DB write per login |
| 9 | Razorpay only (no PayU/PayPal) | Modern Indian-market UX; signature verification + idempotency |
| 10 | Soft-delete via `*_status = 0` | Matches legacy convention; admin can re-activate |
| 11 | Chapter taxonomy deferred | Legacy has no concept of chapter. Use tags in v2 if needed. |
| 12 | Practice test IDs offset by +1,000,000 | Disambiguates main vs practice without a separate column |

---

## 10. Suggested next iterations

> These are ideas to discuss — not committed work.

### Quick wins
- **Rewire Excel question import** to write to legacy schema
- **Onboarding step** for new Google-signup users to pick class + board
- **Search across questions** in admin (currently slow — needs index or different approach)
- **Bulk question status toggle** in admin (activate/deactivate multiple at once)
- **Better empty states** with sample data prompts ("Create your first test")

### Medium effort
- **Live result analytics for admin** — which questions are getting most wrong answers, average score per test
- **Student progress reports** as PDF (TCPDF already vendored in legacy)
- **Coupon analytics** — show usage trends per coupon
- **Bundle expiry email** — notify students before bundle access expires
- **Subject icons** in browse cards (currently shows only the first letter)
- **Paragraph question support proper** — group sub-questions back together with passage display

### Larger initiatives
- **Faculty role + grading dashboard** for subjective questions
- **Streaks + gamification** (daily practice streak, achievement badges)
- **Question recommendations** based on weak topics
- **Adaptive difficulty** — next question adjusts to performance
- **Multi-language (Hindi)** — legacy already has the data; just need UI toggle
- **Live exams** — scheduled time-bound tests for all students
- **Discussion / doubts** — students can ask questions, faculty/peers answer
- **Live class scheduling** — connect to Zoom/Google Meet
- **Affiliate program** — center/teacher revenue share

### Ops & quality
- **Data correction pipeline** — orphan subjects, missing classes, malformed correct_answer strings need cleanup
- **Question moderation** — admin approval queue for content-team additions
- **Monitoring / alerts** — track API errors, slow queries
- **Backups** — automated daily Hostinger backup verification (last incident proved this matters)

---

## 11. Known gotchas / data quirks

- `subjects_id = 0` exists — orphan questions with no subject. Mapped to a synthetic "Unassigned" subject in some views.
- Some legacy classes have `categories_status = 0` (inactive) but still have content. Active-only filters may hide content.
- `student.encrypt_password` has **plaintext** passwords for some legacy users. Never read this column.
- `main_exam.subject_id` is a CSV like `"25,24,31"` — we take the first.
- Some `correct_answer` values are empty strings (legacy data quality issue) — those questions effectively can't be auto-graded.
- HTML-stripped question text often still has stray whitespace from `&nbsp;` etc.
- `practice_exam` rows have many empty `subject_id` fields — those tests show with no subject in the UI.

---

## 12. Key URLs (when running locally)

| URL | Purpose |
|---|---|
| `/` | Landing |
| `/login` / `/signup` | Auth |
| `/forgot-password` / `/reset-password?token=…` | Reset |
| `/tests` | Browse |
| `/tests/[id]` | Test detail |
| `/attempts/[id]` | Take a test |
| `/attempts/[id]/result` | Review result |
| `/dashboard` | Student dashboard |
| `/my-attempts` | History |
| `/profile` | Edit profile + purchases |
| `/checkout?type=TEST&id=…` | Razorpay checkout |
| `/checkout/success` | Post-payment |
| `/admin/login` | Admin sign-in |
| `/admin` | Admin dashboard |
| `/admin/classes` `/admin/subjects` `/admin/questions` `/admin/tests` | Content CRUD |
| `/admin/bundles` `/admin/coupons` `/admin/orders` `/admin/students` | Commerce |

---

## 13. How to use this doc

When discussing changes with Claude (or any collaborator):

1. **For new features:** paste the relevant section + propose the change. Ask Claude to identify which legacy tables / views / routes are affected.
2. **For flow modifications:** describe what's broken or unwanted in the current flow, reference the journey in §5 or §6.
3. **For decisions:** add to the log in §9 with rationale.
4. **For deferred work:** move items from §10 into a backlog tracker once committed.

Keep this doc updated as decisions change. The "Decisions log" + "Complete vs pending" sections matter most for ongoing work.
