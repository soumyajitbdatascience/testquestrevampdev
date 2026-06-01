# User personas — Testquest coaching MVP

Three categories of users today: **inside a centre**, **inside Testquest**, **outside any org**. Plus a few contextual variants (solo owner, parent-org owner, trial owner) that change the UX without changing the role.

The system role lives in `Organization.OrgRole` enum: `OWNER · ADMIN · TEACHER · STUDENT · PARENT`. Testquest staff is a separate `tq_admins` table with no org role.

---

## A. Inside a coaching centre

These all share the `/coaching/*` surface. Branding, billing, and feature gates apply per-org.

### A1. Centre Owner — "Founder Rohan"

> 32, owns a 200-student tutoring centre in Pune. Tech-comfortable but not a developer. Cares about: pass rates, student retention, what to teach next, billing simplicity.

| | |
|---|---|
| **OrgRole** | `OWNER` |
| **Logs in via** | Email/password OR mobile OTP |
| **Onboarding** | Self-serve `/coaching/signup` OR sales-led magic link |
| **Pays the bill** | Yes — sole `ownerUserId` on the org |
| **Can do** | Everything in `/coaching/*`. The only role that can revoke other members. |

**Surfaces they live in**
- `/coaching/dashboard` — homepage
- `/coaching/batches/*` — create + manage batches
- `/coaching/tests/new` — build custom tests
- `/coaching/questions` — bulk import own bank
- `/coaching/team` — invite teachers/admins
- `/coaching/settings/branding` — white-label
- `/coaching/billing` — plan + payment
- `/coaching/branches` — parent-org variant (multi-branch)

**Highest-value features**
- Parent reports (Pro tier hook)
- White-label (vanity + retention)
- Custom test builder
- Bulk ops (saves hours during onboarding)

**Pain points the product should hide from them**
- Schema details, migrations, raw SQL
- Channel selection (notifications "just work" — WhatsApp → SMS → email fallback)

---

### A2. Centre Admin — "Operations Manager Anita"

> 28, hired by Rohan to run the back-office. Handles enrollments, billing follow-ups, parent communication. Owner trusts them with everything except equity.

| | |
|---|---|
| **OrgRole** | `ADMIN` |
| **Logs in via** | Email/password (was invited as ADMIN role on the team page) |
| **Onboarding** | Email magic-link from `/coaching/team/accept/[token]` |
| **Pays the bill** | No, but can see billing |
| **Can do** | Almost everything. Can read/write batches, assignments, students, team list, settings. Cannot revoke the OWNER, cannot transfer ownership. |

**Surfaces** — same as owner except a handful of OWNER-only guards (team revocation, sales notes).

**Why this role exists**
- Owners often want to delegate without giving up ownership
- Co-founder collapse: in solo-owner orgs, role concept is hidden (no OWNER pill, no "signed in as" copy) — once the second member arrives, roles become visible

---

### A3. Centre Teacher — "Subject Teacher Priya"

> 26, freelance Math tutor at Sunrise. Wants to assign tests, monitor results, send reminders to her own batch. Doesn't want to see other batches.

| | |
|---|---|
| **OrgRole** | `TEACHER` |
| **Logs in via** | Email/password (invited via `/coaching/team`) |
| **Onboarding** | Same as ADMIN: magic-link |
| **Pays the bill** | No, can't see billing |
| **Can do** | Read/write batches **they're assigned to** (via `tq_batch_teachers`), assign tests, send reminders + parent reports, view the question bank |
| **Cannot do** | Invite other teammates, edit branding, see billing, view batches they aren't assigned to (Phase 4.6) |

**Surfaces**
- `/coaching/dashboard` — but scoped to their batches
- `/coaching/batches/[id]` — only batches they teach (4.6)
- `/coaching/tests/new` — can build custom tests
- `/coaching/team` — read-only view

**Special revoke flow**
- When owner removes a TEACHER who has assigned batches, the system requires per-batch reassignment (owner-managed OR another teacher) before the membership flips off (4.6).

---

### A4. Centre Student — "Class 10 Student Aman"

> 15, in Sunrise's Class 10 CBSE batch. Cares about: doing well on tests, knowing where he's weak, parents knowing he's trying.

| | |
|---|---|
| **OrgRole** | `STUDENT` |
| **Logs in via** | Mobile OTP (`/coaching/join/[token]` on first invite, then `/login`) |
| **Onboarding** | Centre invite link OR roster paste (no password needed — mobile OTP authenticates) |
| **Pays the bill** | No |
| **Can do** | Take tests assigned to their batch, view their own attempts, see "Assigned to me" section, browse free Testquest tests |
| **Cannot do** | See other students' results, anything in `/coaching/*` (redirected to `/tests`) |

