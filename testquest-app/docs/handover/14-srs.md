# Testquest — Software Requirements Specification (As-Built)

**Version 1.0 · July 2026 · Baseline for handover**

> **What this document is:** the authoritative record of what the delivered Testquest platform does, written as numbered requirements with acceptance criteria. It describes the system **as built and deployed** at https://www.testquest.in — not aspirations. Use it for sign-off, QA, and as the reference for future change requests ("modify FR-4.3…", "add to FR-6…"). Plain-language journeys for each user live in [13-user-journeys.md](./13-user-journeys.md); technical implementation maps live in [04-features/](./04-features/).

**Status legend:** ✅ **Delivered** (working in production) · 🟡 **Partial** (works with a stated limitation) · ⚪ **Stub** (code path exists, not operational).

---

# Part A — Product overview

## A1. Purpose & scope of this document

This SRS is the delivery baseline for the Testquest web platform rebuild. Everything numbered FR-x/NFR-x below has been implemented; items that are partial or stubbed are flagged honestly with what remains. Future change requests should reference requirement IDs so scope changes stay traceable.

## A2. Product vision & goals

Testquest helps Indian school students (Classes 6–12; CBSE, ICSE, State boards) master exams through chapter-wise online test practice. It serves two markets from one platform:

- **B2C** — self-prep students who buy individual paid tests or discounted bundles.
- **B2B** — coaching centres that subscribe monthly/annually to run their teaching through Testquest: batches, assigned tests, live monitoring, parent reports — under their own brand (white-label).

Revenue: per-test/bundle purchases (Razorpay) + coaching-centre subscription plans (Starter/Growth/Pro tiers with a 14-day free trial).

## A3. Users & personas

| Persona | Surface | Auth | Detailed journey |
|---|---|---|---|
| Self-prep student | testquest.in | Email+password or Google | [Journeys ch. 2](./13-user-journeys.md) |
| Coaching-centre owner | /coaching | Email+password (or OTP) | [ch. 3](./13-user-journeys.md) |
| Centre operations manager | /coaching | Email+password | [ch. 4](./13-user-journeys.md) |
| Teacher | /coaching | Email+password | [ch. 5](./13-user-journeys.md) |
| Centre student | testquest.in (branded) | Mobile OTP, no password | [ch. 6](./13-user-journeys.md) |
| Platform admin (Testquest staff) | /admin | Email+password | [ch. 7](./13-user-journeys.md) |
| Parent | — (receives reports only) | none | [note](./13-user-journeys.md) |

## A4. System context

One Next.js web application serves all surfaces and APIs, backed by a single MySQL database **shared with a mobile app that is live in production**. Legacy tables serve both apps (accounts, content, attempts); new `tq_`-prefixed tables serve web-only features (commerce, coaching). Architecture diagram and the shared-database contract: [02-architecture.md](./02-architecture.md), [06-shared-database-contract.md](./06-shared-database-contract.md). Hosting: Hostinger VPS (Nginx + PM2), documented in [09-deployment-operations.md](./09-deployment-operations.md).

## A5. Scope of this release

**In scope (delivered):** everything in Part B.

**Out of scope (not built in this release):** parent login/accounts; chapter-level taxonomy (questions attach to subjects); languages other than English; operational WhatsApp delivery; faculty/centre roles beyond OWNER/ADMIN/TEACHER; any change to the mobile app; automated test suites and CI/CD.

---

# Part B — Functional requirements

Each requirement states delivered behaviour. Traceability: journey chapter (business), feature file (developers), and [MANUAL_TEST_CASES.md](../MANUAL_TEST_CASES.md) (QA).

## FR-1 Accounts & authentication

*Trace: Journeys ch. 2/3/6 · [04-features/01-student-auth.md](./04-features/01-student-auth.md)*

