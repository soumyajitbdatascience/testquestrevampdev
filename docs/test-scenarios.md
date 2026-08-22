# Manual test scenarios — coaching MVP

Use these to validate the user journeys for what shipped this session. Each
scenario has preconditions, steps, expected outcomes, and "watch for" notes.

## Demo credentials

| Role | Email | Password | Mobile | Notes |
|---|---|---|---|---|
| Centre owner (Sunrise) | `demo-owner@testquest.local` | `demo1234` | `9876512345` | Org 1, batch 1 |
| Centre owner (Acme — sales-led) | `rahul.acme@example.com` | `rahul123` | — | Org 7 |
| Testquest staff (admin) | `admin@testquest.in` | `admin123` | — | `/admin/login` |

Dev OTPs are echoed on screen during the mobile-OTP flow.

Reset state with `npm run seed:coaching` (re-creates Sunrise from scratch).

---

# Journey 1 — Centre owner first login & dashboard tour

**Goal:** Owner signs in, sees their centre's state, finds their way around.

### Steps
1. Visit `/coaching/login`.
2. Sign in with **email/password** tab using Sunrise owner creds.
3. Land on `/coaching/dashboard`.

### Expected
- Greeting line with time-of-day ("Good morning/afternoon/evening, Demo").
- Org name "Sunrise Coaching Centre" + Pune.
- Stat tiles: Students (5), Active batches (≥1), Assigned this week, Avg score.
- Trial banner: "Starter trial · N days left".
- Header links visible: Tests · Questions · Team · Settings · Branches · Help.
- "Sign out" button top-right.
- Onboarding tooltip may appear if `brandingJson.onboardingDismissed` is false.

### Watch for
- Stat tiles loading without errors (5.1 F1 fix — if you see PrismaClientKnownRequestError, an SQL column name is still wrong).
- "Recent activity" panel shows last 10 attempts OR empty state with explanation.

---

# Journey 2 — Mobile OTP sign-in

**Goal:** Owner who forgot their password signs in via mobile.

### Preconditions
- Sign out first (or use an incognito window).

### Steps
1. Visit `/coaching/login`.
2. Click the **Mobile + OTP** tab.
3. Enter mobile `9876512345`. Click **Send code**.
4. The dev OTP echoes on screen (`Dev: 123456`-style). Note it.
5. Enter the code. Click **Sign in**.

### Expected
- After Send: page transitions to OTP-input stage with chip "Code sent to 9876512345 · Sunrise Coaching Centre".
- After Sign in: lands on `/coaching/dashboard`.

### Edge cases to test
- **Bad mobile** (e.g. `1234567890`): should return "No Testquest account found for this mobile. Sign up first or ask your centre owner for an invite."
- **Wrong code**: "That code didn't match. Try again." Attempts counter increments.
- **5 wrong attempts**: "Too many wrong attempts. Request a new code."
- **Resend cooldown**: 30s timer; button shows "Resend in 28s".

---

# Journey 3 — Build a custom test (Testquest + own bank mix)

**Goal:** Owner curates a test from picked questions and saves it.

### Steps
1. From dashboard → **Tests** → "+ Create test" (or `/coaching/tests/new`).
2. Select a class (e.g. "JEE MAINS").
3. Click subject chips to filter (optional).
4. Try the **All sources / Testquest bank / Your bank** toggle above filters.
5. Tick 3–5 questions. Click **Preview** on one to expand options + correct answer inline.
6. On the right panel: name the test (e.g. "Sample diagnostic"), set duration, passing %.
7. Click **Save test**.

### Expected
- Each question row shows badges: Subject · Difficulty · Type · N options · `TESTQUEST` or `YOUR BANK`.
- Selecting a question highlights the row + increments "N selected" in the right panel.
- Right panel auto-pins the subject from the first picked question.
- After save: redirects to `/coaching/tests` with the new test in the list.

### Edge cases
- **Mixed subjects**: pick questions from different subjects → yellow warning "spans multiple subjects".
- **Empty selection**: Save button should be disabled.
- **Source = "Your bank"** with no imported questions → empty state with "No questions match these filters."

---

# Journey 4 — Bulk import questions (own bank)

**Goal:** Owner uploads a spreadsheet of questions.

### Steps
1. Go to `/coaching/questions`.
2. Expand the **Import questions** panel.
3. Click **Download template** → opens `.xlsx` in Excel.
4. Fill template with 5–10 rows. **Include 1 deliberately broken row** (e.g. unknown subject_id, missing type, MULTI_MCQ with only 1 correct answer).
5. Save and upload.

