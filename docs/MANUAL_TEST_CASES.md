# Testquest — End-to-End Manual Test Cases (all personas)

> Full persona-by-persona test pack for the coaching MVP + B2C + Razorpay payments.
> Run against `http://localhost:3000` with `npm run dev` running.
> Companion docs: `docs/user-personas.md` (who), `docs/test-scenarios.md` (older flow notes).

---

## 0. Environment & fixtures

| Item | Value |
|---|---|
| Base URL | `http://localhost:3000` |
| Reset demo state | `npm run seed:coaching` (rebuilds Sunrise org 1) |
| Razorpay mode | **Test** (`rzp_test_SveVOQSe4NWIgE`) |
| Razorpay test card | `4111 1111 1111 1111`, expiry `12/30`, CVV `123`, then choose **Success** (or **Failure** to test the failed path) |

### Accounts

| Persona | Login URL | Email / Mobile | Password |
|---|---|---|---|
| Testquest staff | `/admin/login` | `admin@testquest.in` | `admin123` |
| Centre owner (Sunrise, org 1) | `/coaching/login` | `demo-owner@testquest.local` / `9876512345` | `demo1234` |
| Centre owner (Acme, org 7, sales-led) | `/coaching/login` | `rahul.acme@example.com` | `rahul123` |
| B2C student | `/login` or `/signup` | create your own | — |

### Live fixture IDs (verified against the DB)

| Fixture | ID / value | Notes |
|---|---|---|
| **Paid test** | **id 92** — "Chemistry Exam 6" — **₹499** | The one paid test seeded. URL: `/checkout?type=TEST&id=92` |
| Free tests | 48, 49, 51 | For the free-unlock path |
| Demo owner student | 2010 (mobile `9876512345`) | |
| Sunrise students | 2011 Priya (`9000011111`), 2012–2015 (no mobile) | |
| Plans | 1 Starter (₹0/trial), 2 Growth (₹149/seat/yr), 3 Pro (₹299/seat/yr) | |
| Branch orgs | 10, 11, 14 (parentOrgId=1) | Multi-branch tests |

> ⚠️ **Gaps to seed before testing those areas:** **0 bundles** and **0 coupons** exist. TC-B2C-03 (bundle) and the coupon steps need an admin to create one first (TC-STAFF-04 / TC-STAFF-05), or skip + mark N/A.

### How to read a test case
- **Pre** = preconditions. **Steps** = do these. **Expect** = pass criteria. **DB/Log check** = optional server-side confirmation. **Result** = ☐ Pass ☐ Fail ☐ Blocked.

---

# PERSONA A — Anonymous Visitor

### TC-ANON-01 · Marketing & public pages load
- **Steps:** Visit `/`, `/for-coaching-centres`, `/help`.
- **Expect:** All render, no console errors. `/help` search filters FAQ live. CTAs route to `/signup` / `/coaching/signup`.
- **Result:** ☐

### TC-ANON-02 · Auth gates redirect
- **Steps:** While logged out, hit `/dashboard`, `/coaching/dashboard`, `/admin`.
- **Expect:** Each redirects to its login page (no data leak).
- **Result:** ☐

### TC-ANON-03 · Anonymous branding API
- **Steps:** `GET /api/student/branding` with no cookie.
- **Expect:** `200 { ok:true, data:null }`.
- **Result:** ☐

---

# PERSONA B — B2C Student (outside any org)

### TC-B2C-01 · Sign up + email/password login
- **Steps:** `/signup` → create account → `/login` → sign in.
- **Expect:** Lands on `/tests`; `/api/auth/me` returns `role:"student"`, `displayRole:"student"`, `org:null`.
- **Result:** ☐

### TC-B2C-02 · 💳 Buy a paid test (one-time Razorpay) — PRIMARY PAYMENT FLOW
- **Pre:** Signed in as B2C student.
- **Steps:**
  1. Open `/tests` → click "Chemistry Exam 6" (or go to `/checkout?type=TEST&id=92`).
  2. Click **Pay ₹499** → Razorpay modal opens.
  3. Pay with test card → **Success**.
- **Expect:** Redirect to `/checkout/success`. Test now unlocked (no Buy button on revisit; access granted).
- **DB check:** new `tq_orders` row, `itemType=TEST`, `status=PAID`, `razorpayPaymentId` populated; `tq_student_access` row for (student, test 92).
- **Result:** ☐

### TC-B2C-02b · Payment modal dismissed (cancel)
- **Steps:** Repeat above to the modal, press **Esc** / close.
- **Expect:** Returns to checkout, button resets to "Pay", **no** charge, order stays `PENDING`/not created-as-paid; access NOT granted.
- **Result:** ☐

### TC-B2C-02c · Payment failure path
- **Steps:** Open modal → choose **Failure** on the Razorpay test screen.
- **Expect:** Error message shown; order marked `FAILED`; access NOT granted.
- **DB check:** order `status=FAILED`.
- **Result:** ☐

### TC-B2C-02d · Already-owned test
- **Pre:** TC-B2C-02 passed (own test 92).
- **Steps:** Go to `/checkout?type=TEST&id=92` → Pay.
- **Expect:** `409` "You already have access to this test."
- **Result:** ☐

### TC-B2C-03 · Buy a bundle (one-time) — *needs a bundle seeded*
- **Pre:** A bundle exists (create via TC-STAFF-04). Use `/checkout?type=BUNDLE&id=<bundleId>`.
- **Steps:** Pay with test card → Success.
- **Expect:** All tests in the bundle unlock; `tq_student_access` rows have `expiresAt = now + validityDays`.
- **Result:** ☐ (☐ N/A if no bundle)

### TC-B2C-04 · Coupon — full discount → free grant (no Razorpay) — *needs a coupon*
- **Pre:** A 100%-off coupon exists (TC-STAFF-05).
- **Steps:** On `/checkout?type=TEST&id=92` → enter code → **Apply** → total ₹0 → **Get for free**.
- **Expect:** Skips Razorpay entirely; redirect to success; access granted; `tq_coupon_usages` row written.
- **Result:** ☐ (☐ N/A)

### TC-B2C-05 · Coupon — partial discount then pay — *needs a coupon*
- **Steps:** Apply a ₹100-off coupon on test 92 → total ₹399 → Pay via Razorpay.
- **Expect:** Razorpay amount = ₹399 (39900 paise); order `finalAmount=399`, coupon usage recorded on success.
- **Result:** ☐ (☐ N/A)

### TC-B2C-06 · Take a free test end-to-end
- **Steps:** `/tests` → open test 48 → start → answer → submit → view result.
- **Expect:** Attempt saved (`main_exam_status` completed); result page shows score; appears in `/my-attempts`.
- **Result:** ☐

### TC-B2C-07 · Profile + my-attempts
- **Steps:** `/profile` edit name/class → save. `/my-attempts` lists past attempts.
- **Expect:** Profile persists; attempts list correct.
- **Result:** ☐

### TC-B2C-08 · Validation copy (S1 fix)
- **Steps:** From the OTP/login or any form, submit a too-short mobile (`123`).
- **Expect:** Plain-English error (e.g. "Mobile must be at least 10 characters."), HTTP **400** (not 422, not raw Zod).
- **Result:** ☐

