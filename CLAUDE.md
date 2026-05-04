# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Directives

- **Zero CDN dependencies.** Do not add third-party hosted JS, CSS, fonts, images, or `cdn.*` URLs. `npm run build` runs `scripts/check-no-cdn.mjs`.
- **Persian/RTL first.** UI copy is Persian by default and layouts assume `direction: rtl`; prefer logical CSS properties over left/right assumptions.
- **Frontend uses APIs only.** Never call the database from frontend code. Persistence goes through `/api/*`.
- **No mock admin data.** Admin, writer, reviewer, dashboard, activity, and media views must use real backend APIs and show empty/error states when data is missing.
- **Production is native Linux/systemd.** Do not add Docker deployment instructions unless explicitly requested. Production uses nginx, systemd, PostgreSQL, Redis, `/etc/teknav/backend.env`, `/var/lib/teknav/uploads`, and `/var/backups/teknav`.
- **Protect credentials.** `ACCOUNTS.md` is operator-only, gitignored, and nginx-blocked. Do not move it into `public/` or `dist/`.
- **Port and registry are fixed.** Vite dev/preview use port `3009`; npm registry is `https://npm.devneeds.ir/`.
- **Reuse shared styling.** Use `src/styles/global.css` utilities/keyframes instead of redefining common animation primitives.
- **Phase 10 is current.** Keep `PHASE10.md`, `AGENTS.md`, `DEPLOY.md`, and `SECURITY.md` aligned when SEO, trust, retention, or monetization flows change.

## Memory

See `MEMORY.md` for project context and `ARCH.md` for active roadmap/status.

Quick reference:
- **Frontend:** Vite 5 + React 18 ES modules
- **Backend:** Fastify + Prisma/PostgreSQL + Redis
- **Auth:** Argon2id, Redis sessions, CSRF, username/email login
- **Deployment:** Debian/Ubuntu + systemd + nginx for `https://www.teknav.ir`
- **Language:** Persian (`fa`), RTL