**Surfaces**
- `/tests` (with org branding applied via 3.5)
- `/dashboard` (their own dashboard)
- `/attempts/[id]` (taking a test)
- `/coaching/assignments/[id]` (assignment intro from a link they clicked)
- `/my-attempts`
- `/profile`

**Why the branding matters**
- The student's first impression of "Testquest" is actually their centre. The 3.5 propagation swaps logo + colors + display name. "Powered by Testquest" footer hides on Pro orgs.

---

### A5. Parent — "Worried Father Mr. Patel"

> 45, Aman's dad. Doesn't want to log in or learn a new app. Wants a clean PDF in his inbox or WhatsApp every Sunday.

| | |
|---|---|
| **OrgRole** | `PARENT` (defined in enum but **not actively used in MVP**) |
| **Logs in via** | Doesn't. Phase 4 may add a login path. |
| **Onboarding** | None — they're a notification recipient, not a logged-in user |
| **Pays the bill** | No |
| **Receives** | Weekly auto-report PDF (3.2 cron) + on-demand reports from teacher (3.3), via WhatsApp / SMS / email |

**MVP compromise**
- "Parent contact" = student's own email/mobile (the student forwards to parent, OR shares the device). Dedicated parent records arrive in Phase 4+.
- Comment `PHASE 4 NOTE:` flagged at the lookup sites for the swap-out.

---

## B. Inside Testquest

These all share `/admin/*`. Separate auth via `tq_admins`.

### B1. Testquest Staff — "Sales/Support Rep"

> Internal employee. Onboards centres sales-led, watches the CRM funnel, troubleshoots tickets, oversees the question/test catalog.

