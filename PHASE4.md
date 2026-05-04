# Phase 4 Completion Guide

Phase 4 shipped the public REST API and caching layer for Teknav. Use this file as the entry point for reading what changed, where the code lives, and which docs remain authoritative.

## What Phase 4 Completed

- Public article APIs: `GET /api/articles`, `GET /api/articles/:slug`
- Public taxonomy APIs: `GET /api/categories`, `GET /api/categories/:slug`, `GET /api/tags`
- Public author APIs: `GET /api/authors`, `GET /api/authors/:slug`
- Search API: `GET /api/search?q=...` using Persian full-text search
- Newsletter signup: `POST /api/newsletter` with `3/IP/hour` Redis rate limit
- Auth-required interactions: `POST /api/articles/:id/reactions`, `POST /api/articles/:id/save`
- Redis response caching, search caching, and buffered article view counters
- Public frontend migration from direct `TeknavStore` reads to `src/lib/content-api.js`

## Primary Files

- `backend/src/routes/public.ts` — Phase 4 backend routes, serializers, cache keys, rate limits, view-counter flushing.
- `src/lib/content-api.js` — frontend content client used by public pages.
- `src/lib/api.js` — low-level fetch wrapper with credentials and CSRF handling.
- `backend/src/server.ts` — registers `publicRoutes`.
- `backend/src/lib/cache.ts` — Redis `cached()` and `bust()` helpers.
- `backend/src/redis.ts` — shared Redis client used by sessions, cache, rate limits, and counters.

## Frontend Consumers

These public UI modules now read through `contentApi`:

- `teknav-home.jsx`
- `teknav-articles.jsx`
- `teknav-pages.jsx`
- `teknav-ui.jsx` (`NewsletterForm`)

Seed/localStorage fallback may remain only for public read-only development paths. Admin, writer, reviewer, media, dashboard, and activity panels must use backend APIs only and show empty/error states when data is unavailable.

## Related Documentation

- `ARCH.md` — active roadmap. Phase 7 is now complete with native systemd deployment, media library, scheduled publishing, and real verification delivery.
- `PHASES.md` — completion log. Read the “Phase 4 — Public REST API + caching” section for shipped behavior.
- `MEMORY.md` — durable project context and current deployment assumptions.
- `backend/README.md` — backend setup, migrations, health check, and production notes.
- `AGENTS.md` — contributor guide for this repository.

## Verification Commands

```bash
cd backend && npm run build
npm run build
```

The frontend build must finish with `[check-no-cdn] clean`. Production validation should happen on the Linux target, not from Windows build output.

## Deployment Assumption

Do not design deployment around cPanel, shared hosting, Windows Server, or Docker. Production runs on Linux with systemd, nginx, Node/Fastify, Postgres, Redis, TLS, persistent uploads, scheduled publishing, and daily backups. See `DEPLOY.md`.
