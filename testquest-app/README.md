# Testquest

Online test-practice platform for Indian school students (Classes 6–12), with a white-labelled portal for coaching centres. Live at **https://www.testquest.in**.

Built with Next.js 16 (App Router), TypeScript, Prisma 6, MySQL, Tailwind v4 + shadcn/ui, and Razorpay.

## 📦 New here? Start with the handover pack

**[docs/handover/README.md](./docs/handover/README.md)** — plain-English documentation of the architecture, every feature (which files and database tables power it), UI theming, deployment, and operations.

⚠️ Before touching the database, read [docs/handover/06-shared-database-contract.md](./docs/handover/06-shared-database-contract.md) — this app shares its MySQL database with a mobile app that is live in production. Never run `npx prisma db push`.

## Quick start (local development)

```bash
git clone <this repo> && cd testquest-app
# create .env — see docs/handover/08-environment-variables.md for every variable
npm install          # also generates the Prisma client
npm run dev          # http://localhost:3000
```

Requires Node 22 (`.nvmrc`). Minimum `.env` to boot: `DATABASE_URL` and `JWT_SECRET`.

## Common commands

```bash
npm run dev              # dev server
npm run build            # production build (prisma generate + next build)
npm run lint             # ESLint
npx tsc --noEmit         # type check
npx prisma studio        # visual DB browser
npx tsx prisma/migration/apply-views.ts   # (re)create the 9 vw_* views
```

## Deployment

Production runs on a Hostinger VPS (Nginx → PM2 → `next start`). Full runbook: [docs/handover/09-deployment-operations.md](./docs/handover/09-deployment-operations.md).