### Expected
- Summary card: "N imported · M skipped".
- If skips: expandable error list showing row numbers + plain-English reasons.
- Imported questions appear in the list below with `YOUR BANK` source badge.
- Subsequent visit to `/coaching/tests/new` with source = "Your bank" shows them.

### Watch for
- File over 5MB → "File is too large."
- Empty file → "That sheet is empty."
- Bad type column → "type must be one of SINGLE_MCQ, MULTI_MCQ, FILL_IN_BLANK."

---

# Journey 5 — White-label settings + branded email verification

**Goal:** Owner customizes brand colors and verifies they propagate to emails.

### Steps
1. Go to `/coaching/settings/branding`.
2. (As Sunrise is on Trial, the form is visible with a "previewing during trial" notice.)
3. Set:
   - **Primary color**: try `oklch(0.7 0.18 25)` (orange-red), or pick from swatches
   - **Display name**: "Sunrise Coaching"
   - **Logo light variant**: drop in any PNG (or use `https://placehold.co/200x60/orange/white?text=Sunrise`)
   - **Support email**: `hello@sunrise.in`
4. Click **Save**.
5. Open another browser tab → trigger an email-sending action (e.g. `/coaching/team` → invite a new teacher with email `test@example.com`).
6. Watch the dev terminal where `npm run dev` is running.

### Expected
- Settings page shows "Saved." pill next to button.
- Dev console shows `[email-stub] html (~2000 bytes):` line.
- HTML preview includes `<td style="background:oklch(0.7 0.18 25)…">` (your primary color) and `<img src="…" alt="Sunrise Coaching">`.
- A `[notifications] template=team-invite channel=email delivered=true` log line confirms dispatch.

### Edge cases
- **Starter ACTIVE (not trial)**: visit `/coaching/settings/branding` → should show "Available on Growth+" upgrade card instead of the form.
- **PUT api directly while on Starter ACTIVE**: returns HTTP 402.

---

# Journey 6 — Generate a parent report

**Goal:** Owner sends a parent report for a single student.

### Preconditions
- The student must have at least 1 finished test attempt. Sunrise's demo students have empty data by default.

### Steps
1. Go to `/coaching/batches/1`.
2. Click the 3-dot menu on a student row → **Send parent report**.
3. If the student has no attempts: error banner "Not enough activity yet — assign a test first." → expected.
4. If they have attempts: row shows a brief "Sent" pill for 3 seconds.

### Watch dev console
- `[email-stub]`, `[sms-stub]`, and `[whatsapp-stub]` lines for the same message (channel = `whatsapp+sms+email`).
- The PDF file written to `public/uploads/reports/<token>.pdf` (open in browser at the URL returned in the JSON response).

### Variations
- **Bulk reminder**: dashboard → "Remind behind" → confirm preflight count → send. Dev console shows multiple `[notifications]` lines.

---

# Journey 7 — Team invite + revoke with reassignment

**Goal:** Owner invites a teacher, assigns them to a batch, then revokes and reassigns.

### Steps (invite)
1. Go to `/coaching/team` → fill the **Invite a teammate** form: name "Test Teacher", email `test-teacher@example.com`, role TEACHER → Send invite.
2. The Pending Invites section shows the new invite.
3. Dev console shows `[email-stub]` with the accept URL.
4. Copy the URL, open in incognito window → set password → land on `/coaching/dashboard` as TEACHER.

### Steps (assign to batch)
5. Back as Sunrise owner: `POST /api/coaching/batches/1/teachers` with `{"userId": <teacher's userId>}` via curl OR — if the batch detail "Teachers" tab UI is wired — use that.
6. `GET /api/coaching/batches/1/teachers` → confirm the teacher row.

### Steps (revoke with reassignment)
7. Go to `/coaching/team` → 3-dot menu on the teacher → **Revoke access**.
8. **First attempt: WITHOUT reassignment plan** → expect error 409 surfacing the batches that need replacement.
9. **Second attempt: WITH plan** (`{reassignments: {"1": null}}` via dev tools or DELETE request) → batch becomes owner-managed.

### Expected
- After successful revoke: Team page shows only the owner.
- `GET /api/coaching/batches/1/teachers` returns empty array.

---

# Journey 8 — Multi-branch hierarchy

**Goal:** Parent-org owner creates a branch and switches contexts.

