# Testquest — End-to-End User Journeys

> **What this file tells you:** the complete journey of every type of user on Testquest, told in plain English from first contact to daily use. Written for the business — sales, onboarding, support, and training can use it as-is. No technical vocabulary. (Developers: each journey links to the matching technical feature file.)

## How to read this

Every journey is a chronological story: how the person first meets Testquest, what they do step by step, what messages they receive, and what their normal week looks like. Steps marked ⚠ depend on something that is not switched on yet (listed honestly at the end of each chapter).

## The cast — who uses Testquest

| Persona | Who they are | Where they sign in | Do they pay? |
|---|---|---|---|
| 1. Visitor | Anyone browsing the website | Nowhere yet | No |
| 2. Self-prep student | A Class 6–12 student studying independently | testquest.in → Sign in | Per test or bundle |
| 3. Coaching-centre owner | Founder of a tuition centre | testquest.in/coaching/login | Monthly/annual subscription |
| 4. Centre operations manager | The owner's back-office right hand | testquest.in/coaching/login | No (covered by the centre) |
| 5. Teacher | A subject teacher at a centre | testquest.in/coaching/login | No (covered by the centre) |
| 6. Centre student | A student enrolled at a coaching centre | Joins by mobile OTP — no password | No (covered by the centre) |
| 7. Platform admin | Testquest's own staff | testquest.in/admin/login | — |
| Parent | A centre student's parent | Does not log in (see note at end) | No |

---

## 1. The visitor

**Who:** anyone who lands on testquest.in — a student searching for test practice, a parent, or a coaching-centre owner who saw an ad or heard about Testquest.

**The journey**

1. They land on the home page: what Testquest is, how it works, subjects covered, pricing, live counters, and testimonials. A separate page — "For coaching centres" — sells the business offering to institute owners.
2. They can read the FAQ on the Help page without signing up.
3. Two doors forward: **"Start free"** (student signup) or, on the coaching page, **"Get started"** (centre signup). Nothing on the site requires payment to begin.

---

## 2. The self-prep student

**Who:** a Class 6–12 student (CBSE, ICSE, or State board) preparing on their own. They pay only for what they use — individual paid tests or discounted bundles.

**The journey**

1. **Sign up.** They tap "Start free", enter just their name, email, and password (mobile optional) — or simply use "Sign in with Google". No class or board is asked (they can set their class later on the profile page), and no payment details. A guest can also browse the whole catalogue first: tapping "Start test" or "Unlock test" while signed out opens a friendly prompt to create an account or sign in — and after signing in, the test starts (or checkout opens) automatically.
2. **Dashboard.** They land on a personal dashboard: a welcome, their recent activity, and shortcuts into the test catalogue.
3. **Browse tests.** The catalogue is filtered to their class; they narrow by subject. Every test card shows the question count, time limit, marks, and whether it's free or paid.
4. **Take a free test.** One tap starts the exam: one question at a time, a countdown timer, and every answer saved the instant it's chosen — if the internet drops, nothing is lost. They can pause and come back later; the timer resumes where it stopped.
5. **See the result instantly.** On submit (or when time runs out), they immediately see their score, a correct/wrong/skipped breakdown, and a full question-by-question review with the right answers.
6. **Hit a paid test.** Paid tests show a price instead of a Start button. Tapping "Buy" opens checkout, where they can also apply a coupon code for a discount.
7. **Pay.** Payment happens through Razorpay — card, UPI, or netbanking. The moment payment succeeds, the test unlocks and appears under "My purchases". Bundles work the same way: one payment unlocks a pack of tests, valid for a set number of days. ⚠ *Real payments start once the live payment keys are activated; today the gateway is in test mode.*
8. **Keep coming back.** "My attempts" lists every test they've taken with scores and result links. Their history is the same whether they use the website or the Testquest mobile app — it's one account.
9. **Forgot password?** They enter their email, receive a reset link, and choose a new password. Google users just sign in with Google again.

