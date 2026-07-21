# 1. Overview

> **What this file tells you:** what Testquest is as a product, what technology it is built with, and what to read in your first week.

## What Testquest is

Testquest is an online test-practice platform for Indian school students in Classes 6–12. Students sign up, browse tests for their class and subject, take timed tests online, and see their scores and answer reviews. Some tests are free; others are paid and unlocked by purchasing online.

There is also a **coaching-centre layer** (B2B): coaching institutes can sign up, create student batches, assign tests to their students, invite teachers, and send progress reports to parents — all under their own logo and colours (white-labelling).

- **Live site:** https://www.testquest.in
- **Two admin surfaces:** `/admin` (platform owner) and `/coaching` (coaching-centre staff)
- **Roles today:** Student, Admin, and coaching-centre roles (owner/teacher). 

## The one unusual thing about this project

Testquest is a **rebuild** of an older PHP website. The old website is gone, but a **mobile app built on the old system is still live in production** and uses the **same MySQL database**. So the database contains:

- **94 legacy tables** (old naming, e.g. `student`, `main_exam`, `catigories` — yes, misspelled) that the mobile app still uses. The web app reads them through database *views* (saved, read-only queries) and writes to a few of them carefully.
- **19 new tables**, all prefixed `tq_` (e.g. `tq_orders`, `tq_batches`), which only the web app uses.

This is why the database rules in [06-shared-database-contract.md](./06-shared-database-contract.md) matter so much.

## Technology used

| Piece | Choice | In one line |
|---|---|---|
| Framework | **Next.js 16** (App Router) | React framework; pages and API endpoints live together in `src/app/` |
| Language | **TypeScript** (strict) | JavaScript with types |
| Database | **MySQL** on Hostinger (shared with the mobile app) | Host `srv1633.hstgr.io` |
| Database access | **Prisma 6** for `tq_*` tables; **raw SQL** for legacy tables | Prisma is a library that talks to the database with type-safe code |
| UI | **Tailwind CSS v4** + **shadcn/ui** components | Utility-class styling; light theme by default (purple brand), dark available via toggle |
| Login sessions | **JWT in an httpOnly cookie** | A signed token stored in a cookie the browser's JavaScript cannot read |
| Payments | **Razorpay** (currently on *test* keys — see [12-known-gaps-and-risks.md](./12-known-gaps-and-risks.md)) | Indian payment gateway |
| Input checking | **Zod** | Every API validates its input with a Zod schema |
| Email | **Nodemailer over SMTP** | Password resets, invites, reports |
| Hosting | **Hostinger VPS** with Nginx + PM2 | See [09-deployment-operations.md](./09-deployment-operations.md) |

## Your first week

1. Get the site running locally: clone the repo, create `.env` (see [08-environment-variables.md](./08-environment-variables.md)), then `npm install` and `npm run dev`.
2. Read [02-architecture.md](./02-architecture.md) and [06-shared-database-contract.md](./06-shared-database-contract.md).
3. Click through the product as a student (signup → browse tests → take a free test) and as admin (`/admin/login`).
4. Skim [03-file-structure.md](./03-file-structure.md), then read the feature file in [04-features/](./04-features/) for whatever you work on first.
5. For deeper product background, read [../USER_JOURNEY.md](../USER_JOURNEY.md) — the full product and flow reference written during the build.

## Other useful documents in this repo

- [../../CLAUDE.md](../../CLAUDE.md) — a dense engineer-oriented cheat sheet of the same facts covered here.
- [../USER_JOURNEY.md](../USER_JOURNEY.md) — product flows and the history of design decisions (see its §9).
- Full index of every older document: end of [12-known-gaps-and-risks.md](./12-known-gaps-and-risks.md).