---

# PERSONA C — Centre Owner (Sunrise, org 1)

### TC-OWN-01 · Email/password login + dashboard
- **Steps:** `/coaching/login` → email tab → Sunrise creds.
- **Expect:** `/coaching/dashboard`: greeting, "Sunrise Coaching Centre · Pune", stat tiles render (no PrismaClientKnownRequestError), trial banner "Starter trial · N days left", header nav (Tests/Questions/Team/Settings/Branches/Help).
- **Result:** ☐

### TC-OWN-02 · Mobile OTP login
- **Steps:** Sign out → `/coaching/login` → **Mobile + OTP** → `9876512345` → Send → read dev OTP on screen → enter → Sign in.
- **Expect:** Chip "Code sent to 9876512345 · Sunrise Coaching Centre"; lands on dashboard.
- **Edges:** bad mobile `1234567890` → "No Testquest account found…"; wrong code → "That code didn't match."; 5 wrong → lockout copy; resend 30s cooldown.
- **Result:** ☐

### TC-OWN-03 · displayRole correctness (S3 fix)
- **Steps:** `GET /api/auth/me` as owner.
- **Expect:** top-level `role:"student"` (legacy table) BUT `displayRole:"owner"`, `org.role:"OWNER"`.
- **Result:** ☐

### TC-OWN-04 · Build a custom test
- **Steps:** Tests → **+ Create test** (`/coaching/tests/new`) → pick class → toggle All/Testquest/Your bank → tick 3–5 Qs → Preview one → name it, set duration + passing % → **Save**.
- **Expect:** Badges per row (Subject·Difficulty·Type·N options·source); selection counter; redirect to `/coaching/tests` with new test listed.
- **Edges:** mixed subjects → warning; empty selection → Save disabled.
- **Result:** ☐

### TC-OWN-05 · Bulk import questions (own bank)
- **Steps:** `/coaching/questions` → Import panel → Download template → fill 5–10 rows incl. 1 broken row → upload.
- **Expect:** "N imported · M skipped"; skip reasons in plain English; imported rows show `YOUR BANK` badge.
- **Edges:** >5MB → "File is too large."; empty → "That sheet is empty."; bad type → enumerated allowed types.
- **Result:** ☐

### TC-OWN-06 · Create batch + add students (manual)
- **Steps:** `/coaching/batches/new` → name, class, board, subjects → Create. Open batch → add a student (name+mobile).
- **Expect:** Batch created; student enrolled; appears on Students tab.
- **Result:** ☐

### TC-OWN-07 · Bulk CSV student import
- **Steps:** `/coaching/batches/1/students/import` → Download template → fill 5–10 rows (include 1 dup mobile) → upload.
- **Expect:** "N enrolled · M skipped"; dup mobile within file → only one enrolled; existing email → reuses legacy row.
- **Result:** ☐

### TC-OWN-08 · Assign a test (single + bulk to multiple batches)
- **Pre:** ≥2 active batches.
- **Steps:** `/coaching/batches/1/assign` → pick test → expand **Also assign to** → tick other batches → due date + channels → **Assign to N batches**.
- **Expect:** Redirect to dashboard; each batch's Assignments tab shows it; partial failure surfaces a per-batch error list.
- **Result:** ☐

### TC-OWN-09 · Parent report (single + bulk)
- **Pre:** A student with ≥1 finished attempt.
- **Steps:** `/coaching/batches/1` → student 3-dot → **Send parent report**. Then dashboard → **Remind behind** (bulk).
- **Expect:** No-attempt student → "Not enough activity yet."; with attempts → "Sent" pill; dev console shows `[email-stub]`/`[sms-stub]`/`[whatsapp-stub]` + PDF at `public/uploads/reports/<token>.pdf`.
- **Result:** ☐

### TC-OWN-10 · 💳 Plan upgrade (one-time Razorpay) — PRIMARY PAYMENT FLOW
- **Steps:** `/coaching/billing` → confirm Starter trial card → pick **Growth** or **Pro** → **Upgrade now** → Razorpay modal → pay test card → Success.
- **Expect:** Redirect to dashboard; billing card → **ACTIVE** + chosen plan + new renewal date.
- **DB check:** `tq_orders` row `itemType=ORG_SUB status=PAID`; `tq_subscriptions` row `status=ACTIVE`, `expiresAt` extended.
- **Edges:** Starter (₹0) → Upgrade disabled; dismiss modal → no change.
- **Result:** ☐

### TC-OWN-11 · White-label branding (+ S2 color validation)
- **Steps:** `/coaching/settings/branding` → set primary `oklch(0.7 0.18 25)`, display name "Sunrise Coaching", support email → Save. Then try saving primary = `not-a-color`.
- **Expect:** Valid save → "Saved." Invalid color → **400** with "Primary colour must be a valid CSS colour…" (S2). On Starter ACTIVE (post-upgrade non-trial) the form is replaced by an "Available on Growth+" card / PUT returns 402.
- **Result:** ☐

### TC-OWN-12 · Team invite → accept → revoke w/ reassignment
- **Steps:** `/coaching/team` → invite "Test Teacher" `test-teacher@example.com` role TEACHER → copy accept URL from dev log → incognito → set password → dashboard as TEACHER. Assign to batch 1 (`POST /api/coaching/batches/1/teachers`). Revoke without plan → **409** listing batches; revoke with plan → success.
- **Expect:** Invite pending → accepted; revoke-without-plan blocked (409); revoke-with-plan flips membership off.
- **Result:** ☐

### TC-OWN-13 · Multi-branch (parent-org)
- **Steps:** `/coaching/branches` → **+ Add branch** "Sunrise — Test" → Create → **View dashboard →** (JWT switches) → return → switch back to Sunrise.
- **Expect:** Branch listed; branch dashboard shows owner as OWNER (cascade); default returns to parent on re-login.
- **Edge:** Sunrise TEACHER visiting branch dashboard URL → redirect/404 (no cascade for TEACHER).
- **Result:** ☐

### TC-OWN-14 · Student transfer between batches (U1 fix)
- **Pre:** ≥2 batches; a student in batch 1.
- **Steps:** `/coaching/batches/1` → student 3-dot → **Transfer** → pick target → Transfer. Then transfer the same student to the batch they're already in.
- **Expect:** Moves successfully (old enrollment `isActive=false`, new `isActive=true`, attempt history preserved). Already-enrolled target → **409** "already enrolled" (NOT 400).
- **Result:** ☐

### TC-OWN-15 · Sample data seed + delete (new signup)
- **Steps:** Sign out → `/coaching/signup` → new centre `test-5.4@example.com` → finish setup wizard → dashboard shows **Sample data banner** → **Delete demo data**.
- **Expect:** Demo batch/10 students/1 assignment created on signup, then all `isActive=false` after delete; empty-state shows.
- **Result:** ☐

---

# PERSONA D — Centre Admin (ADMIN role)