### Steps
1. From Sunrise dashboard → **Branches** link → `/coaching/branches`.
2. Click **+ Add branch** → name "Sunrise — Bandra", city "Mumbai" → Create.
3. New branch appears in the list.
4. Click "View dashboard →" on the branch row.
5. Confirm JWT switched: header shows the branch's display name.
6. Go back via "Branches" link → click on Sunrise (parent) to switch back.

### Expected
- Parent shows consolidated "Branches" link as long as it has ≥1 child.
- Branch dashboard shows the parent owner as OWNER (cascaded access from parent).
- Sign out + sign back in → still see the parent's data on `/coaching/dashboard` by default.

### Edge case
- Sign in as a regular Sunrise TEACHER (priya if you re-invited her). Try to visit the branch's dashboard URL directly → should redirect or 404 (cascade access is OWNER/ADMIN only).

---

# Journey 9 — Student transfer between batches

**Goal:** Move a student from batch A to batch B without losing attempt history.

### Preconditions
- Sunrise has at least 2 active batches. If not, create one via `/coaching/batches/new`.

### Steps
1. `/coaching/batches/1` → 3-dot menu on a student → **Transfer to another batch**.
2. Dialog pops with target batch dropdown.
3. Pick another batch → Transfer.

### Expected
- Student disappears from batch 1 roster.
- Visit the target batch → student appears.
- Old enrollment row in `tq_batch_enrollments` has `isActive=false`, new row has `isActive=true`.
- The student's `main_exam_status` attempts remain visible (test by going to any prior assignment monitor view).

### Edge cases
- **Same target batch**: 409 / "Student is already enrolled".
- **Org has only 1 batch**: dialog shows "You only have one batch — create another to transfer students."

---

# Journey 10 — Bulk assign to multiple batches

**Goal:** Owner assigns 1 test to several batches in one click.

### Preconditions
- Sunrise has at least 2 active batches.

### Steps
1. `/coaching/batches/1/assign`.
2. Pick a test.
3. On the right panel, expand **Also assign to** → tick the other batches.
4. Set due date + notify channels.
5. Click **Assign to N batches** (button label updates).

### Expected
- Redirect to `/coaching/dashboard` after success.
- Each chosen batch's Assignments tab shows the new assignment.

### Watch for
- **Partial failure**: if one batch fails (e.g. seat cap), the response surfaces a per-batch error list and keeps you on the page.
- **Per-batch notify**: each student in each batch gets one set of notifications.

---

# Journey 11 — Bulk CSV student import

**Goal:** Owner uploads 50 students from a spreadsheet.

### Steps
1. `/coaching/batches/1/students/import`.
2. Click **Download template** → CSV with `name,mobile,email` header.
3. Fill 5–10 rows.
4. Upload.

### Expected
- Summary: "N enrolled · M skipped".
- Skip reasons: missing name/mobile, duplicate mobile within file, etc.
- New students visible on the batch's Students tab.

### Edge cases
- **Duplicate mobile inside file**: only one row enrolled.
- **Existing student with same email**: re-uses existing legacy student row (no duplicate created).

---

# Journey 12 — Sample data seed + delete

**Goal:** Brand-new owner gets demo data on signup, then dismisses it.

### Steps
1. Sign out. Open `/coaching/signup`.
2. Create a new centre: any name, owner email like `test-5.4@example.com`.
3. After signup: complete setup wizard (5 steps).
4. Land on dashboard. **Sample data banner** should be visible above the onboarding tip.
5. Click **Delete demo data** button on the banner.

### Expected
- Dashboard now shows real "no batches yet" empty state.
- DB inspection: the auto-created batch, 10 fake students, and 1 assignment all have `isActive=false`.

### Variation
- Sign up with `includeSampleData: false` via API → no demo data created.

---

# Journey 13 — Sales-led admin onboarding

**Goal:** Testquest staff manually onboards a centre.

### Steps
1. `/admin/login` with admin creds.
2. `/admin/organizations` → **Onboard centre**.
3. Fill the form: centre name, city, owner name + email, plan, sales stage, notes, follow-up.
4. Submit → success card shows the welcome URL.
5. Click **Copy** → paste in incognito window.
6. As the invited owner: set password → land on `/coaching/setup`.

### Expected
- Admin can revisit `/admin/organizations/[id]` → see members, batches, billing, sales notes tabs.
- Edit sales notes / stage / follow-up → persists.
- If owner has accepted: no "owner hasn't set password" warning. Otherwise, "Resend welcome" button visible.

