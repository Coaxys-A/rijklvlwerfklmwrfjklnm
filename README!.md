# Project: Teknav-X

Teknav-X is a full-stack Persian RTL publication stack. The frontend is Vite/React, the backend is Fastify/TypeScript, and production runs natively on Linux with PostgreSQL, Redis, nginx, and systemd.

Current state: Phase 10 is the active roadmap. The live surface includes SEO topic hubs, glossary pages, Q&A, reader retention flows, auth trust features, jobs/courses pages, and monetization foundations.

## Start Here

- `ARCH.md` for current work and next steps
- `PHASE10.md` for the active roadmap
- `DEPLOY.md` for native Debian production setup
- `SECURITY.md` for hardening and safety rules
- `AGENTS.md` for agent-facing file guidance

## Core Layout

- Frontend: repo root `*.jsx` files plus `src/`
- Backend: `backend/`
- Static assets: `public/`
- Generated SEO artifacts: `public/sitemap.xml`, `public/robots.txt`, `public/feed.xml`

## Main Commands

- `npm run dev`
- `npm run build`
- `npm run seo:sitemap`
- `npm run og:images`
- `cd backend && npm run dev`
- `cd backend && npm run build`
- `cd backend && npm test`