### TC-ADM-01 · Accept admin invite + scope
- **Pre:** Owner invites `admin-test@example.com` as ADMIN (TC-OWN-12 pattern).
- **Steps:** Accept link → set password → dashboard.
- **Expect:** Full access to batches/assignments/students/settings/billing **view**; **cannot** revoke OWNER, cannot see sales notes.
- **Result:** ☐

### TC-ADM-02 · Admin can edit branding, cannot pay
- **Steps:** As ADMIN open `/coaching/settings/branding` (edit allowed on Growth+), open `/coaching/billing` (can view).
- **Expect:** Branding editable; billing visible; pay action is owner-driven (admin sees state).
- **Result:** ☐

---

# PERSONA E — Centre Teacher (TEACHER role)

### TC-TCH-01 · Scoped dashboard
- **Pre:** Teacher invited + assigned to batch 1.
- **Steps:** Login as teacher → `/coaching/dashboard`.
- **Expect:** Sees only assigned batch(es); can assign tests + send reminders/reports for them; question bank visible.
- **Result:** ☐

### TC-TCH-02 · Teacher restrictions
- **Steps:** Try `/coaching/team` (read-only), `/coaching/settings/branding`, `/coaching/billing`, and a batch they don't teach.
- **Expect:** Team = read-only; branding/billing blocked; non-owned batch not visible (4.6 boundary).
- **Result:** ☐

### TC-TCH-03 · Reassigned teacher (V6)
- **Steps:** Owner revokes Teacher X from batch, reassigns to Teacher Y.
- **Expect:** Y sees the batch; X loses access on next request.
- **Result:** ☐

---

# PERSONA F — Centre Student (STUDENT role, inside org)

### TC-STU-01 · Join via token (mobile OTP, no password)
- **Pre:** Owner issues a batch invite link (`/coaching/join/[token]`).
- **Steps:** Open link → enter mobile → OTP (dev echo) → verify.
- **Expect:** Enrolled in batch; lands on `/tests` with **org branding** applied.
- **Result:** ☐

### TC-STU-02 · Assigned tests + take attempt
- **Steps:** As Sunrise student (e.g. set password for 2011 or join-flow) → `/tests` → "Assigned to me" → open assignment → take → submit.
- **Expect:** Assignment visible; attempt records to `main_exam_status`/`main_exam_result`; result viewable.
- **Result:** ☐

### TC-STU-03 · Student cannot access /coaching/*
- **Steps:** Navigate to `/coaching/dashboard` as student.
- **Expect:** Redirected to `/tests`.
- **Result:** ☐

### TC-STU-04 · Branding propagation (org vs Testquest)
- **Steps:** As Sunrise student view `/tests`, `/dashboard`, `/profile`.
- **Expect:** Header shows Sunrise display name + primary color; "Powered by Testquest" footer present (Starter). Flip Sunrise → Pro → footer disappears. B2C student (no org) → default Testquest branding.
- **Result:** ☐

---

# PERSONA G — Parent (notification recipient, no login in MVP)

### TC-PAR-01 · Weekly/auto report delivery
- **Steps:** Trigger parent report (TC-OWN-09); inspect the PDF + channel logs.
- **Expect:** PDF generated (branded on Pro orgs, 3.6); `channel=whatsapp+sms+email`; "parent contact" falls back to student's own email/mobile (MVP compromise).
- **Result:** ☐

---

# PERSONA H — Testquest Staff (admin)

### TC-STAFF-01 · Admin login + dashboard
- **Steps:** `/admin/login` → admin creds → `/admin`.
- **Expect:** `/api/auth/me` → `role:"admin"`, `displayRole:"admin"`. Dashboard renders.
- **Result:** ☐

### TC-STAFF-02 · Sales-led org onboarding
- **Steps:** `/admin/organizations` → **Onboard centre** → fill name/city/owner/plan/sales stage/notes → submit → copy welcome URL → incognito → owner sets password → `/coaching/setup`.
- **Expect:** Org created with welcome token; `/admin/organizations/[id]` shows members/batches/billing/sales tabs; "Resend welcome" until accepted; `409` "Owner has already set their password" after accept.
- **Result:** ☐

### TC-STAFF-03 · CRM edits persist
- **Steps:** `/admin/organizations/[id]` → edit sales stage + notes + follow-up → save → reload.
- **Expect:** Values persist.
- **Result:** ☐

### TC-STAFF-04 · Create a bundle (unblocks TC-B2C-03)
- **Steps:** `/admin/bundles` → create bundle with ≥2 tests, a price, validityDays → save.
- **Expect:** Bundle active; usable at `/checkout?type=BUNDLE&id=<id>`.
- **Result:** ☐

### TC-STAFF-05 · Create coupons (unblocks TC-B2C-04/05)
- **Steps:** `/admin/coupons` → create (a) 100%-off and (b) ₹100-off coupon, active, valid dates.
- **Expect:** Both appear; validate via `/api/coupons/validate`.
- **Result:** ☐

### TC-STAFF-06 · 💰 Orders & revenue reflect payments
- **Pre:** TC-B2C-02 and/or TC-OWN-10 completed.
- **Steps:** `/admin/orders` then `/admin/revenue`.
- **Expect:** Paid orders listed with Razorpay payment ids + status PAID; revenue totals include them.
- **Result:** ☐

### TC-STAFF-07 · Master content CRUD
- **Steps:** Spot-check `/admin/classes`, `/admin/subjects`, `/admin/questions`, `/admin/tests` — create/edit/soft-delete one item each.
- **Expect:** Writes succeed against legacy tables; soft delete = `status=0`.
- **Result:** ☐

---

# PERSONA I — Razorpay webhook (system actor)

### TC-WH-01 · Webhook signature gate
- **Pre:** `RAZORPAY_WEBHOOK_SECRET` still empty → webhook rejects.
- **Steps:** `POST /api/razorpay/webhook` with a bogus `x-razorpay-signature`.
- **Expect:** `401 Invalid signature`.
- **Result:** ☐

### TC-WH-02 · Webhook idempotency (after secret is set) — *manual/advanced*
- **Pre:** Set `RAZORPAY_WEBHOOK_SECRET` in `.env` + restart; configure webhook in Razorpay dashboard (or replay locally-signed payloads).
- **Steps:** Deliver `payment.captured` for a pending order; redeliver the **same** event id.
- **Expect:** First grants access / marks PAID; replay is a no-op (deduped via `tq_webhook_events`), no duplicate grant.
- **Result:** ☐ (☐ N/A until secret set)

---

# Cross-cutting / regression

### TC-X-01 · Mobile responsive (360×640)
- **Steps:** DevTools device mode → owner dashboard (hamburger), `/admin/*` (drawer not pinned), attempt page (sticky "Questions N/M" → bottom-sheet palette).
- **Expect:** No horizontal scroll; tap targets ≥44px.
- **Result:** ☐

### TC-X-02 · Schema-change sanity
- **Expect:** No `PrismaClientKnownRequestError` (legacy column mismatch) anywhere; if seen, tail dev console for the column.
- **Result:** ☐

### TC-X-03 · Help page
- **Steps:** `/help` → search "billing"/"trial"/"OTP" → expand FAQ.
- **Expect:** Live filter; mailto at bottom.
- **Result:** ☐