| ID | Requirement | Acceptance criteria | Status |
|---|---|---|---|
| FR-1.1 | Students shall register with name, email, password (min 6 chars), class (6–12), and board (CBSE/ICSE/State). | Duplicate email rejected; invalid class rejected; account usable immediately; same account works on the mobile app. | ✅ |
| FR-1.2 | Students shall sign in with email+password or with Google. | Google sign-in verifies a Google-issued token; no password stored for Google-only users. | ✅ |
| FR-1.3 | Sessions shall persist via a signed token in an httpOnly cookie; no server-side session store. | Logout clears the cookie; tampered tokens are rejected. | ✅ |
| FR-1.4 | Login shall resolve the user's role: student, platform admin, or coaching member — and route accordingly. | An email present in the admin or coaching-membership records signs in with that role's permissions. | ✅ |
| FR-1.5 | Users shall reset forgotten passwords via a time-limited email link (1 hour). | Used/expired tokens rejected; new password takes effect immediately. | ✅ |
| FR-1.6 | Coaching staff shall be able to sign in with a one-time code (OTP) sent to their mobile, as an alternative to a password. | 6-digit code, single-use. 🟡 requires the SMS provider configured in production. | 🟡 |
| FR-1.7 | Protected pages shall redirect signed-out visitors to the appropriate login screen. | Direct URL access to dashboards/admin/coaching without a session redirects to login. | ✅ |

## FR-2 Content catalogue

*Trace: Journeys ch. 2 · [04-features/03-test-browsing.md](./04-features/03-test-browsing.md)*

| ID | Requirement | Acceptance criteria | Status |
|---|---|---|---|
| FR-2.1 | The platform shall present a class → subject taxonomy for browsing and signup. | Duplicate legacy subjects are de-duplicated; inactive entries hidden. | ✅ |
| FR-2.2 | Students shall browse tests filtered to their class, further filterable by subject. | Each card shows name, subject, question count, duration, marks, free/paid. | ✅ |
| FR-2.3 | Test detail shall show description and either Start (free/owned) or Buy (paid, not owned). | Access reflects purchases and coaching assignments. | ✅ |
| FR-2.4 | Content shall be single-sourced: the same catalogue serves the website and the mobile app. | An admin edit appears on both without any sync step. | ✅ |
| FR-2.5 | Content is English-only in this release. | — | ✅ (by design) |

## FR-3 Test attempts

*Trace: Journeys ch. 2/6 · [04-features/04-test-attempts.md](./04-features/04-test-attempts.md)*

| ID | Requirement | Acceptance criteria | Status |
|---|---|---|---|
| FR-3.1 | Starting a test shall create a timed attempt with a countdown matching the test's duration. | Timer visible throughout; reaching zero auto-submits. | ✅ |
| FR-3.2 | Every answer shall be saved the moment it is selected. | Closing the browser mid-test loses no answered question. | ✅ |
| FR-3.3 | Students shall pause an attempt and resume later; the timer resumes where it stopped. | Pause state survives logout/login. | ✅ |
| FR-3.4 | Supported question types: single-choice MCQ, multi-choice MCQ, fill-in-the-blank, and paragraph-based groups. | Each scores correctly per its type. | ✅ |
| FR-3.5 | Submitting shall score instantly: total, correct/wrong/unanswered, and a full per-question review with correct answers. | Result available immediately and permanently from "My attempts". | ✅ |
| FR-3.6 | Attempt history shall be shared with the mobile app (one history per student). | An attempt made on either surface appears on both. | ✅ |
| FR-3.7 | If a test was assigned by a coaching centre, submission shall register completion for the centre's monitoring. | The teacher's monitor view reflects the submission immediately. | ✅ |

## FR-4 Commerce (B2C)

*Trace: Journeys ch. 2 · [04-features/05-payments-and-commerce.md](./04-features/05-payments-and-commerce.md)*

