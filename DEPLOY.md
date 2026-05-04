# DEPLOY.md - Native Debian Deployment Guide

> **IMPORTANT — Phase 12 (Web Push Notifications):** A new `PushSubscription` table and the `web-push` backend package were added. Before starting the service, run:
> ```bash
> cd backend
> npm ci                    # installs web-push
> npm run prisma:generate
> npm run prisma:apply      # creates PushSubscription table
> npm run build
> ```
> Then generate VAPID keys once and add them to `/etc/teknav/backend.env` (see Section 6). Without VAPID keys the push routes return 503 and push delivery is silently skipped — all other features continue to work normally.

This is the complete production runbook for deploying Teknav natively on Debian, without Docker.

Production model:

- Public site: `https://www.teknav.ir`
- Frontend: Vite build served by nginx from `/opt/teknav/current/dist`
- Backend: Fastify systemd service on `127.0.0.1:3010`
- Database: local PostgreSQL
- Cache/session/SSE bus: local Redis
- Uploads: `/var/lib/teknav/uploads`
- Backups: `/var/backups/teknav`
- Env file: `/etc/teknav/backend.env`

The deployed surface now also includes SEO topic hubs, glossary pages, Q&A, jobs, courses, premium membership, sponsored article labels, verified expert badges, 2FA, article corrections, first-party analytics/error capture, Zarinpal payment flow, and web push notifications (Phase 12).

Run these commands as a sudo-capable Linux user unless a command explicitly uses `sudo -u teknav`.

## 0. Local Development (Windows/Tuned)

If you are running locally and commands like `prisma` or `tsx` are not in your path, use the following "Tuned" commands from the **root** directory:

### Update Database Seed (2026 Content)
```powershell
cd backend
.\node_modules\.bin\tsx prisma\seed.ts
```

### Force Clear Browser Cache (Articles)
If articles are missing or outdated, I have added a `DATA_VERSION` to the frontend. Simply **refresh the page** or clear your `localStorage` in the browser console:
```javascript
localStorage.clear(); window.location.reload();
```

---

## 1. Base OS

Before server setup, point DNS to the server public IP:

```text
www.teknav.ir  A     SERVER_IPV4
teknav.ir      A     SERVER_IPV4
www.teknav.ir  AAAA  SERVER_IPV6   optional
teknav.ir      AAAA  SERVER_IPV6   optional
```

Verify DNS from your workstation:

```bash
dig +short www.teknav.ir
dig +short teknav.ir
```

## 1. Base OS

Use Debian 12/13. Update the server:

```bash
sudo apt update
sudo apt full-upgrade -y
sudo reboot
```

Reconnect, then install base packages:

```bash
sudo apt update
sudo apt install -y \
  ca-certificates \
  curl \
  gnupg \
  git \
  rsync \
  build-essential \
  nginx \
  postgresql \
  postgresql-contrib \
  redis-server \
  certbot \
  python3-certbot-nginx \
  logrotate \
  ufw \
  unzip
```

Install Node.js 20 from NodeSource:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v
npm -v
```

Optional but useful:

```bash
sudo timedatectl set-timezone Asia/Tehran
timedatectl
```

## 2. System User and Directories

Create the non-login service user:

```bash
sudo useradd --system --home /opt/teknav --shell /usr/sbin/nologin teknav || true
```

Create required directories:

```bash
sudo mkdir -p \
  /opt/teknav/current \
  /opt/teknav/releases \
  /etc/teknav \
  /var/lib/teknav/uploads \
  /var/backups/teknav
