# Hostinger Deployment Guide — Testquest (Next.js 16)

> **Target: Hostinger VPS** (primary) or **Cloud Hosting with Node.js** (variant in §A2).
> Status after prep: production build passes (exit 0), production server boots and serves the live DB with **no runtime errors**. What remains is host setup + production env values.

---

## 0. What you're deploying

A full **server-rendered Next.js 16 app** — SSR pages, ~40 API routes, Edge middleware, Prisma/MySQL. It runs as a **long-lived Node process** behind a reverse proxy. Not static, not PHP.

The MySQL DB already lives on Hostinger (`srv1633.hstgr.io`) and is **shared with the production mobile app**, so the schema + every `tq_*` migration (incl. migration 20) is **already applied**. **There is no DB migration step at deploy time.**

Two supported tracks:
- **Track A1 — VPS** (recommended): full root, Node + PM2 + Nginx. §3–§5.
- **Track A2 — Cloud Hosting w/ Node.js**: hPanel "Setup Node.js App", no shell daemon mgmt. §A2.

Everything else (env, Razorpay, cron, smoke tests) is shared and applies to both.

---

## 1. Already fixed in the repo (so the host build won't fail)

Committed — you don't need to redo these:

1. **Build generates the Prisma client on the host.** `src/generated/prisma` is gitignored, so a fresh clone has no client. Added:
   - `"build": "prisma generate && next build"`
   - `"postinstall": "prisma generate"`
   This also ensures the **Linux** query-engine binary is generated on the server (your laptop produces a macOS one that must never be shipped).
2. **Node pinned** — `"engines": { "node": ">=20.0.0" }` + `.nvmrc` = `22`.
3. **`tsx` added to devDependencies** — needed by `seed:coaching` + migration scripts.

Verified locally: `npm install` → postinstall generates client → `npm run build` exits 0 → `npm run start` boots and serves `/` and `/tests` (200), `/api/auth/me` (401), `/coaching/billing` (307). No runtime errors.

---

## 2. Production `.env` (do this once, on the server — never commit it)

Every variable, what to set, and why:

| Variable | Dev value | **Production value** | Action |
|---|---|---|---|
| `DATABASE_URL` | Hostinger MySQL URL | **Keep as-is** | Same shared DB (already migrated). |
| `JWT_SECRET` | dev string | **CHANGE → new 48+ char random** | `openssl rand -base64 48`. Rotating it logs everyone out (fine at launch). |
| `JWT_EXPIRES_IN` | `7d` | `7d` | Keep. |
| `RAZORPAY_KEY_ID` | `rzp_test_…` | test now → **`rzp_live_…`** at go-live | Keep test keys for staging; swap after KYC. |
| `RAZORPAY_KEY_SECRET` | test secret | live secret at go-live | Server-only; never reaches frontend. |
| `RAZORPAY_WEBHOOK_SECRET` | `""` | **SET → dashboard webhook secret** (§6) | Required for recurring + reliable confirmation. |
| `GOOGLE_CLIENT_ID` / `_SECRET` | `""` | set only if using Google login | Else leave empty (feature off). |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | `""` | mirror of `GOOGLE_CLIENT_ID` if used | Public copy. |
| `SMTP_HOST/PORT/USER/PASS/FROM` | mostly `""` | **SET** for real emails | Without it, reset/notification emails only log to console. Use a domain you control for `SMTP_FROM`. |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | **CHANGE → `https://yourdomain.com`** | Used for absolute links (invite/welcome URLs). Must be the real public HTTPS URL. |
| `CRON_SECRET` | `test-secret` | **CHANGE → new random** | Guards `/api/cron/weekly-reports`. |

**Minimum to launch on staging (test payments):** change `JWT_SECRET`, `NEXT_PUBLIC_APP_URL`, `CRON_SECRET`; keep Razorpay **test** keys; set webhook secret + SMTP when ready.
**Full go-live:** also swap Razorpay → live keys + live webhook secret, and set SMTP.

---

# Track A1 — VPS (recommended)

## 2.5 Buying & preparing the VPS (before any code)

> Your **MySQL database is a separate Hostinger service** (`srv1633.hstgr.io`) shared with the mobile app. Buying a VPS only adds **app compute** — the DB does not move, and there is **no data migration**. The VPS will connect to that same DB over the network via `DATABASE_URL`.

**Step-by-step to go from "no VPS" to "SSH-ready box":**