| ID | Requirement | Acceptance criteria | Status |
|---|---|---|---|
| FR-4.1 | Tests shall be free or individually priced; bundles shall sell a set of tests at one price with a validity period (days). | Prices are defined server-side; the client can never set an amount. | ✅ |
| FR-4.2 | Coupons shall support percentage or flat discounts with: validity window, minimum order value, max discount cap, total and per-user usage limits, and scopes (bundle-only, specific bundle, first-time buyer). | Invalid/expired/exhausted coupons rejected with clear messages; discounts computed server-side. | ✅ |
| FR-4.3 | Checkout shall collect payment via Razorpay (card/UPI/netbanking) and unlock the purchased item only after cryptographic verification of the payment signature. | Wrong signature ⇒ order marked failed, no access; correct ⇒ order paid, access granted, coupon usage recorded. | ✅ |
| FR-4.4 | If a coupon reduces the total to zero, access shall be granted without a payment step. | Order recorded as paid with zero amount. | ✅ |
| FR-4.5 | Razorpay server-to-server webhooks shall be verified and processed idempotently (each event handled at most once). | Duplicate webhook deliveries cause no double-grants. | ✅ |
| FR-4.6 | Students shall see purchase history and unlocked content under their account. | — | ✅ |
| FR-4.7 | Live money movement. | 🟡 The gateway runs on **test keys**; go-live requires installing live keys and registering the live webhook (steps documented). Real UPI QR payment works only after this. | 🟡 |

## FR-5 Platform admin panel

*Trace: Journeys ch. 7 · [04-features/06-admin-panel.md](./04-features/06-admin-panel.md)*

| ID | Requirement | Acceptance criteria | Status |
|---|---|---|---|
| FR-5.1 | Admins shall sign in at a dedicated /admin login, separate from student accounts. | Student credentials cannot open /admin. | ✅ |
| FR-5.2 | Admins shall create/edit/archive classes, subjects, questions, and tests; edits propagate to both web and mobile. | Deleting archives (soft delete) — content vanishes from students but attempt history stays intact. | ✅ |
| FR-5.3 | Question authoring shall support the four question types, options, correct answers, difficulty (easy/medium/hard), and per-test composition with duration/marks/price. | — | ✅ |
| FR-5.4 | Bulk question upload from a spreadsheet template. | ⚪ Endpoint and template exist but the import is switched off ("temporarily unavailable") pending legacy-schema wiring; single-question authoring is the working path. | ⚪ |
| FR-5.5 | Admins shall manage bundles and coupons (create, edit, deactivate). | — | ✅ |
| FR-5.6 | Admins shall view all orders and revenue summaries, and browse registered students. | — | ✅ |
| FR-5.7 | Admins shall create coaching centres on behalf of customers (sales-led onboarding) and resend the owner's welcome link. | Welcome link valid 14 days; resend generates a fresh link. | ✅ |

## FR-6 Coaching platform (B2B)

*Trace: Journeys ch. 3–6 · [04-features/07-coaching-b2b.md](./04-features/07-coaching-b2b.md)*

| ID | Requirement | Acceptance criteria | Status |
|---|---|---|---|
| FR-6.1 | Centres shall onboard two ways: self-serve signup, or sales-led (admin-created + welcome email where the owner sets a password). Both start a 14-day free trial on the Starter plan. | Trial starts without payment details; onboarding path is recorded. | ✅ |
| FR-6.2 | A 5-step setup wizard shall onboard new centres: branding (name, city, logo, colour) → boards & classes → first batch → invite students (join link or roster) → summary. | Wizard resumes where left off; completing it lands on the dashboard. | ✅ |
| FR-6.3 | Centres shall organise students into batches (name, class, board, subjects); multi-location centres shall use branches with per-branch context switching. | — | ✅ |
| FR-6.4 | Student enrolment shall work three ways: manual entry, CSV roster upload (template provided, per-row error reporting), and a shareable join link. | CSV rejects malformed rows with row-level messages; join link enrols directly into the intended batch. | ✅ |
| FR-6.5 | Students joining by link shall authenticate with name + mobile + SMS OTP — no password, no email required — and land in the centre-branded catalogue. | 🟡 needs the SMS provider configured in production (dev shows the code on screen). | 🟡 |
| FR-6.6 | Staff shall assign tests (Testquest's or the centre's own) to batches with due dates; students see them highlighted with deadlines. | Bulk assignment across batches supported. | ✅ |
| FR-6.7 | Assignment monitoring shall show, per assignment, who completed, who is pending, and scores — live. | One-tap reminder nudges to all pending students (delivered by SMS/email). | ✅ |
| FR-6.8 | Centres shall maintain a private question bank and build their own tests (including CSV question import with template). | Centre content is invisible to other centres and to B2C students. | ✅ |
| FR-6.9 | Team management: OWNER/ADMIN/TEACHER roles with email invites (invitee sets a password). Owners can do everything; admins everything except owner-removal/billing ownership; teachers are limited to their batches' teaching actions. | Invite links expire; revocation removes access. | ✅ |
| FR-6.10 | White-label branding: the centre's logo and colours replace Testquest's for its students, in the app and in emails/reports, gated by plan tier; the "Powered by Testquest" credit disappears on the Pro tier. | Branding preview available in settings; non-qualifying plans keep defaults. | ✅ |
| FR-6.11 | Subscription lifecycle: TRIAL (14 days, countdown banner) → GRACE (assignments pause) → EXPIRED (read-only) → ACTIVE on payment. Billing page offers plan tiers, monthly/annual, via Razorpay subscriptions. | State transitions enforce the stated restrictions. 🟡 real charging awaits live payment keys. | 🟡 |

