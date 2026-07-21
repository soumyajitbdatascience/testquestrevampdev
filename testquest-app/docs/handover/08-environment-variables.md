# 8. Environment variables

> **What this file tells you:** every configuration setting the app reads, what it does, and where it's used. The real values live in `.env` (never committed to git) — locally on your machine and on the server at `/var/www/testquest/testquest-app/.env`.

## The variables

| Variable | What it is | Used by |
|---|---|---|
| `DATABASE_URL` | MySQL connection string (`mysql://user:password@srv1633.hstgr.io:3306/dbname`). **One shared live database** — treat it as production. | Prisma ([prisma/schema.prisma](../../prisma/schema.prisma), [src/lib/db.ts](../../src/lib/db.ts)) |
| `JWT_SECRET` | The key that signs every login token. Anyone holding it can forge logins; rotating it signs everyone out. | [src/lib/auth.ts](../../src/lib/auth.ts) |
| `NEXT_PUBLIC_APP_URL` | The site's public URL (`https://www.testquest.in`). Used to build absolute links in emails, invites, and Razorpay callbacks. | mail/invite/checkout code |
| `GOOGLE_CLIENT_ID` | The Google OAuth client id for "Sign in with Google". Must match the client configured in Google Cloud Console. | [src/app/api/auth/google/route.ts](../../src/app/api/auth/google/route.ts) |
| `CRON_SECRET` | Shared secret that protects the weekly-report endpoint from strangers. The caller must send it; the route checks it. | [src/app/api/cron/weekly-reports/route.ts](../../src/app/api/cron/weekly-reports/route.ts) |
| `RAZORPAY_KEY_ID` | Razorpay public key id (currently a **test** key). | [src/lib/razorpay.ts](../../src/lib/razorpay.ts), checkout UI |
| `RAZORPAY_KEY_SECRET` | Razorpay private key (test). | [src/lib/razorpay.ts](../../src/lib/razorpay.ts) |
| `RAZORPAY_WEBHOOK_SECRET` | Verifies that webhook calls really come from Razorpay. | [src/app/api/razorpay/webhook/route.ts](../../src/app/api/razorpay/webhook/route.ts) |
| `SMTP_HOST` | Mail server hostname. | [src/lib/mail.ts](../../src/lib/mail.ts) |
| `SMTP_PORT` | Mail server port (usually 465 or 587). | [src/lib/mail.ts](../../src/lib/mail.ts) |
| `SMTP_USER` | Mail account username. | [src/lib/mail.ts](../../src/lib/mail.ts) |
| `SMTP_PASS` | Mail account password. | [src/lib/mail.ts](../../src/lib/mail.ts) |
| `SMTP_FROM` | The "From:" address on outgoing mail. | [src/lib/mail.ts](../../src/lib/mail.ts) |
| `NODE_ENV` | Set automatically (`development` / `production`); code uses it for dev-only behaviour. Don't set by hand. | throughout |

## Setting up a local `.env`

Create `testquest-app/.env` with the variables above. Minimum to boot the app: `DATABASE_URL` and `JWT_SECRET`. Google login, payments, and email each stay dormant until their variables are present. Ask the outgoing team for working values through a secure channel (password manager or similar) — **never by email/chat, and never commit `.env`**.

## Changing values in production

Edit `/var/www/testquest/testquest-app/.env` on the VPS, then rebuild/restart (`npm run build && pm2 restart …` — see [09-deployment-operations.md](./09-deployment-operations.md)). Next.js bakes `NEXT_PUBLIC_*` values in at build time, so a change to `NEXT_PUBLIC_APP_URL` specifically requires a rebuild, not just a restart.

## Rotation after handover

`JWT_SECRET`, `DATABASE_URL` (password part), Razorpay keys, and SMTP credentials should all be rotated once the previous team's access ends — checklist in [10-accounts-checklist.md](./10-accounts-checklist.md).