---

## Suggested run order (fastest path to full coverage)

1. **Staff seeds fixtures** → TC-STAFF-04 (bundle) + TC-STAFF-05 (coupons) so B2C payment cases are unblocked.
2. **B2C payment block** → TC-B2C-02 / 02b / 02c / 02d / 03 / 04 / 05 (the Razorpay heart).
3. **Owner core + payment** → TC-OWN-01…10 (incl. the plan-upgrade payment).
4. **Team/roles** → ADM, TCH, STU, PAR.
5. **Staff confirm money** → TC-STAFF-06.
6. **Cross-cutting** → TC-X / TC-WH.

> Pass/fail log: copy this file or track results in a sheet. Reset between destructive runs with `npm run seed:coaching`.

---
---

# PRODUCT 1 — Testquest Standalone (B2C self-serve, "anyone can register")

> The public consumer product. Full chain: **Admin builds the catalog → student registers → browses → buys → takes the test → sees results.** Content has to exist before anyone can take a test, so the admin supply chain is documented first.

## 1.0 Admin content supply chain (build the catalog before anyone can buy/take)

> All admin content writes go to **legacy tables** (shared with the mobile app). Login: `/admin/login` (`admin@testquest.in` / `admin123`). Order matters: **Class → Subject → Question → Test → Bundle → Coupon**. Soft delete = `status=0`/`isActive=false`.

### TC-ADMIN-CLS-01 · Create a class
- **Page:** `/admin/classes` → **API:** `POST /api/admin/taxonomy/classes` `{name, sortOrder?}` (name 1–100).
- **Steps:** Add class "QA Test Class" → save.
- **Expect:** 201; appears in list with `_count.subjects=0`. Writes to legacy `catigories`. Edit + soft-delete via `/classes/[id]`.
- **Result:** ☐

### TC-ADMIN-SUB-01 · Create a subject under a class
- **Page:** `/admin/subjects` → **API:** `POST /api/admin/taxonomy/subjects` `{classId, name, sortOrder?}`.
- **Steps:** Pick the new class → add subject "QA Physics" → save. Filter subjects by `?classId=`.
- **Expect:** 201; subject linked to class; `_count.tests=0`. Invalid classId → fails.
- **Result:** ☐

### TC-ADMIN-Q-01 · Create a SINGLE_MCQ question
- **Page:** `/admin/questions` → **New question** → **API:** `POST /api/admin/questions`.
- **Fields/rules:** `subjectId`, `type` (SINGLE_MCQ/MULTI_MCQ/FILL_IN_BLANK), `difficulty` (EASY/MEDIUM/HARD, default MEDIUM), `text`, `marks` (default 1), `options[]` (label/text/isCorrect), `correctText` (FILL only).
- **Steps:** subject = QA Physics, type SINGLE_MCQ, text, 4 options with **exactly 1** correct → save.
- **Expect:** 201; row shows badges (subject/difficulty/type/options). Writes to legacy `question` + `question_description` + options/paragraph tables.
- **Result:** ☐

### TC-ADMIN-Q-02 · Question validation rules (each refine)
- **Steps (expect 400 each):**
  - SINGLE_MCQ with 0 or 2 correct → "SINGLE_MCQ must have exactly 1 correct option."
  - MULTI_MCQ with 0 correct → "MULTI_MCQ must have at least 1 correct option."
  - MCQ with <2 options → "MCQ questions require at least 2 options."
  - FILL_IN_BLANK without `correctText` → "correctText is required for FILL_IN_BLANK."
- **Expect:** Each rejected with the plain-English message (S1).
- **Result:** ☐

### TC-ADMIN-Q-03 · Create MULTI_MCQ + FILL_IN_BLANK
- **Steps:** One MULTI_MCQ (≥1 correct, multiple allowed); one FILL_IN_BLANK with `correctText`.
- **Expect:** Both 201. (⚠️ Known limitation: FILL_IN_BLANK answers are currently counted but graded as wrong against position-based legacy `correct_answer` — note for grading TC-ATT-07.)
- **Result:** ☐

### TC-ADMIN-Q-04 · ⚠️ Excel bulk import is DISABLED
- **Page:** `/admin/questions` → Import → **API:** `POST /api/admin/questions/import`.
- **Expect:** Returns **503** "Excel import is being rewired to the legacy schema. Use the New question dialog meanwhile." Template download (`/template`) may still work.
- **Result:** ☐ (documents current state — not a bug)

### TC-ADMIN-Q-05 · List filters + search
- **Steps:** `/admin/questions?subjectId=&type=&difficulty=&search=` → use filter chips + search box.
- **Expect:** List filters correctly; pagination works (limit ≤50).
- **Result:** ☐

### TC-ADMIN-TEST-01 · Create a test from picked questions
- **Page:** `/admin/tests` → New → **API:** `POST /api/admin/tests`.
- **Fields:** `classId`, `subjectId`, `name`, `durationMinutes`, `isFree` (def false), `price` (def 0), `isPractice` (def false), `randomizeQuestions/Options` (def true), `retakeCooldownDays`, `questionIds[]` (≥1).
- **Steps:** Build a **paid** test (isFree false, price 199) with ≥3 question ids → save.
- **Expect:** 201; appears in `/admin/tests` with question + attempt counts. Writes to legacy `main_exam` + `main_exam_description` + `main_exam_to_question`.
- **Result:** ☐

### TC-ADMIN-TEST-02 · Invalid question ids rejected
- **Steps:** `POST /api/admin/tests` with a non-existent questionId.
- **Expect:** **422** "Questions not found: …".
- **Result:** ☐

### TC-ADMIN-TEST-03 · Create a FREE test + a PRACTICE test
- **Steps:** One `isFree:true price:0`; one `isPractice:true` (exposed id offset by **+1,000,000**).
- **Expect:** Free test = no paywall later; practice id is in the 1M range.
- **Result:** ☐

### TC-ADMIN-TEST-04 · Edit a test's question set
- **API:** `PUT /api/admin/tests/[id]/questions` `{questionIds[]}`.
- **Steps:** Replace the question list on an existing test.
- **Expect:** 200; bad test id → 404; bad question id → 422; legacy `main_exam_to_question` rewritten.
- **Result:** ☐

### TC-ADMIN-BUNDLE-01 · Create a bundle (unblocks TC-B2C-03)
- **Page:** `/admin/bundles` → **API:** `POST /api/admin/bundles` `{name, price>0, validityDays>0, classId?, testIds[]≥1}`.
- **Steps:** Bundle "QA Bundle" with 2 tests, price 299, validity 90 → save.
- **Expect:** 201; bad testId → 422. Usable at `/checkout?type=BUNDLE&id=<id>`.
- **Result:** ☐