---

# Journey 14 — Mobile navigation (5.2 F1 / F2 / F3 fixes)

**Goal:** Validate that every coaching/admin/attempt surface is usable on a phone.

### Steps
1. Open Chrome DevTools → toggle device toolbar → set to 360×640 (or similar narrow viewport).
2. Sign in as Sunrise owner.
3. Visit `/coaching/dashboard` → confirm **hamburger menu** in header (no inline link list).
4. Tap hamburger → drawer slides in with Tests / Questions / Team / Settings / Branches / Help / Sign out.
5. Visit `/admin/login` (in a separate session) → admin panel.
6. On any `/admin/*` page → confirm the sidebar is NOT permanently visible. AppBar with hamburger should be at top.
7. Start a test attempt (`/attempts/[id]`) → confirm a sticky **"Questions N/M"** pill in the header.
8. Tap it → bottom sheet opens with the question palette (grid + legend + Practice mode callout).

### Expected
- No horizontal scrollbars.
- Tap targets ≥ 44×44px.
- The attempt page palette is reachable without scrolling past the entire question.

### Variations
- Rotate to landscape (e.g. 640px width) → hamburger should give way to the inline nav.
- `/admin/questions` tables → swipe horizontally to see all columns (overflow-x-auto + min-width fix).

---

# Journey 15 — Help page

**Goal:** Public visitor browses FAQ.

### Steps
1. Visit `/help` (no auth needed).
2. Try search ("trial", "billing", "OTP") → accordion entries filter in real time.
3. Click any FAQ → expands.
4. Scroll to bottom → "Still stuck? Email us" with `mailto:`.

### Expected
- 27 FAQ entries grouped by topic.
- Video placeholder cards with "Coming soon" badges.
- "Help" link reachable from coaching header + student avatar menu + marketing footer.

---

# Journey 16 — Branding propagates to student-facing UX

**Goal:** A Sunrise student sees the centre's branding (not Testquest's).

### Preconditions
- Sunrise has white-label settings configured (Journey 5).
- A student belongs to Sunrise. Use the demo students 2011–2015 by setting a password via SQL:
  ```sql
  UPDATE student SET password = '$2b$10$<bcrypt-hash-of-test123>' WHERE student_id = 2011;
  ```
  Or have the student go through the join-by-token flow.

### Steps
1. Sign in as the student.
2. Visit `/tests`, `/dashboard`, `/profile`.

### Expected
- Header shows Sunrise display name (not "Testquest").
- Primary color across the app shifts to Sunrise's primary.
- "Powered by Testquest" footer visible (Sunrise is Starter, not Pro).

### Variation
- Flip Sunrise to Pro plan → "Powered by Testquest" disappears.
- Sign in as a B2C student (no org) → default Testquest branding.

---

# Quick sanity checklist before public launch

These are the must-pass smoke tests:

- [ ] J1: Owner signs in, dashboard renders without errors
- [ ] J2: Mobile OTP login works happy path
- [ ] J3: Custom test builder saves a test
- [ ] J4: CSV import surfaces errors clearly
- [ ] J5: White-label save persists + email HTML reflects it
- [ ] J6: Parent report API returns 200 on a student with attempts
- [ ] J7: Team invite → accept → land on dashboard as TEACHER
- [ ] J8: Branch create + switch JWT works
- [ ] J9: Student transfer succeeds + assignment history preserved
- [ ] J10: Bulk assign to 2+ batches in one click
- [ ] J11: CSV student import enrolls students
- [ ] J12: Sample data seeded on signup; delete clears it
- [ ] J13: Sales-led org → welcome URL → owner sets password
- [ ] J14: Mobile hamburger + admin drawer + attempt palette all reachable at 360px
- [ ] J15: `/help` loads + search works
- [ ] J16: Sunrise student sees branded header

## Common issues to spot

- **PrismaClientKnownRequestError**: legacy column name mismatch (column doesn't exist). Tail dev console for the exact column.
- **Stale dev server after schema change**: kill `npm run dev` + restart so the Prisma client picks up the new model.
- **Hostinger 10s query timeout**: any query close to that ceiling will surface as a timeout error — flag for follow-up.
- **`brandingJson.setupProgress` lingers**: if a test signup bails mid-wizard, the dashboard keeps redirecting to setup. Clear via `clearSetupProgress(orgId)` or directly in DB.