**Moments that matter:** the password-reset email; the payment confirmation moment when a test unlocks.

*Developer reference: [features 01](./04-features/01-student-auth.md), [02](./04-features/02-student-dashboard-profile.md), [03](./04-features/03-test-browsing.md), [04](./04-features/04-test-attempts.md), [05](./04-features/05-payments-and-commerce.md).*

---

## 3. The coaching-centre owner

**Who:** the founder of a tuition centre — say, 3 teachers and 150 students. They want to assign tests to batches, see who actually did the homework, and send progress reports to parents, all under their own centre's name and colours.

**The journey — two beginnings that converge**

**Beginning A — self-serve:** they find the "For coaching centres" page, tap "Get started", and sign up with their name, centre name, email, and mobile.

**Beginning B — sales-led:** a Testquest salesperson sets the centre up for them. The owner receives a **welcome email with a personal link**; opening it shows "Set up *your centre's name*" and asks them to choose a password. (If the link expires, Testquest staff can resend it.)

Either way, the centre starts on a **free 14-day trial** of the Starter plan — no payment details needed.

**Then the setup wizard — five short steps**

1. **Branding.** Centre display name, city, logo upload, and their brand colour. From here on, their students see the centre's identity, not Testquest's.
2. **Boards & classes.** Which boards and classes the centre teaches.
3. **First batch.** Name the first batch (e.g. "Class 10 – Morning"), pick its class, board, and subjects.
4. **Invite students.** Two choices: share a **join link** (send it on WhatsApp, print it, put it on the notice board) or paste the student roster directly.
5. **Done.** A summary — batch created, students added, "Starter · Trial" — and a button to the dashboard.

**Daily and weekly life**

- **Dashboard.** Batches, recent activity, assignment completion at a glance, and a trial countdown banner.
- **Assign tests.** Pick a test (from Testquest's library or the centre's own), pick batches, set a due date. Students instantly see it in their account.
- **Monitor.** A live view per assignment: who finished, who hasn't, scores. One tap sends a reminder nudge to everyone pending.
- **Build their own content.** A private question bank and test builder — the centre's own tests live alongside Testquest's.
- **Grow the team.** Invite operations managers and teachers by email; each teacher is attached to specific batches.
- **Branches.** A multi-location centre creates branches and switches between them.
- **Parent reports.** For any student, one tap generates a progress report (average score, comparison with the batch, 4-week trend, weak topics) and sends it out. A weekly report also goes out automatically every Sunday. ⚠ *see honesty notes below.*

**The money story**

- The trial banner counts down; in the last days it turns urgent.
- Trial over → a short **grace period**: everything visible, but new assignments pause.
- Still unpaid → **expired**: read-only until they subscribe.
- They subscribe on the Billing page (monthly or annual, via Razorpay). Higher tiers unlock deeper branding — on the Pro plan the "Powered by Testquest" footer disappears entirely and reports carry only the centre's brand.

**Honesty notes (current limitations):** report/nudge delivery is by SMS and email today — WhatsApp delivery is planned but not connected yet. Subscriptions charge for real only after live payment keys are activated. The automatic Sunday report requires a scheduled job on the server that should be verified as running.

*Developer reference: [feature 07](./04-features/07-coaching-b2b.md), [feature 08](./04-features/08-notifications-and-cron.md).*

---

## 4. The centre operations manager

**Who:** the owner's back-office right hand — manages rosters, batches, and schedules so the owner doesn't have to.

**The journey**

1. **Invited by email.** The invite link shows their name and email pre-filled; they choose a password and land straight on the centre dashboard.
2. **Runs the machine.** Creates batches, enrols students one by one or by uploading the roster file (a ready-made template is provided; upload errors are reported row by row so they can fix and retry), transfers students between batches, assigns tests, sends reminders and reports.
3. **What they cannot do:** the owner-only acts — they can't remove the owner or take over billing ownership.

*Developer reference: [feature 07](./04-features/07-coaching-b2b.md).*