### TC-ADMIN-COUPON-01 · Create coupons (unblocks TC-B2C-04/05)
- **Page:** `/admin/coupons` → **API:** `POST /api/admin/coupons`.
- **Fields:** `code` (upper-cased), `discountType` PERCENTAGE/FLAT, `discountValue>0`, `maxDiscountCap?`, `minOrderValue` (def 0), `scope` ALL/BUNDLE_ONLY/FIRST_TIME, `bundleId?`, `totalUsageLimit?`, `perUserLimit` (def 1), `validFrom`, `validUntil`.
- **Steps:** Create (a) `QA100` PERCENTAGE 100 (→ free grant) and (b) `QA100FLAT` FLAT 100 (→ ₹100 off).
- **Expect:** Both 201; validate via `/api/coupons/validate`; scope/limits enforced at checkout (see TC-B2C-04/05).
- **Result:** ☐

### TC-ADMIN-MASTER-02 · Soft delete & isActive gating
- **Steps:** Soft-delete a question/test (`status=0` / `isActive=false`) → confirm it disappears from `/tests` browse and the builder, but historical attempts remain.
- **Expect:** Soft delete hides from catalog without breaking history.
- **Result:** ☐

## 1.1 Registration

**Page:** `/signup` → **API:** `POST /api/auth/signup`
**Fields & rules** (from `signupSchema`):

| Field | Rule | UI |
|---|---|---|
| `name` | required, 2–200 chars | "Full name" |
| `email` | required, valid email, ≤200 | "Email" |
| `mobile` | **optional**, 10–20 chars | "Mobile (optional)" |
| `password` | required, 6–100 | "Password", `minLength=6` |
| `classId` | required, positive int, must exist in `vw_classes` & active | "Class" dropdown (populated from `/api/taxonomy`) |
| `board` | required enum `CBSE` / `ICSE` / `State` | "Board" dropdown |

### TC-REG-B2C-01 · Happy path registration
- **Steps:** `/signup` → fill all fields with a fresh email → pick a Class + Board → **Create free account**.
- **Expect:** HTTP **201**; `token` httpOnly cookie set; auto-redirect to `/tests`; `/api/auth/me` → `role:"student"`, `displayRole:"student"`, `class:{id,name}`, `org:null`, `needsProfile:false`.
- **DB check:** new `student` row with bcrypt `password`, `status=1`, correct class/board.
- **Result:** ☐

### TC-REG-B2C-02 · Duplicate email
- **Steps:** Register again with an email that already exists.
- **Expect:** HTTP **409** "Email already registered." No second row created.
- **Result:** ☐

### TC-REG-B2C-03 · Invalid / inactive class
- **Steps:** `POST /api/auth/signup` with `classId: 999999`.
- **Expect:** HTTP **422** "Invalid class."
- **Result:** ☐

### TC-REG-B2C-04 · Field validation (each rule)
- **Steps (try each):** name `"A"` (too short) · bad email `"abc"` · password `"123"` (too short) · missing board.
- **Expect:** Plain-English 400 per field (S1 fix), e.g. "Name must be at least 2 characters.", "Password must be at least 6 characters." Client also blocks before submit (`required`, `minLength`).
- **Result:** ☐

