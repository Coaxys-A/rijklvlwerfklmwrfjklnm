# Teknav Backend

Fastify 4 + Prisma 5 + PostgreSQL + Redis. Auth uses Argon2id password hashes, Redis sessions, CSRF protection, SMTP email verification/password reset, OAuth login, Kavenegar OTP, and SMS 2FA when configured.

## Local Setup

Run PostgreSQL and Redis as local services. Docker is not the production model for this project.

```bash
cd backend
cp .env.example .env
npm install
npm run prisma:generate
npm run prisma:apply
npm run seed
npm run dev
```

`prisma:apply` runs migrations when `prisma/migrations/` exists and otherwise falls back to `prisma db push --skip-generate`.

## Commands

```bash
npm run dev              # tsx watch src/server.ts
npm run build            # TypeScript compile
npm run start            # node dist/src/server.js
npm run prisma:generate  # generate Prisma client
npm run prisma:apply     # apply schema safely for current repo state
npm run seed             # seed categories, authors, articles, users, FTS
npm run publish:due      # publish scheduled articles whose scheduledAt is due
npm run newsletter:digest # send the weekly digest through the existing SMTP/newsletter stack
npm test                 # node:test smoke checks for auth/article/comment flows
```

## Staff Accounts

Seed credentials are read from `backend/prisma/credentials.json`. Operator-facing credentials are documented in root `ACCOUNTS.md`, which is gitignored and nginx-blocked. Every seeded user receives a URL-safe username and can log in with either email or `@username`.

The three writer-admin accounts use `resetPasswordOnSeed: true` so a re-seed upgrades old placeholder writer users and sets the listed passwords. Remove that flag after production password rotation if reseeding must not reset those accounts.

Profile settings allow users of any role to edit display name, username, bio, verification data, and password. Password changes require the current password when the account already has a password hash.

The backend also serves the active Phase 10 surfaces: topic hubs, glossary pages, Q&A, jobs, courses, article corrections, sponsored/premium article flags, global rate limiting, and first-party analytics/error capture.

## Health

```bash
curl http://127.0.0.1:3010/api/health
# {"ok":true,"postgres":true,"redis":true}
```

## Production Notes

Production runs under `teknav-backend.service` with:

- Env file: `/etc/teknav/backend.env`
- Uploads: `/var/lib/teknav/uploads`
- Backups: `/var/backups/teknav`
- Public URL: `https://www.teknav.ir`

See root `DEPLOY.md` for complete systemd/nginx instructions.
