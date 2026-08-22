# 9. Deployment & operations runbook

> **What this file tells you:** how the production server is actually set up, how to deploy a change, and how to check on and restart the app. This reflects the **as-built server**, reconstructed from the real setup history.

## The production server at a glance

| Item | Value |
|---|---|
| Host | Hostinger VPS `srv1721340` (Ubuntu), login user `deploy` |
| Domain | `testquest.in` + `www.testquest.in` → this VPS |
| Web server | **Nginx** — terminates HTTPS, proxies to the app on `127.0.0.1:3000`; site config at `/etc/nginx/sites-available/testquest`; `client_max_body_size 6M` (raise this if uploads ever exceed 6 MB) |
| App runtime | **Node 22 via nvm**, app kept alive by **PM2** (a process manager that restarts the app if it crashes and starts it on boot) |
| App location | `/var/www/testquest/testquest-app` — a git clone of `github.com/soumyajitbdatascience/testquestrevampdev` |
| Config | `.env` created by hand at `/var/www/testquest/testquest-app/.env` (never in git) |
| Database | **Not on this VPS** — remote shared MySQL at `<db-host>` (`mysql-client` is installed for manual checks) |
| Firewall | `ufw` allowing only OpenSSH and "Nginx Full" (80/443) |
| Memory | 2 GB swapfile added (Next.js builds are memory-hungry on small VPSes) |

> **Verify on server** (not captured in the setup history — check once and update this file):
> - The PM2 app name and start command: run `pm2 list` (expect something like `pm2 start npm --name testquest -- start`).
> - HTTPS/certificate setup: the site serves HTTPS, presumably via certbot/Let's Encrypt — confirm with `ls /etc/letsencrypt/live` and that auto-renewal works (`sudo certbot renew --dry-run`).
> - That the Nginx site is enabled: `ls -l /etc/nginx/sites-enabled/`.
> - **The weekly-report cron**: [vercel.json](../../vercel.json) only schedules it on Vercel, which this server is not. Check `crontab -l` for an entry calling `/api/cron/weekly-reports` with the `CRON_SECRET` header. If absent, weekly parent reports are **not being sent** — add:
>   `30 3 * * 0 curl -fsS -H "Authorization: Bearer <CRON_SECRET>" https://www.testquest.in/api/cron/weekly-reports`

## Everyday task: deploying a change

```bash
ssh deploy@<vps-ip>
cd /var/www/testquest
git pull
cd testquest-app
npm install                # also regenerates the Prisma client (postinstall)
npm run build              # prisma generate && next build
pm2 restart <app-name>     # get the name from: pm2 list
```

Then smoke-test (below). If the build fails on memory, confirm swap is active: `free -h`.

## Smoke test after every deploy

1. `curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3000/` on the server → expect `200`.
2. Open https://www.testquest.in — landing page loads.
3. Log in as a student; open the test catalogue (proves DB connectivity).
4. Log in at `/admin/login`; open the orders page.
5. `pm2 logs <app-name> --lines 50` — no fresh errors.

## Checking on the app

| Task | Command |
|---|---|
| Is the app up? | `pm2 list` |
| App logs (live) | `pm2 logs <app-name>` |
| Restart the app | `pm2 restart <app-name>` |
| Survive a reboot | `pm2 save` once after changes; `pm2 startup` was/should be configured |
| Test Nginx config after editing | `sudo nginx -t` then `sudo systemctl reload nginx` |
| Nginx logs | `/var/log/nginx/access.log`, `/var/log/nginx/error.log` |
| Manual DB check | `mysql -h <db-host> -u <db-user> -p <db-name>` |
| Disk/memory | `df -h`, `free -h` |

## First-time server setup (for reference / rebuilding the server)

This is the cleaned-up sequence that built the current server:

```bash
# 1. Firewall
sudo ufw allow OpenSSH && sudo ufw allow 'Nginx Full' && sudo ufw enable

# 2. Swap (2 GB)
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# 3. Node 22 via nvm + PM2
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc
nvm install 22 && nvm alias default 22
npm install -g pm2

# 4. Nginx + MySQL client
sudo apt update && sudo apt install -y nginx mysql-client

# 5. App
cd /var/www
sudo git clone https://github.com/soumyajitbdatascience/testquestrevampdev.git testquest
cd testquest/testquest-app
sudo vim .env               # paste the environment variables (see 08-environment-variables.md)
npm install && npm run build
pm2 start npm --name testquest -- start && pm2 save

# 6. Nginx site: proxy testquest.in + www → 127.0.0.1:3000
sudo tee /etc/nginx/sites-available/testquest > /dev/null << 'EOF'
server {
    server_name testquest.in www.testquest.in;
    client_max_body_size 6M;
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
EOF
sudo ln -s /etc/nginx/sites-available/testquest /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# 7. HTTPS (Let's Encrypt)
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d testquest.in -d www.testquest.in
```

## Notes

- **No CI/CD exists** — deploys are the manual steps above. Adding a GitHub Action (build check on push, or SSH deploy) is a recommended early improvement.
- There is no staging environment; the app and its one database are production. Test risky changes locally first.
- [../HOSTINGER_DEPLOYMENT.md](../HOSTINGER_DEPLOYMENT.md) is the older, more general deployment guide written before the VPS was built; this file reflects what actually runs.