| | |
|---|---|
| **Role** | `tq_admins` row, `role: "admin"` in JWT |
| **Logs in via** | `/admin/login` |
| **Pays the bill** | No (and there's no concept of "pays" here) |
| **Can do** | Create orgs, set parent-org links, edit CRM (sales stage, notes, follow-up), resend welcome links, manage Testquest's master content (classes/subjects/questions/tests/bundles/coupons), view orders & revenue |

**Surfaces**
- `/admin` (dashboard)
- `/admin/organizations` (sales pipeline + list)
- `/admin/organizations/[id]` (CRM detail)
- `/admin/classes`, `/admin/subjects`, `/admin/questions`, `/admin/tests`, `/admin/bundles`, `/admin/coupons`
- `/admin/orders`, `/admin/revenue`
- `/admin/students` (B2C + centre students)

**Future split**
- Today everyone's a single "admin" role. Future could split into sales / support / content roles. Not needed for MVP.

---

## C. Outside any org

### C1. B2C Student — "Self-prep Sara"

> 17, self-studying for JEE. Bought a few Testquest tests directly. Not affiliated with any centre.

| | |
|---|---|
| **OrgRole** | None — they have a legacy `student` row + zero `OrgMembership` rows |
| **Logs in via** | Email/password (`/login`) OR Google |
| **Pays the bill** | Yes — directly to Testquest via Razorpay one-time orders |
| **Can do** | Browse `/tests`, buy via `/checkout`, take attempts, view results, see their own profile |
| **Cannot do** | Anything in `/coaching/*` (redirected) |

**Surfaces**
- `/` marketing home
- `/tests`, `/tests/[id]`
- `/checkout`, `/checkout/success`
- `/attempts/[id]`, `/attempts/[id]/result`
- `/dashboard`, `/my-attempts`, `/profile`

**Coexists with centre flow**
- A single `student` row CAN be both B2C-Sara AND a centre student in some org. The legacy table is the source of identity; OrgMembership scopes the centre relationship.

---

### C2. Anonymous Visitor

> Marketing-funnel target. Might be: a parent researching centres, a centre owner shopping for software, a student looking for free practice.

| | |
|---|---|
| **Auth** | None |
| **Surfaces** | `/`, `/for-coaching-centres`, `/help`, `/login`, `/signup`, `/coaching/login`, `/coaching/signup` |
| **Can do** | Read marketing copy, browse the FAQ, sign up |

---

## Contextual variants (same role, different UX)

Same OrgRole; the UI changes based on org or subscription state.

### V1. Solo Owner
- Centre has only 1 member (the OWNER). Per 2.1 collapse logic:
  - Header role pill (OWNER) hidden
  - Dashboard subtitle drops "You're signed in as OWNER"
  - "Team" link still visible because OWNER always needs to find the invite flow
- The moment a second member is invited, role chrome reappears across the app.

### V2. Trial Owner
- Subscription is `TRIAL` (default 14 days from signup)
- `/coaching/settings/branding` shows a "previewing during trial" notice — the form is editable
- After trial ends and they convert to paid: notice disappears
- If trial ends without conversion: org enters `GRACE` (7 days) → `EXPIRED` (read-only)

### V3. Parent-Org Owner
- Same OWNER role, but the org has children (other orgs with `parentOrgId = self.id`)
- `/coaching/branches` becomes available — consolidated view + "Add branch" + "View dashboard →" deep links
- Owner can SWITCH JWT context into a child org via `POST /api/coaching/branches/[id]/enter` (4.4)
- TEACHER role does NOT cascade through parent → child (security boundary)

### V4. Pro-Plan Owner
- Subscription is `ACTIVE` and `planName: "Pro"`
- "Powered by Testquest" footer hidden on student-facing pages (3.5)
- White-label fully unlocked
- Parent-report PDFs use org branding (3.6)

### V5. Sales-Led Owner (vs. Self-Serve)
- Tracked in `Organization.salesJson.onboardingPath`
- Onboarded via Testquest staff at `/admin/organizations/new` → received a welcome magic-link
- Visible to Testquest staff in CRM. End-user experience is identical to self-serve after they accept the link.

### V6. Reassigned Teacher
- A TEACHER who was on Batch X gets revoked; the owner reassigns Batch X to Teacher Y via the per-batch teacher mapping (4.6).
- Teacher Y now sees Batch X on their dashboard; Teacher X loses access on next request.

---

## Persona → feature matrix

| Feature | Owner | Admin | Teacher | Student | Parent | Testquest staff | B2C |
|---|---|---|---|---|---|---|---|
| Create org | ✅ self-serve | ✗ | ✗ | ✗ | ✗ | ✅ sales-led | ✗ |
| Create batch | ✅ | ✅ | ✗ | ✗ | ✗ | ✗ (out of `/coaching/*`) | ✗ |
| Build custom test | ✅ | ✅ | ✅ | ✗ | ✗ | ✗ (master catalog instead) | ✗ |
| Import questions | ✅ | ✅ | ✅ | ✗ | ✗ | ✗ | ✗ |
| Assign test | ✅ | ✅ | ✅ (batches they own) | ✗ | ✗ | ✗ | ✗ |
| Take test | ✗ (redirect) | ✗ | ✗ | ✅ | ✗ | ✗ | ✅ (paid/free) |
| See attempts/results | ✅ all | ✅ all | ✅ scoped | ✅ own | ✗ | ✅ all | ✅ own |
| Get parent reports | n/a | n/a | n/a | n/a | ✅ (receive) | n/a | n/a |
| Send parent report | ✅ | ✅ | ✅ | ✗ | ✗ | ✗ | ✗ |
| Invite team | ✅ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Revoke team | ✅ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Edit branding | ✅ (Growth+) | ✅ (Growth+) | ✗ | ✗ | ✗ | ✗ | ✗ |
| See billing | ✅ | ✅ | ✗ | ✗ | ✗ | ✅ (sees plan + status) | ✗ |
| Pay billing | ✅ | ✗ | ✗ | ✗ | ✗ | ✗ | ✅ (direct B2C) |
| Multi-branch | ✅ (cascade) | ✅ (cascade) | ✗ | ✗ | ✗ | ✅ (link parent) | ✗ |
| Mobile OTP login | ✅ | ✅ | ✅ | ✅ (join+login) | n/a | ✗ | ✅ |
| CRM edits | ✗ | ✗ | ✗ | ✗ | ✗ | ✅ | ✗ |

---

## How personas land on `/`

| Persona | First URL | Where they end up |
|---|---|---|
| Centre Owner returning | `/coaching/login` | `/coaching/dashboard` |
| Centre Owner new | `/coaching/signup` or `/coaching/welcome/[token]` | `/coaching/setup` (5-step wizard) → `/coaching/dashboard` |
| Centre Admin invited | `/coaching/team/accept/[token]` | `/coaching/dashboard` |
| Centre Teacher invited | `/coaching/team/accept/[token]` | `/coaching/dashboard` (scoped) |
| Centre Student invited | `/coaching/join/[token]` | `/tests` (with org branding) |
| Centre Student returning | `/login` or `/coaching/login` (mobile OTP) | `/tests` |
| B2C Student | `/login` or `/signup` | `/tests` |
| Testquest Staff | `/admin/login` | `/admin` |
| Anonymous | `/` or `/for-coaching-centres` | Various marketing pages |

---

## Future personas (not in MVP)

- **Faculty Co-teacher** — multi-teacher batches with primary/assistant distinction (deferred per CLAUDE.md)
- **Centre HR/Operations** — separate from ADMIN, finance-only access (Phase 4+ if it's a real need)
- **School (org type)** — `OrgType.SCHOOL` exists in the enum but isn't surfaced in flows yet
- **District/Cluster** — multi-school hierarchy beyond coaching centres (Phase 5+)
- **Actual Parent login** — dedicated `tq_parents` table + per-student opt-in (Phase 4)
