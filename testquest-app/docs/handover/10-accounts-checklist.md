# 10. Accounts & credentials — transfer checklist

> **What this file tells you:** every third-party account the platform depends on, what must be handed to the new team, and which secrets to rotate afterwards. **This document contains no secret values** — pass actual credentials through a password manager or another secure channel, never email or chat.

## Accounts to transfer

| # | Account | What it's for | What to hand over |
|---|---|---|---|
| 1 | **Hostinger — VPS** (`srv1721340`) | Runs the website | Hostinger panel access (or a separate sub-user), SSH access for user `deploy` (add the new team's SSH public keys, then remove old ones) |
| 2 | **Hostinger — MySQL** (`srv1633.hstgr.io`) | The shared database (⚠ also used by the production **mobile app** — coordinate any credential change with whoever runs the mobile app's backend config) | DB host, database name, username, password; access to Hostinger's DB panel/phpMyAdmin for backups |
| 3 | **Domain & DNS** for `testquest.in` | Points the domain at the VPS | Registrar login or domain transfer; document current DNS records before changing anything |
| 4 | **Razorpay** | Payments (currently **test mode**) | Razorpay dashboard ownership; when going live: generate live keys, set the webhook URL to `https://www.testquest.in/api/razorpay/webhook` with a webhook secret |
| 5 | **SMTP / email provider** | Password resets, OTPs, invites, parent reports | The mail account behind the `SMTP_*` variables; check sending domain/SPF/DKIM settings move too |
| 6 | **Google Cloud Console — OAuth client** | "Sign in with Google" | Ownership of the Google Cloud project holding the OAuth client (`GOOGLE_CLIENT_ID`); its authorised origins must include `https://www.testquest.in` |
| 7 | **GitHub repository** (`soumyajitbdatascience/testquestrevampdev`) | The source code; the VPS pulls from it | Transfer the repo (or move it to the client's organisation); update the git remote on the VPS if the URL changes |
| 8 | **Seeded admin account** (`admin@testquest.in`) | The platform admin login | Tell the new team it exists — then **change its password immediately** (it shipped with a well-known default) |

## Secret rotation after handover

Once the outgoing team's access is removed, rotate everything they ever held, in this order:

1. **Seeded admin password** — log in at `/admin/login` and change it (or update the bcrypt hash in `tq_admins`). Do this first; it's public knowledge (documented in this repo).
2. **`JWT_SECRET`** — generate a long random value, update `.env` on the VPS, rebuild + restart. Side effect: every user is signed out once.
3. **Database password** — change in the Hostinger panel, update `DATABASE_URL` in `.env`, rebuild + restart. ⚠ **The mobile app's backend uses the same database** — coordinate, or its connection breaks.
4. **Razorpay keys** — regenerate in the Razorpay dashboard (or simply switch to live keys as part of go-live), update the three `RAZORPAY_*` variables, rebuild + restart.
5. **SMTP password** — change at the provider, update `SMTP_PASS`, rebuild + restart.
6. **SSH access** — remove old public keys from `~/.ssh/authorized_keys` on the VPS; consider disabling password SSH login.
7. **Google OAuth** — if the Cloud project can't be transferred, create a new OAuth client in the client's own project and swap `GOOGLE_CLIENT_ID`.

After each `.env` change: `npm run build && pm2 restart <app-name>` on the server, then run the smoke test in [09-deployment-operations.md](./09-deployment-operations.md).

## Also confirm during handover

- Where database **backups** live and their schedule (Hostinger auto-backups? manual dumps?). If none: set up a scheduled `mysqldump` immediately.
- Who owns/operates the **mobile app** and its backend config — you now share a database with them.
- That the new team has received a filled-in copy of every variable in [08-environment-variables.md](./08-environment-variables.md) via a secure channel.