1. **Buy the VPS.** hPanel → **VPS** → purchase a **KVM** plan.
   - **Minimum: KVM 1** (1 vCPU / 4 GB RAM) — enough for MVP/launch. Go **KVM 2** (2 vCPU / 8 GB) if you expect real traffic at launch; Next.js builds are memory-hungry and 4 GB can be tight during `npm run build` (mitigation in the note below).
2. **Pick the OS template:** **Ubuntu 22.04 (or 24.04) LTS, plain** — *not* a "with control panel" image. Avoid the CyberPanel/cPanel templates; you want a clean box you control. (If you want a panel later, that's a separate choice.)
3. **Set the root password** during setup and **save it** (you'll need it for first SSH).
4. **Choose the datacenter:** **India (or closest to your users)** — keeps latency low to both users and the Hostinger MySQL host.
5. **Note the VPS public IP** (hPanel → VPS → Overview). You'll point DNS at it and SSH to it.
6. **Allowlist the VPS IP on the database (important).** Hostinger Remote MySQL often restricts which hosts can connect. In **hPanel → (the DB's hosting account) → Databases → Remote MySQL**, add the **VPS public IP** to the allowed-hosts list. If you skip this, the app builds fine but every DB query fails at runtime. (If the DB account already allows `%`/any host, you're done — verify in §2.6.)
7. **First SSH in:**
   ```bash
   ssh root@YOUR_VPS_IP        # use the root password you set
   ```
8. **Harden a little (recommended, optional):** create a non-root sudo user, add your SSH key, and enable the firewall:
   ```bash
   adduser deploy && usermod -aG sudo deploy
   # (from your laptop) ssh-copy-id deploy@YOUR_VPS_IP
   ufw allow OpenSSH && ufw allow 'Nginx Full' && ufw enable
   ```
   Then do the rest of this guide as `deploy` (or stay as root for MVP — your call).
9. **Point DNS now (so TLS works later):** in your domain's DNS, create an **A record** → `yourdomain.com` → `YOUR_VPS_IP` (and `www` too). DNS can take time to propagate; doing it now means it's ready by §5.

> **4 GB build OOM mitigation:** if `npm run build` gets killed on KVM 1, add swap once:
> ```bash
> sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
> sudo mkswap /swapfile && sudo swapon /swapfile
> echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
> ```

## 2.6 Verify the VPS can reach the database (before deploying)

From the VPS shell, confirm the network path to MySQL works — catches the Remote-MySQL allowlist issue early:

```bash
# install a mysql client if needed
sudo apt update && sudo apt install -y mysql-client
# try to connect (password is in your DATABASE_URL, URL-decoded)
mysql -h srv1633.hstgr.io -u u710649289_arj26_testques -p u710649289_testquest_db26 -e "SELECT 1;"
```
- `1` printed → ✅ the VPS can reach the DB; proceed to §3.
- `Host '…' is not allowed` / timeout → go back to §2.5 step 6 and allowlist the VPS IP.

## 3. Provision the VPS (one-time)

SSH in, then:

```bash
# Node 22 via nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc
nvm install 22 && nvm use 22 && nvm alias default 22

# PM2 (keeps the app alive, restarts on crash/reboot)
npm install -g pm2

# Nginx (reverse proxy + TLS) — install if not present
sudo apt update && sudo apt install -y nginx
```

## 4. Deploy the app

```bash
cd /var/www
git clone <your-repo-url> testquest
cd testquest/testquest-app          # the app lives in this subfolder

nano .env                            # paste the production values from §2

npm ci                               # postinstall runs `prisma generate` (Linux engine)
npm run build                        # runs `prisma generate && next build`

pm2 start "npm run start" --name testquest   # serves on port 3000
pm2 save
pm2 startup                          # run the printed command so it survives reboot
```

To use a different port: `PORT=8080 pm2 start "npm run start" --name testquest`.

## 5. Nginx reverse proxy + HTTPS

Point your domain's DNS **A-record** at the VPS IP first. Then:

```nginx
# /etc/nginx/sites-available/testquest
server {
    server_name yourdomain.com www.yourdomain.com;
    client_max_body_size 6M;         # logo/CSV/xlsx uploads (app caps at 2–5MB)

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/testquest /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# Free TLS
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

After TLS: confirm `NEXT_PUBLIC_APP_URL=https://yourdomain.com` in `.env`, then `pm2 restart testquest`.

**Cron (weekly reports) — VPS:** `vercel.json`'s cron only works on Vercel. Add a system crontab:
```bash
crontab -e
30 3 * * 0 curl -s -X POST https://yourdomain.com/api/cron/weekly-reports -H "Authorization: Bearer YOUR_CRON_SECRET" >/dev/null 2>&1
```

→ continue to **§6 Razorpay webhook**, then **§7 smoke test**.

---

# Track A2 — Cloud Hosting with Node.js (hPanel)

Use this if you're on Cloud Hosting rather than a raw VPS. No PM2/Nginx — hPanel manages the Node process and proxying.

1. **hPanel → Websites → your site → Setup Node.js App** (a.k.a. "Node.js App").
2. **Node version:** pick **20 or 22** (must be ≥20).
3. **Application root:** the folder containing the app — point it at `…/testquest-app` (the subfolder, where `package.json` lives), not the repo root.
4. **Application startup file / command:**
   - Build command: `npm run build`
   - Start command: `npm run start` (Next serves on the port hPanel injects via `PORT`; `next start` honors it).
5. **Environment variables:** add every var from §2 in the hPanel env UI (this replaces the `.env` file). Set `NEXT_PUBLIC_APP_URL` to your real HTTPS domain.
6. **Get the code in:** upload via Git deploy (if offered) or the File Manager; ensure the app subfolder is the application root.
7. **Install + build:** hPanel runs `npm install` (→ `postinstall` generates the Linux Prisma engine) then your build command. Click **Restart** after the first build.
8. **HTTPS:** hPanel → SSL → issue a free certificate for the domain.

**Cron — Cloud:** hPanel → **Cron Jobs** → add:
```
30 3 * * 0   curl -s -X POST https://yourdomain.com/api/cron/weekly-reports -H "Authorization: Bearer YOUR_CRON_SECRET"
```

> Note on uploads: logo/report files write to `public/uploads/`. On Cloud Hosting this is persistent, but if hPanel rebuilds into a fresh app dir on each deploy, older uploads may not carry over — fine for launch; migrate to S3/Cloudinary later (`UPLOADS_V2_TODO` marker in `src/app/api/coaching/setup/logo/route.ts`).

→ continue to **§6**, then **§7**.

---

## 6. Razorpay webhook (required for reliable payment confirmation + recurring)

1. Razorpay Dashboard → Settings → **Webhooks** → Add.
2. URL: `https://yourdomain.com/api/razorpay/webhook`
3. Events: `payment.captured`, `payment.failed`, `subscription.authenticated`, `subscription.charged`, `subscription.pending`, `subscription.halted`, `subscription.cancelled`.
4. Copy the **signing secret** → set `RAZORPAY_WEBHOOK_SECRET` → restart the app (`pm2 restart testquest` on VPS, or **Restart** in hPanel).

> Until this is set, the webhook returns 401 and recurring auto-renew won't activate. One-time payments still confirm via the synchronous verify endpoints.

---

## 7. Post-deploy smoke test

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://yourdomain.com/                 # 200
curl -s -o /dev/null -w "%{http_code}\n" https://yourdomain.com/tests            # 200
curl -s -o /dev/null -w "%{http_code}\n" https://yourdomain.com/api/auth/me      # 401 (no cookie)
curl -s -o /dev/null -w "%{http_code}\n" https://yourdomain.com/coaching/billing # 307 → /coaching/login
```
Then browser-test: admin login, a B2C signup, and a Razorpay test-card payment (see `docs/MANUAL_TEST_CASES.md`).

---

## 8. Redeploys

**VPS:**
```bash
cd /var/www/testquest/testquest-app
git pull
npm ci                # only if deps changed
npm run build
pm2 restart testquest
```
**Cloud:** push/upload new code → hPanel **Restart** (it reinstalls + rebuilds). 

---

## 9. Compatibility checklist (verified)

- [x] Production build passes (`npm run build` exit 0)
- [x] Production server boots (`npm run start`) and serves the live DB
- [x] No build/runtime errors; only a non-blocking `middleware→proxy` deprecation warning
- [x] Prisma client generates on the host (build + postinstall hooks added)
- [x] Node engine pinned (`.nvmrc`, `engines`)
- [x] DB already migrated (shared with mobile app) — no migration step
- [ ] Node-capable plan provisioned (VPS or Cloud-with-Node) — **you're upgrading to this**
- [ ] `JWT_SECRET`, `NEXT_PUBLIC_APP_URL`, `CRON_SECRET` set to production values
- [ ] Razorpay webhook secret (+ live keys at go-live)
- [ ] SMTP set for real emails
```