---

## 5. The teacher

**Who:** a subject teacher responsible for particular batches.

**The journey**

1. **Invited by email**, chooses a password, lands on the dashboard.
2. **Sees their batches.** Students, past assignments, completion rates.
3. **Assigns a test** with a due date — students see it immediately with the deadline.
4. **Watches it live.** As students submit, the monitor view fills in: finished, pending, scores.
5. **Nudges.** One tap sends a reminder to everyone who hasn't finished.
6. **Sends a report** to any student's family after a test cycle — one tap, done.
7. **What they don't see:** billing, branding, team management — those belong to the owner and manager.

*Developer reference: [feature 07](./04-features/07-coaching-b2b.md).*

---

## 6. The centre student

**Who:** a student at the coaching centre. They never "buy" anything — the centre covers them — and they never need a password.

**The journey**

1. **Gets a join link** from the centre (WhatsApp message, printed notice, or told in class).
2. **Joins in under a minute.** The link opens a page carrying the centre's name. They type their **name and 10-digit mobile number**, receive a **6-digit code by SMS**, type it in — done. No password, no email needed. ⚠ *SMS delivery requires the SMS provider to be configured in production.*
3. **Lands in the test catalogue — wearing the centre's colours.** The centre's logo and brand colour replace Testquest's everywhere they look.
4. **"Assigned to me."** Their dashboard highlights tests the centre has assigned, each with its due date. They can also browse the general catalogue.
5. **Takes tests** exactly like any student: timer, autosave, pause/resume, instant results with answer review.
6. **Their teacher sees everything** — completion and scores appear in the centre's monitoring view the moment they submit.
7. **Their family gets reports** — progress summaries arrive by SMS/email (see the Parent note below).

*Developer reference: [feature 07](./04-features/07-coaching-b2b.md), [feature 04](./04-features/04-test-attempts.md).*

---

## 7. The platform admin (Testquest staff)

**Who:** Testquest's own team — content managers, sales, support. They use a separate admin panel with its own sign-in.

**The journey**

1. **Sign in** at the admin panel with an admin account (separate from student accounts).
2. **Content management** — the heart of the product:
   - Maintain **classes and subjects** (the tree students browse by).
   - Add **questions** one at a time, or in bulk from a spreadsheet (a template is provided; ⚠ the bulk import is currently switched off and returns "temporarily unavailable").
   - Compose **tests**: pick questions, set duration, marks, price (or free).
   - Everything published here appears on both the website **and the mobile app** — one content library serves both.
3. **Commerce** — create **bundles** (a discounted pack of tests with a validity period) and **coupons** (percentage or flat, usage limits, first-time-buyer or bundle-only rules); watch **orders** and **revenue** live.
4. **Coaching sales** — create a centre on behalf of a new customer (the sales-led path from chapter 3): enter the owner's details, and Testquest sends them the welcome link. If it expires, resend it from the same screen.
5. **Support** — browse registered students to help with account questions.

**A note on housekeeping:** deleting content actually *archives* it (it disappears from students but is never destroyed) — this protects the history of students who already took those tests.

*Developer reference: [feature 06](./04-features/06-admin-panel.md).*

---

## A note on parents

Parents are recipients, not users, in the current version. Weekly and on-demand progress reports — average score, comparison with the batch, a 4-week trend, and weak topics — are generated as a document and sent as a link **to the student's own registered mobile/email** (most students at coaching centres register a parent's number). Parents do not have their own login yet; a dedicated parent account with its own app view is on the future roadmap.

---

## Where the journeys connect

- The **self-prep student** and the **centre student** are the same product underneath — the centre student simply gets it branded, assigned, and paid for by the centre.
- The **owner, manager, and teacher** share one portal with different permissions.
- The **platform admin** feeds the content library that every other persona consumes, and opens the door for sales-led centres.
- Every student's test history is shared between the website and the **mobile app** — one account, one history, everywhere.