```

Set ownership and permissions:

```bash
sudo chown -R teknav:teknav /opt/teknav /var/lib/teknav /var/backups/teknav
sudo chown root:teknav /etc/teknav
sudo chmod 755 /opt/teknav
sudo chmod 750 /opt/teknav/current /opt/teknav/releases /var/lib/teknav /var/backups/teknav /etc/teknav
```

## 3. PostgreSQL

Enable PostgreSQL:

```bash
sudo systemctl enable --now postgresql
sudo systemctl status postgresql --no-pager
```

Create a strong database password:

```bash
openssl rand -base64 32
```

Create the database user and database. Replace `CHANGE_ME_STRONG_DB_PASSWORD` first:

```bash
sudo -u postgres psql
```

Inside `psql`:

```sql
CREATE USER teknav WITH PASSWORD 'CHANGE_ME_STRONG_DB_PASSWORD';
CREATE DATABASE teknav OWNER teknav;
\q
```

Confirm local access:

```bash
psql "postgresql://teknav:CHANGE_ME_STRONG_DB_PASSWORD@127.0.0.1:5432/teknav?schema=public" -c "SELECT 1;"
```

Keep PostgreSQL local-only. Confirm it is not listening publicly:

```bash
sudo ss -ltnp | grep 5432
```

## 4. Redis

Enable Redis:

```bash
sudo systemctl enable --now redis-server
sudo systemctl status redis-server --no-pager
redis-cli ping
```

Expected:

```text
PONG
```

Keep Redis local-only. Confirm:

```bash
sudo ss -ltnp | grep 6379
```

## 5. Upload Project Files

Choose one deployment source.

Option A, clone from Git:

```bash
sudo -u teknav git clone REPLACE_WITH_REPO_URL /opt/teknav/current
cd /opt/teknav/current
```

Option B, sync from your local machine to the server:

```bash
rsync -az --delete \
  --exclude node_modules \
  --exclude backend/node_modules \
  --exclude dist \
  --exclude .git \
  --exclude '*.zip' \
  --exclude 'backend/query_engine*.node' \
  --exclude 'backend/query_engine*.node.gz' \
  --exclude 'backend/schema-engine*' \
  --exclude 'backend/schema-engine*.gz' \
  ./ USER@SERVER_IP:/tmp/teknav-upload/

ssh USER@SERVER_IP
sudo rsync -a --delete /tmp/teknav-upload/ /opt/teknav/current/
sudo chown -R teknav:teknav /opt/teknav/current
cd /opt/teknav/current
```

Confirm key files exist:

```bash
test -f package.json
test -f backend/package.json
test -f backend/prisma/schema.prisma
test -f nginx/nginx.conf.example
test -f deploy/systemd/teknav-backend.service
```

## 6. Environment File

Create the production env file:

```bash
cd /opt/teknav/current
sudo cp .env.prod.example /etc/teknav/backend.env
sudo chown root:teknav /etc/teknav/backend.env
sudo chmod 640 /etc/teknav/backend.env
sudo nano /etc/teknav/backend.env
```

Set at least these values:

```env
DATABASE_URL="postgresql://teknav:CHANGE_ME_STRONG_DB_PASSWORD@127.0.0.1:5432/teknav?schema=public"
REDIS_URL="redis://127.0.0.1:6379"
SESSION_SECRET=CHANGE_ME_48_BYTE_RANDOM_SECRET
COOKIE_DOMAIN=.teknav.ir
CORS_ORIGINS=https://www.teknav.ir,https://teknav.ir
OAUTH_CALLBACK_BASE=https://www.teknav.ir
NODE_ENV=production
PORT=3010
UPLOAD_DIR=/var/lib/teknav/uploads
BACKUP_DIR=/var/backups/teknav
LOG_LEVEL=info
```

Generate `SESSION_SECRET`:

```bash
openssl rand -base64 48
```

Set SMTP when email verification, password reset, campaign sending, and the weekly digest should work. If `SMTP_HOST` is empty, email jobs log what they would send and do not deliver mail:

```env
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
SMTP_FROM=no-reply@teknav.ir
```

Set SMS OTP through Kavenegar:

```env
SMS_PROVIDER=kavenegar
SMS_API_KEY=...
SMS_SENDER=
```

Web push notifications (Phase 12). Generate VAPID keys once on the server:

```bash
node -e "const wp = require('web-push'); const k = wp.generateVAPIDKeys(); console.log(JSON.stringify(k,null,2))"
```

Then add to `/etc/teknav/backend.env`:

```env
VAPID_PUBLIC_KEY=<paste_generated_public_key>
VAPID_PRIVATE_KEY=<paste_generated_private_key>
VAPID_SUBJECT=mailto:admin@teknav.ir
```

If these are not set, the push endpoints return 503 and `sendPushToUser` is a no-op — no crash, no side effects. Set them before announcing push to users.

Zarinpal payment gateway (required for membership subscriptions; until set, subscribe endpoint returns `payment_unavailable`):

```env
ZARINPAL_MERCHANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
ZARINPAL_SANDBOX=0
MEMBERSHIP_PRICE_IRR=5000000
MEMBERSHIP_DURATION_DAYS=365
```

File storage — **local disk is the default and requires no env vars**. Uploads go to `UPLOAD_DIR` (default `/var/lib/teknav/uploads`). S3-compatible storage is a future option wired but not yet active:

```env
# Leave unset (or set to "local") to use local disk — recommended for now
# STORAGE_BACKEND=local

