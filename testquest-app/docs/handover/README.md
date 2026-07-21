# Testquest — Technical Handover

Welcome. This folder is the handover pack for the developers taking over Testquest (live at **https://www.testquest.in**). It explains what the product does, how the code is organised, which files and database tables power each feature, and how the site is deployed and operated.

Every file here is written in plain English. Technical terms are explained the first time they appear. Each file is short enough to read in one sitting.

## Reading order

If you are new, read in this order:

| # | File | What it covers |
|---|---|---|
| 1 | [01-overview.md](./01-overview.md) | What Testquest is, the technology used, and your first-week reading plan |
| 2 | [02-architecture.md](./02-architecture.md) | How the pieces fit together (with a diagram) |
| 3 | [06-shared-database-contract.md](./06-shared-database-contract.md) | **Read before touching the database.** The rules that keep the live mobile app safe |
| 4 | [03-file-structure.md](./03-file-structure.md) | The full folder and file map of the codebase |
| 5 | [04-features/](./04-features/) | One file per feature: what it does, which files to edit, which database tables it uses |
| 6 | [05-ui-theming.md](./05-ui-theming.md) | Which files to edit for global look-and-feel changes |
| 7 | [07-database-and-migrations.md](./07-database-and-migrations.md) | The data model and how to change the database safely |
| 8 | [08-environment-variables.md](./08-environment-variables.md) | Every configuration setting and what it does |
| 9 | [09-deployment-operations.md](./09-deployment-operations.md) | The production server, how to deploy, logs, and smoke tests |
| 10 | [10-accounts-checklist.md](./10-accounts-checklist.md) | Third-party accounts to transfer and secrets to rotate |
| 11 | [11-testing-qa.md](./11-testing-qa.md) | How the app is tested today (manual QA) |
| 12 | [12-known-gaps-and-risks.md](./12-known-gaps-and-risks.md) | Pending work, known risks, and an index of older documents |

## Feature guide (the part you will use most)

Each feature file follows the same template: **What it does** (plain English, readable by non-developers) → **How it works** → **Files to edit** → **Database tables used** → **Watch out for**.

| Feature | File |
|---|---|
| Student signup, login, Google login, password reset | [04-features/01-student-auth.md](./04-features/01-student-auth.md) |
| Student dashboard, profile, attempt history | [04-features/02-student-dashboard-profile.md](./04-features/02-student-dashboard-profile.md) |
| Browsing tests and the class/subject tree | [04-features/03-test-browsing.md](./04-features/03-test-browsing.md) |
| Taking a test (start, answer, pause, submit, result) | [04-features/04-test-attempts.md](./04-features/04-test-attempts.md) |
| Checkout, payments, coupons, bundles | [04-features/05-payments-and-commerce.md](./04-features/05-payments-and-commerce.md) |
| Admin panel (content and commerce management) | [04-features/06-admin-panel.md](./04-features/06-admin-panel.md) |
| Coaching centres (B2B layer) | [04-features/07-coaching-b2b.md](./04-features/07-coaching-b2b.md) |
| Notifications and the weekly-report job | [04-features/08-notifications-and-cron.md](./04-features/08-notifications-and-cron.md) |

## The one rule to remember

The web app shares its MySQL database with a **mobile app that is live in production**. Some tables belong to the old system and the mobile app reads them directly. **Never run `npx prisma db push`** and never alter legacy tables casually. The full rules are in [06-shared-database-contract.md](./06-shared-database-contract.md).