### TC-REG-B2C-05 · Registration WITHOUT mobile (optional field)
- **Steps:** Register leaving mobile blank.
- **Expect:** Succeeds (201). Student exists with empty `mobile_no`. (Note: such a student can't use mobile-OTP login later — covered in TC-REG-B2C-08.)
- **Result:** ☐

### TC-REG-B2C-06 · Sign out / sign back in (email+password)
- **Steps:** Sign out → `/login` → same email+password.
- **Expect:** Lands on `/tests`; session restored.
- **Result:** ☐

### TC-REG-B2C-07 · Google sign-in (if `GOOGLE_CLIENT_ID` configured)
- **Pre:** `.env` Google keys present (currently empty → mark **N/A**).
- **Steps:** `/login` → "Continue with Google".
- **Expect:** OAuth round-trip → student row created/linked → `/tests`.
- **Result:** ☐ (☐ N/A — keys empty)

### TC-REG-B2C-08 · Forgot / reset password
- **Steps:** `/forgot-password` → enter registered email → submit. Watch dev console for the `[email-stub]` reset link. Open `/reset-password?token=…` → set a new password → sign in with it.
- **Expect:** Reset email logged; token works once; new password authenticates; old one rejected.
- **Result:** ☐

## 1.2 Browse & purchase (consumer commerce)

### TC-SHOP-B2C-01 · Browse catalog (free vs paid)
- **Steps:** `/tests` → observe free tests (48/49/51) show "Free"/"Start", paid test **92 (₹499)** shows price + Buy.
- **Expect:** Catalog renders; free vs paid clearly distinguished; `/tests/[id]` detail loads.
- **Result:** ☐

### TC-SHOP-B2C-02 · 💳 Buy paid test (Razorpay) — see TC-B2C-02 for the full payment + edge matrix
- **Quick path:** `/checkout?type=TEST&id=92` → Pay ₹499 → test card → Success → `/checkout/success` → access granted.
- **Result:** ☐

### TC-SHOP-B2C-03 · Take a free test end-to-end
- **Steps:** `/tests` → test 48 → Start → answer questions → Submit → result.
- **Expect:** Attempt recorded; score shown; visible in `/my-attempts`.
- **Result:** ☐

### TC-SHOP-B2C-04 · Take a purchased test
- **Pre:** TC-SHOP-B2C-02 done.
- **Steps:** Open test 92 → Start → submit.
- **Expect:** No paywall (already owned); attempt + result recorded.
- **Result:** ☐

### TC-SHOP-B2C-05 · Profile & history
- **Steps:** `/profile` edit name/class → save. `/my-attempts` review list. `/dashboard` shows personal stats.
- **Expect:** Persist + correct lists.
- **Result:** ☐

### TC-SHOP-B2C-06 · B2C cannot reach coaching/admin
- **Steps:** Navigate to `/coaching/dashboard` and `/admin`.
- **Expect:** Redirected away (no access).
- **Result:** ☐

## 1.3 Test-attempt lifecycle (start → answer → pause → resume → submit → result)

> The heart of the product. APIs: `POST /api/attempts` (start), `GET/POST /api/attempts/[id]`, `POST .../answer`, `.../pause`, `.../resume`, `.../submit`, `GET .../result`. Writes to legacy `main_exam_status` (status 1=in-progress, 2=completed) + `main_exam_result` (result 1=correct/2=wrong/0=unanswered). UI: `/attempts/[id]`.

### TC-ATT-01 · Start an attempt (access gating)
- **Steps:** As a student who **owns** test 92 (or any free test) → open it → **Start**.
- **Expect:** 201 with `attemptId`, `testName`, `durationMinutes`, `isPractice`, `totalMarks`, `questionIds[]`, `startedAt`. `main_exam_status` row status=1.
- **Gating:** Paid test WITHOUT access → **403** "You don't have access to this test." Test with no questions → **400** "This test has no questions yet." Inactive test → 404.
- **Result:** ☐

### TC-ATT-02 · Load attempt state
- **API:** `GET /api/attempts/[id]`.
- **Steps:** Open the running attempt page.
- **Expect:** Returns questions + options + any saved answers + remaining time. Another student's attempt id → **404** (ownership enforced).
- **Result:** ☐

### TC-ATT-03 · Answer a SINGLE_MCQ
- **API:** `POST /api/attempts/[id]/answer` `{questionId, selectedOptionId}`.
- **Steps:** Pick an option → it saves.
- **Expect:** `{saved:true}`; option id resolved to 1-based position and stored in `main_exam_result`. Re-answering overwrites.
- **Result:** ☐

### TC-ATT-04 · Answer a MULTI_MCQ
- **API:** `POST .../answer` `{questionId, selectedOptionIds:[…]}`.
- **Expect:** All selected positions stored; deselecting + re-saving updates.
- **Result:** ☐

### TC-ATT-05 · Answer a FILL_IN_BLANK
- **API:** `POST .../answer` `{questionId, fillAnswer:"…"}`.
- **Expect:** `{saved:true}`; attempt counted. (⚠️ Known: graded as wrong vs position-based legacy answer — flagged in code; verify it doesn't crash, not that it scores correct.)
- **Result:** ☐

### TC-ATT-06 · Pause & resume
- **APIs:** `POST .../pause` then `POST .../resume`.
- **Steps:** Mid-attempt pause (e.g. navigate away / explicit pause) → return → resume.
- **Expect:** Timer + saved answers preserved; status stays in-progress. Re-starting the same test resumes the active attempt (`resumed:true`) rather than creating a duplicate.
- **Result:** ☐

### TC-ATT-07 · Submit & auto-grade
- **API:** `POST /api/attempts/[id]/submit`.
- **Steps:** Answer a few, submit.
- **Expect:** `{submitted:true, status:"COMPLETED", score, totalMarks, percentage, timeSpentSeconds}`. `main_exam_status.status=2`; results graded (1/2/0 per question). Double-submit → **400** "Already submitted."
- **Result:** ☐

### TC-ATT-08 · Result page
- **API:** `GET /api/attempts/[id]/result` → UI `/attempts/[id]/result`.
- **Expect:** Score, percentage, per-question correct/wrong/unanswered, explanations (on paid tests), time spent. Appears in `/my-attempts`.
- **Result:** ☐

### TC-ATT-09 · Retake cooldown (if set)
- **Pre:** A test with `retakeCooldownDays>0`, already attempted.
- **Steps:** Try to start again within the window.
- **Expect:** Blocked/“available in N days” per cooldown.
- **Result:** ☐

### TC-ATT-10 · Practice vs main exam id offset
- **Steps:** Attempt a practice test (id in +1,000,000 range).
- **Expect:** Routes correctly; result stored under the right underlying exam id (decodeTestId handles the offset).
- **Result:** ☐

---
---

# PRODUCT 2 — Coaching Centre (full lifecycle)

> The B2B product: a centre owner self-registers, runs a 5-step setup wizard, builds batches/tests, invites teachers & students, sends reports, pays/upgrades. This section walks the **entire lifecycle in order**.

## 2.1 Self-serve owner registration

**Page:** `/coaching/signup` → **API:** `POST /api/coaching/signup`
**Fields & rules** (from `signupSchema`):

| Field | Rule |
|---|---|
| `centreName` | required, 2–300 |
| `ownerName` | required, 2–200 |
| `city` | required, 1–100 |
| `mobile` | required, 10–20 |
| `email` | required, valid, ≤200 |
| `password` | required, 6–100 |
| `expectedStudents` | required, int 1–10,000 (sizes trial seats, rounded **up to nearest 10, min 10**) |
| `includeSampleData` | optional, default **true** |

### TC-REG-CC-01 · Happy path centre signup
- **Steps:** `/coaching/signup` → fill all fields (fresh email), e.g. expectedStudents `60` → **Start trial**.
- **Expect:** HTTP **201**; JWT cookie carries `orgId` + `orgRole=OWNER`; auto-redirect to **`/coaching/setup`** (the wizard, not the dashboard).
- **DB check:** new `student` (owner, `classId=null`), `tq_organizations` (type=COACHING_CENTRE, city set, ownerUserId), `tq_org_memberships` (role=OWNER), `tq_subscriptions` (status=TRIAL, plan=Starter, `seatsPurchased=60`, expires +14 days).
- **Result:** ☐

### TC-REG-CC-02 · Seat rounding
- **Steps:** Sign up with expectedStudents `61`.
- **Expect:** `seatsPurchased=70` (rounded up to nearest 10). Try `5` → `10` (min). Try `200` → `200`.
- **Result:** ☐

### TC-REG-CC-03 · Duplicate email
- **Steps:** Sign up with an email already used (B2C or centre).
- **Expect:** HTTP **409** "Email already registered"; email field focuses; no org created.
- **Result:** ☐

### TC-REG-CC-04 · Field validation (client + server)
- **Steps:** Try each: centreName `"A"`, mobile `"123"`, bad email, password `"12345"`, expectedStudents `0` and `99999`.
- **Expect:** Client blocks first (inline chip + focuses failing field); server mirrors with 400. expectedStudents must be 1–10,000.
- **Result:** ☐

### TC-REG-CC-05 · Sample data toggle
- **Steps (A):** Default signup (includeSampleData true) → after wizard, dashboard shows **Sample data banner** (1 demo batch, 10 students, 1 assignment).
- **Steps (B):** `POST /api/coaching/signup` with `includeSampleData:false` → no demo data.
- **Expect:** Both behave as described; seed is fire-and-forget (signup response doesn't block on it).
- **Result:** ☐

### TC-REG-CC-06 · Wrong-product login guard
- **Steps:** Take centre-owner creds → try `/login` (B2C) and `/admin/login`.
- **Expect:** B2C login authenticates the underlying student but lands per role rules; admin login rejects (not a `tq_admins` row).
- **Result:** ☐

## 2.2 First-run setup wizard (5 steps)

**Page:** `/coaching/setup` → **API:** `POST /api/coaching/setup/[step]` (OWNER/ADMIN only). Progress persists in `brandingJson.setupProgress` so a refresh resumes the same step.

### TC-WIZ-01 · Step 1 — Branding
- **Steps:** Enter display name, city, pick a primary color, optionally upload a logo (`/api/coaching/setup/logo`) → **Save & continue**.
- **Expect:** `Organization.name`/`city`/`logoUrl` + `brandingJson.primaryColor` updated; advances to step 2; `setupProgress.currentStep=2`, `completedSteps=[1]`.
- **Edge:** Oversized/invalid logo → "Couldn't upload that logo. Try a smaller image."
- **Result:** ☐

### TC-WIZ-02 · Step 2 — Boards & classes
- **Steps:** Select ≥1 board and ≥1 class → continue.
- **Expect:** classIds validated against `vw_classes` (active). Invalid id → **422** "Invalid classId(s): …". Advances to step 3.
- **Edge:** zero classes selected → Next disabled (client validity).
- **Result:** ☐

### TC-WIZ-03 · Step 3 — First batch
- **Steps:** Name the batch, pick a class (only those chosen in step 2 appear), board, ≥1 subject → continue.
- **Expect:** `tq_batches` row created; `batchId` pinned to draft for step 4; advances to step 4.
- **Result:** ☐

### TC-WIZ-04 · Step 4 — Invite students (3 modes)
- **Mode link:** choose "Share link" → returns `/coaching/join/<token>` (valid ~30 days). Copy it for TC-JOIN-01.
- **Mode roster:** paste up to 50 rows (name + mobile [+email]) → returns enrolled count.
- **Mode skip:** continue with nothing.
- **Expect:** Each mode advances to step 5; link mode shows a share card; roster mode shows "N added".
- **Edge:** roster mode with empty roster → 400 "Roster is empty".
- **Result:** ☐

### TC-WIZ-05 · Step 5 — Done / finalize
- **Steps:** Review summary → finish.
- **Expect:** `POST .../done` clears `setupProgress`; redirect to `/coaching/dashboard`; dashboard no longer bounces back to setup.
- **Result:** ☐

### TC-WIZ-06 · Resume mid-wizard (refresh safety)
- **Steps:** Complete steps 1–2, then hard-refresh `/coaching/setup`.
- **Expect:** Wizard resumes at step 3 (driven by `setupProgress.currentStep`), prior data intact.
- **Watch:** If a signup bails mid-wizard, the dashboard keeps redirecting to setup until `done` or `clearSetupProgress(orgId)`.
- **Result:** ☐

## 2.3 Student self-join (the link from Step 4 / team)

**Landing:** `/coaching/join/[token]` → **APIs:** `GET /api/coaching/join/[token]` (public), `POST .../otp`, `POST .../verify`.

### TC-JOIN-01 · Resolve a valid invite link
- **Steps:** Open the join URL from TC-WIZ-04 in an incognito window.
- **Expect:** Landing shows centre name + logo + batch name (no auth needed).
- **Result:** ☐

### TC-JOIN-02 · Join via mobile OTP (no password)
- **Steps:** Enter mobile → request OTP → read dev OTP → verify.
- **Expect:** Student row created or matched by mobile; enrolled in the batch + org membership (STUDENT); JWT issued; lands on `/tests` with **org branding**.
- **DB check:** `tq_batch_enrollments` active row; `tq_org_memberships` STUDENT row.
- **Result:** ☐

### TC-JOIN-03 · Expired / unknown link
- **Steps:** Hit `/api/coaching/join/<garbage>` and an expired token.
- **Expect:** **404** unknown, **410** expired, with friendly landing copy.
- **Result:** ☐

## 2.4 Centre content + assignment lifecycle (detailed)

> The centre's own content chain runs **parallel to** the Testquest master catalog: a centre can build private tests from the Testquest bank + its own imported questions, then assign them to batches. Org tests are hidden from B2C `/tests` and other orgs (`tq_org_tests`). All these require an OWNER/ADMIN (some TEACHER) session.

### TC-CCQ-01 · Import own question bank (xlsx) — ENABLED (unlike admin's)
- **Page:** `/coaching/questions` → Import → **API:** `POST /api/coaching/questions/import` (multipart, field `file`).
- **Steps:** Download template → fill 5–10 rows incl. 1 broken row → upload.
- **Expect:** `{imported, skipped, errors[]}`; per-row errors don't abort; imported rows carry `YOUR BANK` source. Empty file → 400 "That file is empty."; >5MB → 413; non-xlsx → 400.
- **Result:** ☐

### TC-CCQ-02 · Browse merged question bank
- **API:** `GET /api/coaching/questions` + `/search`.
- **Steps:** In the test builder, toggle **All sources / Testquest bank / Your bank**.
- **Expect:** "All" shows both; "Your bank" shows only imported (empty state if none).
- **Result:** ☐

### TC-CCT-01 · Build a custom org test
- **Page:** `/coaching/tests/new` → **API:** `POST /api/coaching/tests`.
- **Fields/rules:** `name` 3–300, `classId`, `subjectId`, `durationMinutes` 5–360, `passingPercentage?` 0–100, `questionIds[]` 1–200.
- **Steps:** Pick class/subject, tick 3–5 questions (mix sources), name it, set duration + passing % → **Save test**.
- **Expect:** 201; appears in `/coaching/tests`; writes legacy `main_exam*` + a `tq_org_tests` row (privacy). Roles OWNER/ADMIN/**TEACHER** allowed.
- **Edges:** name <3 chars → 400; 0 questions → Save disabled / 400; >200 questions → 400.
- **Result:** ☐

### TC-CCT-02 · Org test privacy
- **Steps:** As a B2C student browse `/tests`; as a **different** org's owner open the assign picker.
- **Expect:** The org test does NOT appear in either — only inside the owning org.
- **Result:** ☐

### TC-CCA-01 · Create an assignment (single batch)
- **Page:** `/coaching/batches/[id]/assign` → **API:** `POST /api/coaching/assignments`.
- **Fields:** `batchId`, `testId`, `title?`, `instructions?` (≤2000), `dueAt?` (ISO), `notify[]` = sms/email (default both).
- **Steps:** Pick a test, set due date + channels → Assign.
- **Expect:** 201 with `{assigned N students, M sms, L emails}`; assignment shows on batch's Assignments tab; students get notifications (dev stubs log).
- **Guards:** batch not in caller's org → 404; **subscription GRACE/EXPIRED → 402** "Trial ended/Subscription expired. Upgrade to assign…".
- **Result:** ☐

### TC-CCA-02 · Bulk assign to multiple batches
- **API:** `POST /api/coaching/assignments/bulk` (UI: "Also assign to" on the assign page).
- **Steps:** Tick several batches → Assign to N batches.
- **Expect:** One assignment per batch; partial failure surfaces a per-batch error list; redirect to dashboard.
- **Result:** ☐

### TC-CCA-03 · Student receives + takes the assignment
- **APIs:** `GET /api/student/assignments`, then attempt via `POST /api/attempts {testId, assignmentId}`.
- **Steps:** As an enrolled student → "Assigned to me" → open → take → submit.
- **Expect:** Assignment listed; starting it links `tq_assignment_attempts` (so owner sees who started/finished); submit marks the mapping `completedAt`. (Full attempt mechanics = TC-ATT-01…08.)
- **Result:** ☐

### TC-CCA-04 · Monitor assignment results
- **APIs:** `GET /api/coaching/assignments/[id]`, `/results`.
- **Steps:** Owner opens the assignment → results view.
- **Expect:** Per-student status (not started / in progress / completed + score); reflects real attempts.
- **Result:** ☐

### TC-CCA-05 · Remind non-starters
- **API:** `POST /api/coaching/assignments/[id]/remind`.
- **Steps:** Send a reminder to students who haven't started.
- **Expect:** Only non-starters targeted; notification stubs log; counts returned.
- **Result:** ☐

### TC-CCA-06 · Edit / deactivate an assignment
- **API:** `PATCH/DELETE /api/coaching/assignments/[id]`.
- **Expect:** Edits persist; deactivation hides it from students (`isActive=false`) without deleting attempt history.
- **Result:** ☐

> Remaining operations reuse owner/role cases — run in lifecycle order:

| Step | Test case |
|---|---|
| Create more batches / bulk CSV import | TC-OWN-06, TC-OWN-07 |
| Invite teacher/admin + roles | TC-OWN-12, TC-ADM-*, TC-TCH-* |
| Parent reports + bulk reminders | TC-OWN-09 |
| White-label branding | TC-OWN-11 |
| Branding reaches students | TC-STU-04 |
| Student transfer between batches | TC-OWN-14 |

## 2.5 Centre billing lifecycle (trial → paid → renew → lapse)

### TC-CCBILL-01 · Trial state
- **Steps:** New trial org dashboard + `/coaching/billing`.
- **Expect:** Banner "Starter trial · N days left"; can assign/create; branding editable with "previewing during trial" notice.
- **Result:** ☐

### TC-CCBILL-02 · 💳 Convert trial → paid (one-time) — see TC-OWN-10
- **Expect:** After payment, `tq_subscriptions.status=ACTIVE`, `expiresAt` extended, `tq_orders` ORG_SUB PAID.
- **Result:** ☐

### TC-CCBILL-03 · Grace + expiry (time-driven)
- **Steps:** To simulate: set a sub's `expiresAt` to the past via DB, reload an owner page.
  - `expiresAt` < now → **GRACE** (banner "New assignments paused"; `canAssign=false`).
  - `expiresAt` < now−7d → **EXPIRED** (hard lockout; read-only; "Subscription expired. Contact support.").
- **Expect:** `resolveSubscriptionState` transitions the row in place on next request; banners + gating match.
- **Result:** ☐

### TC-CCBILL-04 · Recurring auto-renew mandate (UI wired; activation needs webhook secret)
> **Status:** Backend (`/api/coaching/billing/subscribe` + `/subscription` + webhook `subscription.*`) AND the billing-page UI are now wired (Task 4.1). The `/coaching/billing` page shows two paths: **"Pay once"** (existing one-time) and an **"Or set up auto-renew"** section with a **Monthly/Quarterly/Annual** cycle picker + **"Subscribe & auto-renew"** button. `RAZORPAY_WEBHOOK_SECRET` is still empty, so the mandate is created and authorised in-browser but the final ACTIVE flip arrives via webhook only once that secret + dashboard webhook are configured.

#### TC-CCBILL-04a · Subscribe button → Razorpay subscription modal (clickable)
- **Pre:** Owner logged in; a non-free plan (Growth/Pro) selected.
- **Steps:** `/coaching/billing` → pick **Growth/Pro** → in "Or set up auto-renew" choose a cycle (e.g. **Monthly**) → click **Subscribe & auto-renew**.
- **Expect:** Razorpay modal opens in **subscription mode** (driven by `subscription_id`, not `order_id`). `POST /api/coaching/billing/subscribe` returned `{razorpaySubscriptionId, shortUrl, razorpayKeyId}`.
- **DB check:** `tq_subscriptions` row gets `razorpaySubscriptionId`, `razorpayCustomerId`, `razorpayMeta`, `autoRenew=true`, `billingCycle` = chosen cycle.
- **Edges:** Free plan (Starter ₹0) → button disabled. Dismiss modal → button resets, no error. Existing active mandate → 409 "An active auto-renew mandate already exists."
- **Result:** ☐

#### TC-CCBILL-04b · Authorise mandate (test card)
- **Steps:** In the modal, authorise with the Razorpay test card → success.
- **Expect:** Modal closes; page shows pending notice "Auto-renew set up. Your plan activates as soon as the first payment is confirmed." then reloads.
- **Note:** Sub does **not** flip to ACTIVE yet without the webhook (see 04c).
- **Result:** ☐

#### TC-CCBILL-04c · Webhook activates the subscription — ☐ N/A until webhook secret set
- **Pre:** `RAZORPAY_WEBHOOK_SECRET` populated + webhook registered in the Razorpay dashboard (or replay locally-signed `subscription.authenticated` → `subscription.charged`).
- **Expect:** On `subscription.authenticated`/`charged`: sub → **ACTIVE**, `expiresAt` extended by the cycle's days (≈30/90/365), a `tq_orders` ledger row written. Replaying the same event id → no duplicate (idempotent via `tq_webhook_events`). `subscription.pending` → GRACE; `halted` → EXPIRED; `cancelled` → CANCELLED.
- **Result:** ☐ (N/A until secret set)

#### TC-CCBILL-04d · Subscription status + cancel
- **APIs:** `GET /api/coaching/billing/subscription` (status + `hasMandate` + `mandateStatus`); `DELETE` (cancel at cycle end; `?immediate=1` to cancel now).
- **Expect:** GET reflects mandate state; DELETE cancels the Razorpay mandate (local status flip arrives via the `subscription.cancelled` webhook).
- **Result:** ☐

## 2.6 Sales-led centre onboarding (alternative to self-serve)

> Same product, different entry. Detailed in TC-STAFF-02 + TC-OWN flow. Summary:

### TC-CCSALES-01 · Staff creates org → owner sets password → setup
- **Steps:** Staff `/admin/organizations` → Onboard centre → copy welcome URL → owner opens `/coaching/welcome/[token]` → sets password → lands on `/coaching/setup`.
- **Expect:** Identical post-onboarding experience to self-serve; `salesJson.onboardingPath` marks it sales-led; "Resend welcome" until accepted (then 409).
- **Result:** ☐

---

## Coverage map (which doc section covers what)

| Area | Section |
|---|---|
| **Admin content supply chain** (class→subject→question→test→bundle→coupon) | **Product 1 §1.0** (TC-ADMIN-*) |
| Anyone-can-register (B2C) | **Product 1 §1.1–1.2** (TC-REG-B2C-*, TC-SHOP-B2C-*) + Persona B |
| **Test-attempt lifecycle** (start→answer→pause→resume→submit→result) | **Product 1 §1.3** (TC-ATT-*) |
| Centre self-serve signup + wizard | **Product 2 §2.1–2.2** (TC-REG-CC-*, TC-WIZ-*) |
| Student join-by-link | **Product 2 §2.3** (TC-JOIN-*) |
| **Centre content + assignment lifecycle** (import→build test→assign→monitor→remind) | **Product 2 §2.4** (TC-CCQ-*, TC-CCT-*, TC-CCA-*) |
| Centre billing | **Product 2 §2.5** (TC-CCBILL-*) |
| Sales-led | **Product 2 §2.6** + Persona H |
| Razorpay payments | TC-B2C-02*, TC-OWN-10, TC-CCBILL-*, TC-WH-* |

## Known states / gaps surfaced while writing (not bugs to fix here)
- **Admin xlsx question import is DISABLED** → returns 503 (TC-ADMIN-Q-04). Use the New-question dialog.
- **Centre xlsx question import IS enabled** (TC-CCQ-01) — different code path.
- **FILL_IN_BLANK grading** counts the attempt but grades as wrong vs legacy position-based answers (TC-ADMIN-Q-03, TC-ATT-05).
- **0 bundles / 0 coupons seeded** — run TC-ADMIN-BUNDLE-01 + TC-ADMIN-COUPON-01 first to unblock B2C commerce edges.
- **Google OAuth** N/A (empty keys). **Recurring auto-renew** backend-only (no button + empty webhook secret).
- **Assignment creation is subscription-gated** — GRACE/EXPIRED orgs get 402 (TC-CCA-01).
</content>