# S3 migration (Phase 12+): uncomment and fill in when needed
# STORAGE_BACKEND=s3
# S3_ENDPOINT=https://storage.example.ir
# S3_BUCKET=teknav-uploads
# S3_ACCESS_KEY=...
# S3_SECRET_KEY=...
```

OAuth callback URLs, if Google/GitHub login is enabled:

```text
https://www.teknav.ir/api/auth/oauth/google/callback
https://www.teknav.ir/api/auth/oauth/github/callback
```

Validate env file readability for the service user:

```bash
sudo -u teknav test -r /etc/teknav/backend.env
```

## 7. Install Dependencies

Use the committed lockfiles and install dependencies on the Linux host. Do not copy `node_modules`, generated Prisma engines, or any Windows-generated Prisma binaries from a workstation.

```bash
cd /opt/teknav/current
sudo -u teknav npm ci
```

Install backend dependencies:

```bash
cd /opt/teknav/current/backend
sudo -u teknav npm ci
```

If the server has enough memory and native image conversion is required, ensure optional `sharp` installed successfully:

```bash
cd /opt/teknav/current/backend
sudo -u teknav npm ls sharp || true
```

## 8. Prisma Generate, Schema Apply, and Seed

Generate Prisma client:

```bash
cd /opt/teknav/current/backend
sudo -u teknav npm run prisma:generate
```

This must run on the Linux server after `npm ci`. Prisma downloads/generates platform-specific engines for the target host; Windows-generated `query_engine*.node` and `schema-engine*` files are local artifacts and must not be deployed.

Apply schema:

```bash
sudo -u teknav npm run prisma:apply
```

`prisma:apply` is intentional. It uses migrations if they exist and falls back to `prisma db push --skip-generate` while this repo has no full migrations directory.

Seed production data:

```bash
sudo -u teknav npm run seed
```

Important:

- Operator-facing seed credentials are in root `ACCOUNTS.md`.
- `ACCOUNTS.md` is gitignored and nginx-blocked.
- Every seeded user gets a URL-safe username and can log in with email or `@username`.
- Rotate all seeded passwords after first login.
- After rotation, remove `resetPasswordOnSeed` for accounts that must not be reset on future seeds.

## 9. Generate SEO Assets and Build

Generate crawler artifacts:

```bash
cd /opt/teknav/current
sudo -u teknav npm run seo:sitemap
```

Generate local Open Graph images:

```bash
sudo -u teknav npm run og:images
```

Build frontend:

```bash
sudo -u teknav npm run build
```

Build backend:

```bash
cd /opt/teknav/current/backend
sudo -u teknav npm run build
```

Confirm build output:

```bash
test -f /opt/teknav/current/dist/index.html
test -f /opt/teknav/current/public/sitemap.xml
test -f /opt/teknav/current/public/robots.txt
test -f /opt/teknav/current/public/feed.xml
test -f /opt/teknav/current/public/feeds/topic-ai.xml
test -f /opt/teknav/current/backend/dist/src/server.js
```

## 10. systemd Services and Timers

Install units:

```bash
cd /opt/teknav/current
sudo cp deploy/systemd/*.service /etc/systemd/system/
sudo cp deploy/systemd/*.timer /etc/systemd/system/
sudo cp deploy/logrotate/teknav /etc/logrotate.d/teknav
sudo chmod 644 /etc/systemd/system/teknav-*.service /etc/systemd/system/teknav-*.timer
sudo chmod 644 /etc/logrotate.d/teknav
sudo chmod +x scripts/systemd-backup.sh
sudo systemctl daemon-reload
```

Start backend:

```bash
sudo systemctl enable --now teknav-backend.service
sudo systemctl status teknav-backend.service --no-pager
```

Start scheduled publishing and backups:

```bash
sudo systemctl enable --now teknav-publish-due.timer
sudo systemctl enable --now teknav-weekly-digest.timer
sudo systemctl enable --now teknav-backup.timer
sudo systemctl list-timers 'teknav-*'
```

Useful service commands:

```bash
sudo journalctl -u teknav-backend -f
sudo systemctl restart teknav-backend
sudo systemctl start teknav-migrate
sudo journalctl -u teknav-migrate -n 100 --no-pager
sudo systemctl start teknav-publish-due
sudo systemctl start teknav-weekly-digest
sudo systemctl start teknav-backup
```

Local backend health before nginx:

```bash
curl -fsS http://127.0.0.1:3010/api/health
```

Expected:

```json
{"ok":true,"postgres":true,"redis":true}
```

## 11. nginx Before TLS

The repository nginx template contains placeholder certificate paths for an already-provisioned certificate. For a fresh Certbot install, create a temporary HTTP-only nginx config first:

```bash
sudo tee /etc/nginx/sites-available/teknav >/dev/null <<'NGINX'
server {
    listen 80;
    listen [::]:80;
    server_name teknav.ir www.teknav.ir;

    root /opt/teknav/current/dist;
    index index.html;
    charset utf-8;

    location = /ACCOUNTS.md {
        deny all;
        return 404;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3010;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";
    }

    location /uploads/ {
        alias /var/lib/teknav/uploads/;
        try_files $uri =404;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
NGINX
```

Enable site:

```bash
sudo ln -sf /etc/nginx/sites-available/teknav /etc/nginx/sites-enabled/teknav
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl enable --now nginx
sudo systemctl reload nginx
```

Confirm HTTP works:

```bash
curl -I http://www.teknav.ir/
curl -fsS http://www.teknav.ir/api/health
```

## 12. TLS with Certbot

Issue certificates:

```bash
sudo certbot --nginx -d www.teknav.ir -d teknav.ir
```

Choose redirect to HTTPS when Certbot asks.

Test renewal:

```bash
sudo certbot renew --dry-run
```

## 13. Final nginx Production Config

Install the production nginx template:

```bash
cd /opt/teknav/current
sudo cp nginx/nginx.conf.example /etc/nginx/sites-available/teknav
```

Edit certificate paths in `/etc/nginx/sites-available/teknav`:

```bash
sudo nano /etc/nginx/sites-available/teknav
```

Replace:

```nginx
ssl_certificate     /etc/nginx/ssl/_.teknav.ir-fullchain.pem;
ssl_certificate_key /etc/nginx/ssl/_.teknav.ir-privateKey.pem;
```

With Certbot paths:

```nginx
ssl_certificate     /etc/letsencrypt/live/www.teknav.ir/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/www.teknav.ir/privkey.pem;
```

Validate and reload:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

The production template does all of this:

- Redirects apex `teknav.ir` to `https://www.teknav.ir`.
- Serves the SPA from `dist/`.
- Proxies `/api/` to Fastify.
- Disables buffering/compression for SSE paths.
- Serves uploads from `/var/lib/teknav/uploads`.
- Blocks dotfiles and `/ACCOUNTS.md`.
- Enables gzip for JS, CSS, JSON, XML, RSS, fonts, and SVG.
- Caches immutable static assets.
- Keeps crawler files public: `/robots.txt`, `/sitemap.xml`, `/feed.xml`.

After the site is stable for a few days, increase HSTS in nginx from one week to one year:

```nginx
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
```

Then:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 14. Firewall

Allow only SSH, HTTP, and HTTPS:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status verbose
```

Confirm private services are not public:

```bash
sudo ss -ltnp | grep -E ':(3010|5432|6379)'
```

Expected listeners should be local only.

## 15. Production Validation

Run these checks after nginx and TLS are live:

```bash
curl -fsS https://www.teknav.ir/api/health
curl -I https://www.teknav.ir/
curl -I https://www.teknav.ir/articles
curl -I https://www.teknav.ir/topics/ai
curl -I https://www.teknav.ir/newsletter
curl -I https://www.teknav.ir/tag/AI
curl -I https://www.teknav.ir/sitemap.xml
curl -I https://www.teknav.ir/robots.txt
curl -I https://www.teknav.ir/feed.xml
curl -I https://www.teknav.ir/feeds/topic-ai.xml
curl -I https://www.teknav.ir/ACCOUNTS.md
```

Expected:

- `/api/health` returns `{"ok":true,"postgres":true,"redis":true}`.
- `/`, `/articles`, `/topics/ai`, `/newsletter`, and a known `/tag/...` page return 200.
- `/robots.txt`, `/sitemap.xml`, `/feed.xml`, and topic/author feeds under `/feeds/` return 200.
- `/ACCOUNTS.md` returns 403 or 404.

Run the production smoke script:

```bash
cd /opt/teknav/current
sudo -u teknav TEKNAV_SMOKE_URL=https://www.teknav.ir npm run smoke:prod
```

Optional custom article smoke list:

```bash
sudo -u teknav TEKNAV_SMOKE_URL=https://www.teknav.ir TEKNAV_SMOKE_ARTICLES=/article/agentic-ai-production,/article/ai-clean-data npm run smoke:prod
```

## 16. Functional Validation Checklist

Validate on Linux/staging or production-like infrastructure:

```bash
cd /opt/teknav/current/backend
sudo -u teknav npm run prisma:generate
sudo -u teknav npm run prisma:apply
sudo -u teknav npm run seed
cd /opt/teknav/current
sudo -u teknav npm run seo:sitemap
sudo -u teknav npm run og:images
sudo -u teknav npm run build
cd /opt/teknav/current/backend
sudo -u teknav npm run build
cd /opt/teknav/current
sudo -u teknav TEKNAV_SMOKE_URL=https://www.teknav.ir npm run smoke:prod
```

Manually verify:

- Login by email.
- Login by `@username`.
- Profile edit rules for reader, writer, editor, reviewer, and admin.
- Password change with current password.
- Comments, likes, and flags.
- Reading history and reading lists.
- Writer follows.
- Topic follow/unfollow on `/topics/ai`.
- Writer panel submission: draft or review only, no direct public publish.
- Reviewer/editor approval publishes only after Phase 10 quality checks pass.
- `GET /api/admin/panel-metrics` returns role-aware dashboard metrics for admin, editor, writer, and reviewer accounts.
- Article share buttons record first-party `share_clicked` events.
- Notifications and SSE.
- Newsletter subscribe/unsubscribe/campaign send and public archive.
- Article series pages.
- Topic hub pages.
- Admin analytics, SEO audit, and review workflow.

## 17. Updates

For a normal update:

```bash
cd /opt/teknav/current
sudo -u teknav git pull
sudo -u teknav npm ci
cd /opt/teknav/current/backend
sudo -u teknav npm ci
sudo -u teknav npm run prisma:generate
sudo -u teknav npm run prisma:apply
cd /opt/teknav/current
sudo -u teknav npm run seo:sitemap
sudo -u teknav npm run og:images
sudo -u teknav npm run build
cd /opt/teknav/current/backend
sudo -u teknav npm run build
sudo systemctl restart teknav-backend
sudo nginx -t
sudo systemctl reload nginx
cd /opt/teknav/current
sudo -u teknav TEKNAV_SMOKE_URL=https://www.teknav.ir npm run smoke:prod
```

Run `npm run seo:sitemap` after changing public routes, article slugs, article dates, categories, authors, topic hubs, newsletter archive routes, series, or crawler files.

Run `npm run og:images` after changing article Open Graph metadata.

## 18. Safer Release Directory Flow

For lower-risk deployments, deploy to a timestamped release and atomically switch `current`:

```bash
RELEASE="$(date +%Y%m%d-%H%M%S)"
sudo mkdir -p "/opt/teknav/releases/$RELEASE"
sudo rsync -a /tmp/teknav-upload/ "/opt/teknav/releases/$RELEASE/"
sudo chown -R teknav:teknav "/opt/teknav/releases/$RELEASE"
cd "/opt/teknav/releases/$RELEASE"
sudo -u teknav npm ci
cd backend
sudo -u teknav npm ci
sudo -u teknav npm run prisma:generate
sudo -u teknav npm run prisma:apply
cd ..
sudo -u teknav npm run seo:sitemap
sudo -u teknav npm run og:images
sudo -u teknav npm run build
cd backend
sudo -u teknav npm run build
cd ..
sudo ln -sfn "/opt/teknav/releases/$RELEASE" /opt/teknav/current
sudo systemctl restart teknav-backend
sudo nginx -t
sudo systemctl reload nginx
```

Rollback to the previous release:

```bash
ls -1 /opt/teknav/releases
sudo ln -sfn /opt/teknav/releases/PREVIOUS_RELEASE /opt/teknav/current
sudo systemctl restart teknav-backend
sudo nginx -t
sudo systemctl reload nginx
```

Only roll back code after a schema change if the older code is compatible with the newer schema.

## 19. Backups

Run backup manually:

```bash
sudo systemctl start teknav-backup
sudo journalctl -u teknav-backup -n 100 --no-pager
ls -lh /var/backups/teknav
```

Timers:

```bash
sudo systemctl list-timers 'teknav-*'
```

Default retention is 14 days. Override in `/etc/teknav/backend.env`:

```env
BACKUP_RETENTION_DAYS=30
```

## 20. Restore

Stop backend before a full restore:

```bash
sudo systemctl stop teknav-backend
```

Restore a backup:

```bash
set -a
. /etc/teknav/backend.env
set +a
gunzip -c /var/backups/teknav/teknav-YYYYMMDD-HHMMSS.sql.gz | psql "$DATABASE_URL"
```

Restart and verify:

```bash
sudo systemctl start teknav-backend
curl -fsS https://www.teknav.ir/api/health
```

## 21. Logs and Operations

Backend logs:

```bash
sudo journalctl -u teknav-backend -f
sudo journalctl -u teknav-backend -n 200 --no-pager
```

nginx logs:

```bash
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

Database:

```bash
sudo -u postgres psql -d teknav
```

Redis:

```bash
redis-cli info server
redis-cli info memory
```

Disk:

```bash
df -h
du -sh /var/lib/teknav/uploads /var/backups/teknav /opt/teknav/current
```

## 22. Security Notes

- Never deploy Docker for this production model unless the architecture changes.
- Never put `ACCOUNTS.md` under `public/` or `dist/`.
- Keep `/etc/teknav/backend.env` mode `640` and owned by `root:teknav`.
- Rotate seeded passwords after first login.
- Keep PostgreSQL, Redis, and Fastify bound to localhost.
- Do not add remote analytics scripts, remote fonts, remote images, or CDN assets.
- Keep nginx gzip enabled for static assets and JSON.
- Keep SSE paths unbuffered:
  - `/api/auth/notifications/stream`
  - `/api/admin/stream`
- `VAPID_PRIVATE_KEY` must stay in `/etc/teknav/backend.env` only. The public key is exposed via `/api/auth/push/vapid-key` (authenticated) — never embed it in nginx config or any public file.

## 23. Troubleshooting

Backend does not start:

```bash
sudo systemctl status teknav-backend --no-pager
sudo journalctl -u teknav-backend -n 200 --no-pager
```

Schema apply fails:

```bash
cd /opt/teknav/current/backend
sudo -u teknav npm run prisma:generate
sudo -u teknav npm run prisma:apply
```

Frontend 404s on refresh:

```bash
sudo nginx -T | grep -A20 "location /"
```

Confirm `try_files $uri $uri/ /index.html;` exists.

API returns 502:

```bash
curl -fsS http://127.0.0.1:3010/api/health
sudo journalctl -u teknav-backend -n 100 --no-pager
```

Uploads return 404:

```bash
grep UPLOAD_DIR /etc/teknav/backend.env
sudo ls -lah /var/lib/teknav/uploads
sudo chown -R teknav:teknav /var/lib/teknav/uploads
sudo nginx -T | grep -A12 "location /uploads/"
```

SSE notifications or admin live widgets do not update:

```bash
redis-cli ping
sudo nginx -T | grep -A20 "admin/stream"
sudo nginx -T | grep -A20 "notifications/stream"
```

Certbot renewal fails:

```bash
sudo certbot renew --dry-run
sudo nginx -t
sudo journalctl -u nginx -n 100 --no-pager
```

SMTP fails:

```bash
grep '^SMTP_' /etc/teknav/backend.env
sudo journalctl -u teknav-backend -n 200 --no-pager | grep -i smtp
```

Kavenegar OTP fails:

```bash
grep '^SMS_' /etc/teknav/backend.env
sudo journalctl -u teknav-backend -n 200 --no-pager | grep -i otp
```

Web push not delivering:

```bash
# Confirm VAPID keys are set
grep '^VAPID_' /etc/teknav/backend.env

# Check for 410 stale-subscription cleanup in logs
sudo journalctl -u teknav-backend -n 200 --no-pager | grep -i push

# Verify PushSubscription table exists
sudo -u postgres psql -d teknav -c '\dt "PushSubscription"'

# Verify at least one subscription row exists for a test user
sudo -u postgres psql -d teknav -c 'SELECT "userId", "endpoint" FROM "PushSubscription" LIMIT 5;'
```

If the table is missing, re-run `cd backend && npm run prisma:apply`.

Crawler files missing:

```bash
cd /opt/teknav/current
sudo -u teknav npm run seo:sitemap
ls -lh public/sitemap.xml public/robots.txt public/feed.xml
sudo nginx -t
sudo systemctl reload nginx
```
