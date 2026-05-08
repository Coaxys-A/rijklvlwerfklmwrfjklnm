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

## SEO Invariants

- **No hreflang="en" anywhere.** This is a Persian-only site. Adding `hreflang="en"` pointing to `?lang=en` URLs causes Search Console violations. `?lang=en` is a UI preference only — canonical must always be the clean URL.
- **No verification code placeholders in source.** Never commit `INSERT_GOOGLE_VERIFICATION_CODE`, `GSC_VERIFICATION_CODE_PLACEHOLDER`, or similar strings. Real verification codes go in the HTML directly when obtained; until then, omit the tag entirely.
- **Article static HTML pages.** `dist/article/{slug}/index.html` is generated at build time by `scripts/generate-article-pages.mjs` so crawlers receive full article metadata without executing JavaScript. nginx's `try_files $uri $uri/` serves these automatically. When adding or editing articles, the build pipeline handles regeneration — do not manually edit files under `dist/article/`.
- **Persian SEO quality gate.** Run `npm run check:seo` after changing article metadata/content. It verifies current Persian indexable articles for canonical paths, descriptions, OG images, review dates, heading structure, and entity coverage; warnings indicate editorial expansion candidates.
- **Sitemap lastmod must not be future-dated.** `capDate()` in `generate-seo.mjs` caps any date to today. Do not bypass this when adding new articles — scheduled future dates must not appear as lastmod.
- **Organization schema type is `['Organization', 'NewsMediaOrganization']`.** Do not simplify to just `Organization` — `NewsMediaOrganization` is required for Google News eligibility and Knowledge Panel recognition.
- **Articles use `['NewsArticle', 'TechArticle']` type.** Do not change back to generic `Article` — `NewsArticle` is required for Google's Article rich result trigger.

## Build Pipeline Order

```
seo:sitemap → og:images → vite build → check-no-cdn → check-responsive → generate-article-pages → compress-dist
```

`generate-article-pages` must run after `vite build` (reads the built `dist/index.html` as template) and before `compress-dist` (so article HTML files get `.gz`/`.br` counterparts).

## Memory

See `MEMORY.md` for project context and `ARCH.md` for active roadmap/status.

Quick reference:
- **Frontend:** Vite 5 + React 18 ES modules
- **Backend:** Fastify + Prisma/PostgreSQL + Redis
- **Auth:** Argon2id, Redis sessions, CSRF, username/email login
- **Deployment:** Debian/Ubuntu + systemd + nginx for `https://www.teknav.ir`
- **Language:** Persian (`fa`), RTL