## FR-7 Reporting & notifications

*Trace: Journeys ch. 3/5 + parent note · [04-features/08-notifications-and-cron.md](./04-features/08-notifications-and-cron.md)*

| ID | Requirement | Acceptance criteria | Status |
|---|---|---|---|
| FR-7.1 | Staff shall generate a per-student progress report on demand: average score, batch-average comparison, 4-week trend, and weak topics; delivered as a document link to the student's registered contact. | Students with no finished attempts get a friendly "not enough activity" message instead of an empty report. | ✅ |
| FR-7.2 | A weekly report run shall go out automatically every Sunday, idempotently (a re-run never double-sends). | 🟡 the schedule must be configured on the production server (crontab) — verify it is active. | 🟡 |
| FR-7.3 | Outbound messages shall attempt channels in order WhatsApp → SMS → email, falling through automatically. | ⚪ WhatsApp has no provider connected — actual delivery today is SMS/email. | ⚪/✅ |
| FR-7.4 | Transactional emails: password reset, coaching welcome/invites, OTPs (email fallback), report links — branded with the centre's identity where applicable. | Sent via configured SMTP. | ✅ |

## FR-8 Theming & branding

*Trace: [05-ui-theming.md](./05-ui-theming.md)*

| ID | Requirement | Acceptance criteria | Status |
|---|---|---|---|
| FR-8.1 | The platform shall use the Testquest brand palette (primary purple #6134EB family) with **light mode as default** and a one-tap dark-mode toggle; the choice persists per browser. | Both modes fully styled; toggle is a single button (no menu). | ✅ |
| FR-8.2 | The Test Quest logo (arrow-T mark + wordmark) shall appear across the app, emails, reports, and the browser tab (favicon). | Mark renders crisply at all sizes; wordmark adapts to theme. | ✅ |
| FR-8.3 | The site shall be responsive; touch scrolling works on all pages at mobile sizes. | Verified at 375×812. | ✅ |

---

# Part C — Non-functional requirements

## NFR-1 Security

- Passwords hashed with bcrypt; a legacy plain-text column exists in the old schema but is **never read** by this system.
- Sessions: signed JWT in httpOnly cookies; role checked on every protected route and in middleware.
- Every API endpoint validates input with a schema before processing.
- Payment integrity: Razorpay signatures verified with HMAC-SHA256 using timing-safe comparison; webhooks independently verified and idempotent.
- Deletions are soft (archive) — no destructive data loss paths in normal operation.
- **Known items to action at handover:** rotate the seeded admin password and all secrets ([10-accounts-checklist.md](./10-accounts-checklist.md)); report links are unguessable but not login-protected (hardening on the roadmap).

## NFR-2 Performance

- The shared database enforces a 10-second query ceiling; the application avoids per-row correlated subqueries over the ~28k-question corpus and returns catalogue queries well within it.
- The production build is served by a persistent Node process behind Nginx; static assets cached by the browser.

## NFR-3 Compatibility & coexistence

- Responsive web app (mobile browsers first-class); light and dark themes.
- **Mobile-app coexistence contract:** the production mobile app reads the same database. The web app never restructures legacy tables, reads legacy data through views, writes only via three audited paths, and never runs destructive schema commands. Full rules: [06-shared-database-contract.md](./06-shared-database-contract.md).

## NFR-4 Reliability & operations

- The app auto-restarts on crash (PM2) and on server reboot; HTTPS via Nginx.
- Deployments are manual (documented runbook); **no CI/CD pipeline and no automated test suite exist** — quality relies on the manual QA pack ([11-testing-qa.md](./11-testing-qa.md)). Stated as an accepted risk with a recommended remediation path.
- Database backup schedule must be confirmed with the hosting account ([10-accounts-checklist.md](./10-accounts-checklist.md)).

## NFR-5 Data

- Single shared MySQL instance (no separate staging database) — production data discipline required for all environments.
- Inherited legacy data quirks are documented and handled in code (empty correct answers, CSV-typed fields, orphan rows) — [06-shared-database-contract.md](./06-shared-database-contract.md).
- Retention: nothing hard-deleted in normal flows; archived content remains for attempt-history integrity.

---

# Part D — Constraints, assumptions & roadmap

## D1. Constraints

- The legacy database schema is immutable (mobile app dependency).
- One live database for all environments until a staging copy is provisioned.
- Razorpay is the sole payment provider; English is the sole content language.

## D2. Assumptions

- The SMS and SMTP providers configured in production remain funded and operational (OTP and email flows depend on them).
- The mobile app continues operating unchanged; any mobile-side schema needs are coordinated separately.

## D3. Roadmap candidates (not commitments)

Parent accounts with their own login · WhatsApp Business provider integration · live payment activation (immediately actionable) · chapter-level taxonomy · automated tests + CI pipeline · protected/expiring report links with cloud storage · staging environment · multi-language content.

## D4. Glossary

**Attempt** — one sitting of one test by one student. **Batch** — a class group inside a coaching centre. **Bundle** — a priced pack of tests with validity. **OTP** — one-time SMS code. **Soft delete** — archiving instead of destroying. **Trial/Grace/Expired/Active** — subscription states. **White-label** — the centre's brand replacing Testquest's for its students.

## D5. Traceability matrix

| Module | Business journey | Technical map | Manual QA |
|---|---|---|---|
| FR-1 Accounts | [ch. 2/3/6](./13-user-journeys.md) | [feature 01](./04-features/01-student-auth.md) | MANUAL_TEST_CASES §Auth |
| FR-2 Catalogue | [ch. 2](./13-user-journeys.md) | [feature 03](./04-features/03-test-browsing.md) | §Browsing |
| FR-3 Attempts | [ch. 2/6](./13-user-journeys.md) | [feature 04](./04-features/04-test-attempts.md) | §Attempts |
| FR-4 Commerce | [ch. 2](./13-user-journeys.md) | [feature 05](./04-features/05-payments-and-commerce.md) | §Payments |
| FR-5 Admin | [ch. 7](./13-user-journeys.md) | [feature 06](./04-features/06-admin-panel.md) | §Admin |
| FR-6 Coaching | [ch. 3–6](./13-user-journeys.md) | [feature 07](./04-features/07-coaching-b2b.md) | §Coaching |
| FR-7 Reports | [ch. 3/5](./13-user-journeys.md) | [feature 08](./04-features/08-notifications-and-cron.md) | §Reports |
| FR-8 Theming | — | [05-ui-theming.md](./05-ui-theming.md) | §UI |

*(Section names in the QA column refer to [MANUAL_TEST_CASES.md](../MANUAL_TEST_CASES.md); exact heading names there may differ slightly.)*
