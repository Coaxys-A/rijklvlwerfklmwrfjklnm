# Security — Teknav

Summary of security measures across the stack.

---

## Nginx

### HTTP Security Headers
- `Strict-Transport-Security` (HSTS) — starts at 1 week (`max-age=604800`) in production; extend to 1 year once TLS is stable
- `Content-Security-Policy` — self-only scripts/styles/fonts; `data:` and `blob:` for inline images; no CDN
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: SAMEORIGIN`
- `Referrer-Policy: strict-origin-when-cross-origin`

### Rate Limiting (tuned to avoid false 429s)
| Zone | Rate | Burst | Targets |
|---|---|---|---|
| `general` | 300 r/min | 200 | SPA routes |
| `api` | 300 r/min | 200 | All `/api/*` |
| `auth` | 30 r/min | 10 | `/api/auth/login`, `/api/auth/signup` |

Fastify applies its own per-IP counters on top (5 login fails / 15 min; 10 signup attempts / hour).

### Blocked Paths
- Dotfiles: `.git`, `.env`, `.htaccess`, etc.
- Operator credential file: `/ACCOUNTS.md`
- Upload directory: blocks `.php/.html/.js/.sh/.py/.env/.conf` execution

### Proxy Hardening
- `Server` and `X-Powered-By` headers stripped
- `server_tokens off`
- Connection timeouts: 30s client, 10s proxy connect, 60s proxy read

### Error Handling
- 404 → SPA fallback (`/index.html`) for client-side routing
- 429 → JSON `{"error":"too_many_requests","retryAfter":60}`
- 5xx → JSON `{"error":"service_unavailable"}`
- 400/401/403 from `/api/*` pass through as-is (JSON from Fastify)

---

## Backend (Fastify)

### Authentication
- **Argon2id** password hashing (m=19 MiB, t=2, p=1)
- Login accepts email or `@username`; password verification stays Argon2id-backed
- **Redis-backed sessions** — `tek_sid` cookie (HttpOnly, Secure, SameSite=Lax), 14-day TTL with sliding expiration
- **CSRF** — double-submit cookie pattern (`tek_csrf`); required on all mutating routes except `/api/auth/login`, `/api/auth/signup`, `/api/newsletter`, and OAuth callbacks
- **OAuth** — Google and GitHub (authorization-code grant); state token stored in Redis (10-min TTL, one-time use); no client secret exposed to frontend

### Rate Limiting (application layer)
- Global Fastify rate limiting is enabled on public API traffic, with route-level exceptions for OAuth callbacks, health, and other explicit public-mutating endpoints.
- Login: 5 failures / IP / 15 min → 429 + `Retry-After`
- Signup: 10 attempts / IP / hour → 429 + `Retry-After`
- Captcha generate: 20 / IP / min
- Captcha verify: 10 / IP / min
- Newsletter: 3 / IP / hour

### Input Validation
- Zod schemas on every route
- Fastify JSON-Schema validation (AJV) on all body/querystring

### Role-Based Access Control
| Role | Access |
|---|---|
| `reader` | View articles, save, react, manage own profile |
| `reviewer` | + Article review queue |
| `writer` | + Create/edit own articles |
| `editor` | + Edit any article, manage categories/tags |
| `admin` | + Delete articles, manage users |

### Engagement Controls
- Comment moderation supports bulk approve/delete actions for editors/admins and keeps replies sorted by upvotes.
- Comments require an authenticated session; backend strips HTML and limits body length to 1000 chars.
- Comment flagging is idempotent per user through a compound unique constraint.
- Reading history, notifications, and writer follows are scoped to the current session.
- Notification and admin SSE streams require normal cookie auth; nginx disables buffering/compression only for stream paths.

### Credential Storage
- 2FA login uses Kavenegar OTP, and the verify endpoint is ticket-based.
- Staff credentials live in `backend/prisma/credentials.json` (committed, plaintext)
- Operator-facing credential sheet lives in `ACCOUNTS.md` (gitignored and nginx-blocked)
- `seed.ts` hashes them with Argon2id before DB insert — **never** stored plaintext in Postgres
- The three writer-admin accounts use `resetPasswordOnSeed: true` until production rotation is complete
- Rotate via the admin panel before go-live
- After rotation, users can change their own password from profile settings; existing-password accounts must provide the current password
- Public registrations: `reader` role, Argon2id-hashed password (or OAuth — no password stored)

---

## Database (PostgreSQL)

- Bind PostgreSQL to localhost only; do not expose it publicly
- `passwordHash` — Argon2id only
- `User.status` enum — `active`, `suspended`, `pending`; suspended users are rejected at login
- OAuth fields (`oauthProvider`, `oauthSubject`) use a composite unique index to prevent duplicate linking

---

## Redis

- Bind Redis to localhost only; do not expose it publicly
- AOF + RDB persistence

---

## Linux/systemd

- Backend runs as the dedicated `teknav` system user, not root
- `teknav-backend.service` reads secrets from `/etc/teknav/backend.env`
- Upload writes are restricted to `/var/lib/teknav/uploads`
- Timers handle scheduled publishing and daily database backups
- Redis pub/sub backs SSE notifications and admin live counters; Redis must remain private to localhost

---

## Build
- After schema changes, also run `cd backend && npm run build` and `cd backend && npm test`.

- **Zero CDN** — `scripts/check-no-cdn.mjs` greps `dist/` for external domains; build fails on any match
- Run `npm audit` and `cd backend && npm audit` before each deploy

---

## Pre-Deploy Checklist

- [ ] `/etc/teknav/backend.env` configured (`SESSION_SECRET` ≥ 32 chars, strong DB password)
- [ ] TLS issued for `www.teknav.ir` and `teknav.ir`
- [ ] `nginx/nginx.conf` updated with real `server_name` + cert paths
- [ ] OAuth `GOOGLE_CLIENT_ID/SECRET` and/or `GITHUB_CLIENT_ID/SECRET` set if using OAuth
- [ ] `OAUTH_CALLBACK_BASE` set to `https://www.teknav.ir`
- [ ] SMTP vars set for password reset and email verification
- [ ] `SMS_PROVIDER=kavenegar` and `SMS_API_KEY` set for phone OTP
- [ ] Credentials in `credentials.json` rotated (via admin UI after first login)
- [ ] `ACCOUNTS.md` is not committed and `curl -I https://www.teknav.ir/ACCOUNTS.md` returns 404/403
- [ ] Remove `resetPasswordOnSeed` after rotating writer-admin passwords if future seeds must not reset them
- [ ] `npm run build` passes (no CDN refs)
- [ ] `sudo systemctl status teknav-backend` is healthy
- [ ] `curl https://www.teknav.ir/api/health` → 200 `{"ok":true}`
- [ ] Test login at `https://www.teknav.ir/login`
- [ ] Test user signup at `https://www.teknav.ir/login` → signup tab
- [ ] Test authenticated comment, flag, history, follow, and notification flows
- [ ] Test `/api/admin/stream` while logged in as admin/editor

---

## Known Limitations

- **Email/SMS depend on production providers** — verification routes are implemented, but delivery requires configured SMTP and Kavenegar credentials
- **`unsafe-inline` on `style-src`** — required by Vite CSS-in-JS injection; harmless (affects styles, not scripts)
- **HSTS starts short** — extend `max-age` once TLS is confirmed stable on the server
