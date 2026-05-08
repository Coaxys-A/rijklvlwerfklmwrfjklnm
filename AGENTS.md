# Repository Guidelines

## Project Structure

Teknav is a Persian RTL React SPA (`teknav.ir`) with a Fastify/PostgreSQL/Redis backend. The Vite entry is `index.html` → `src/main.jsx`. Global styles, fonts, and animation primitives live in `src/styles/global.css`. Main frontend modules at repo root: `teknav-app.jsx`, `teknav-ui.jsx`, `teknav-home.jsx`, `teknav-articles.jsx`, `teknav-pages.jsx`, `teknav-auth.jsx`, `teknav-admin.jsx`, `teknav-profile.jsx`, `teknav-data.js`, `teknav-store.js`. Runtime assets in `public/`; font archives in `Fonts/`. Backend in `backend/` with Fastify sources in `backend/src/` and Prisma in `backend/prisma/`.

## Dev Commands

**Frontend** (repo root):
- `npm run dev` — Vite dev server on **port 3009**, proxies `/api` → `http://localhost:3010`. Backend must be running first.
- `npm run build` — runs SEO artifact generation, OG image generation, Vite build, CDN/responsive checks, static article page generation, and gzip/brotli compression.
- `npm run preview` — preview built `dist/` on **port 4173**.
- `npm run seo:sitemap` — regenerate `public/sitemap.xml`, `public/robots.txt`, `public/feed.xml` from `teknav-data.js`.
- `npm run og:images` — generate local Open Graph images into `public/images/og/` from article metadata. Run on Linux after dependencies are installed.
- `npm run check:seo` — audit current Persian indexable articles for canonical, meta, OG image, review date, heading structure, entity coverage, and body-depth warnings.

**Backend** (`backend/`):
- `npm run dev` — `tsx watch src/server.ts` on **port 3010** (env `PORT`, default 3010).
- `npm run build` — `tsc` type-check and compile.
- `npm run prisma:generate` — regenerate Prisma client after schema changes.
- `npm run prisma:apply` — apply schema (migrations if present, else `db push --skip-generate`).
- `npm run seed` — seed Postgres via `tsx prisma/seed.ts`.
- `npm run publish:due` — publish scheduled articles (also runs via systemd timer in prod).

**Dev startup order**: PostgreSQL + Redis → `cd backend && npm run dev` → `npm run dev`.

**No formal test suite.** Validate with `npm run check:seo`, `npm run build` (frontend), and `cd backend && npm run build` (backend).

## Hard Constraints

- **Zero CDN.** No external JS, CSS, fonts, images. `npm run build` rejects any CDN URL in `dist/`.
- **Persian-first RTL.** All UI copy in Persian. Use logical CSS properties over `left`/`right`.
- **ES modules, named exports.** JSX uses Vite automatic runtime — import hooks directly, not `React`.
- **No mock admin data.** Admin/panel views (`teknav-admin.jsx`) must use backend API only (`src/lib/admin-api.js`). `teknav-data.js` and `teknav-store.js` are seed/reference data, not UI fallbacks.
- **Production is native Linux/systemd + nginx.** No Docker. Deploy docs in `DEPLOY.md`.
- **`ACCOUNTS.md`** is gitignored and nginx-blocked. Never commit or expose it. Seed credentials are in `backend/prisma/credentials.json`.

## Ports & Proxy

| Service | Dev Port | Prod |
|---|---|---|
| Frontend (Vite) | 3009 | nginx →
`dist/` |
| Preview (built) | 4173 | — |
| Backend (Fastify) | 3010 | nginx proxy |

Vite dev proxies `/api` to `http://localhost:3010` for same-origin cookies. Production nginx handles path-based routing. Backend health: `GET /api/health` at port 3010.

## Auth & Accounts

Argon2id hashing, Redis sessions (`tek_sid`), CSRF double-submit cookie (`tek_csrf`). Login by **email** or **`@username`**. Every seeded account must have a URL-safe username. Writer-admin accounts (آرسام صباغ, رادمان قلیچی, سیداحمدرضا محجوب) in `backend/prisma/credentials.json` use `resetPasswordOnSeed: true` — remove after production password rotation.

## Schema & Seed Workflow

When changing `backend/prisma/schema.prisma`: run `prisma:generate` before backend build/type-check, then `prisma:apply`.
For production/Linux deployment, run `cd backend && npm ci && npm run prisma:generate && npm run prisma:apply` on the Linux host after uploading code. Never copy Windows-generated Prisma engine files (`backend/query_engine*.node`, `backend/schema-engine*`) or local `node_modules` into production.
When changing `teknav-data.js` slugs/dates: run `npm run check:seo` and `npm run seo:sitemap`.
When changing article Open Graph metadata: run `npm run og:images`, `npm run check:seo`, and `npm run seo:sitemap` on Linux.
When changing seed logic: run `cd backend && npm run seed` against running PostgreSQL/Redis.

## Phase 9 Files

Phase 9 adds real publication features across frontend and backend:

- `backend/src/routes/public.ts` — related articles, public article SEO fields, public series, newsletter unsubscribe, saved-article default reading-list sync.
- `backend/src/routes/comments.ts` — real comment like/unlike API, like counts, and liked-by-me flags.
- `backend/src/routes/lists.ts` — authenticated reading-list CRUD, add/remove, and reorder.
- `backend/src/routes/analytics.ts` — authenticated writer/editor article analytics.
- `backend/src/routes/admin.ts` — admin analytics, review workflow, newsletter campaigns, article series, and article SEO field writes.
- `backend/prisma/schema.prisma` — `ArticleViewLog`, `CommentLike`, `NewsletterCampaign`, `ArticleSeries`, `ArticleReview`, `ReadingList`, and new article SEO fields.
- `teknav-admin.jsx` — API-backed analytics, review, newsletter, and series panels.
- `teknav-articles.jsx` — comment likes and API-backed related articles.
- `teknav-pages.jsx` / `teknav-app.jsx` — public `/series/:slug` route.
- `scripts/generate-seo.mjs` — canonical/dateModified/metaDescription sitemap and full-content RSS.
- `scripts/generate-og-images.mjs` — local OG image generation.

## Phase 10 Files

Phase 10 expands SEO growth, trust, and publication readiness:

- `PHASE10.md` — active Phase 10 checklist and Linux validation status.
- `teknav-data.js` — topic hub metadata, glossary term data, and SEO seed/reference content.
- `teknav-pages.jsx` — topic hubs, glossary pages, author pages, tag pages, series pages, and newsletter archive pages.
- `src/lib/seo.jsx` — Article, CollectionPage, ProfilePage, DefinedTerm, FAQPage, ItemList, BreadcrumbList, canonical, robots, and Google Discover meta handling.
- `scripts/generate-seo.mjs` — sitemap, robots, global feed, topic feeds, author feeds, and glossary URL generation.
- `teknav-articles.jsx` — public article detail, table of contents, Discover hero image, correction notices, verified author badges, comparison table styles, comments, sharing, and engagement tracking.
- `teknav-admin.jsx` — admin/writer editor, Phase 10 quality metadata, comparison article template, correction submission, verified author management, role dashboards, SEO/analytics panels.
- `teknav-auth.jsx` / `teknav-ui.jsx` — email or `@username` login, Google/GitHub OAuth entry points, and SMS 2FA login completion.
- `teknav-profile.jsx` — profile editing, phone verification, SMS 2FA toggle, public profile trust badges, reading history, and follows.
- `public/manifest.json` / `public/service-worker.js` / `index.html` — PWA manifest, service worker registration, article offline cache, and installability.
- `backend/src/routes/monetization.ts` — job board API, job submissions, and course listing API.
- `backend/src/routes/errors.ts` — first-party client error capture for self-hosted/error-tracking workflows.
- `backend/tests/phase10-smoke.test.mjs` — node:test smoke suite for auth rejection, public article/comments, optional authenticated comment, and optional publish workflow checks.
- `backend/src/routes/auth.ts` — local auth, OAuth callbacks, OTP-backed 2FA, session creation, and current-user API.
- `backend/src/routes/profile.ts` — public profile API, profile edits, verified expert fields for writer profiles, and 2FA-enabled account payloads.
- `backend/src/routes/admin.ts` — article SEO/quality writes, approval workflow, analytics, newsletter, series, author verification, and article corrections.
- `backend/src/routes/comments.ts` — comment/reply APIs, likes, upvotes, flags, best-comment sorting, and bulk moderation.
- `backend/src/routes/public.ts` — public articles/categories/authors/series/newsletter with SEO fields, verified expert fields, and correction notices.
- `backend/prisma/schema.prisma` — Phase 10 persistence including analytics events, topic follows, trust fields, verified experts, 2FA flags, article corrections, sponsored articles, premium memberships/articles, job listings, and courses.

## Key Files

| Path | Purpose |
|---|---|
| `src/main.jsx` | Vite entry, mounts app, dismisses splash loader |
| `src/styles/global.css` | fonts, reset, keyframes, shared utilities |
| `teknav-app.jsx` | root route dispatch |
| `teknav-ui.jsx` | providers, header/footer, shared UI |
| `teknav-admin.jsx` | CMS UI, article editor, media library, dashboard |
| `src/lib/api.js` | fetch wrapper with credentials and CSRF |
| `src/lib/content-api.js` | public content API client |
| `src/lib/admin-api.js` | admin API client |
| `src/lib/engagement-api.js` | comments, history, notifications, follows client |
| `backend/src/lib/realtime.ts` | Redis pub/sub, SSE, visitor counter helpers |
| `backend/src/routes/admin.ts` | admin API routes |
| `backend/src/routes/auth.ts` | login/logout API |
| `backend/src/routes/comments.ts` | article comments, flags, moderation API |
| `backend/src/routes/history.ts` | reading history API |
| `backend/src/routes/notifications.ts` | notification list and SSE stream |
| `backend/src/routes/follows.ts` | writer follow API |
| `backend/src/routes/admin-stream.ts` | admin SSE stream |
| `backend/prisma/schema.prisma` | Prisma schema |
| `backend/prisma/seed.ts` | seed data, Persian FTS setup |
| `backend/src/config.ts` | env/config with Zod validation |

## Reference Docs

- `CLAUDE.md` — directives and quick reference
- `ARCH.md` — roadmap and current work status
- `MEMORY.md` — durable project context
- `DEPLOY.md` — production deployment runbook
- `SECURITY.md` — security practices
- `PHASES.md` — completed phase history


 # Using Gemini CLI for Large Codebase Analysis

  When analyzing large codebases or multiple files that might exceed context limits, use the Gemini CLI with its massive
  context window. Use `gemini -p` to leverage Google Gemini's large context capacity.

  ## File and Directory Inclusion Syntax

  Use the `@` syntax to include files and directories in your Gemini prompts. The paths should be relative to WHERE you run the
   gemini command:

  ### Examples:

  **Single file analysis:**
  ```bash
  gemini -p "@src/main.py Explain this file's purpose and structure"

  Multiple files:
  gemini -p "@package.json @src/index.js Analyze the dependencies used in the code"

  Entire directory:
  gemini -p "@src/ Summarize the architecture of this codebase"

  Multiple directories:
  gemini -p "@src/ @tests/ Analyze test coverage for the source code"

  Current directory and subdirectories:
  gemini -p "@./ Give me an overview of this entire project"
  
#
 Or use --all_files flag:
  gemini --all_files -p "Analyze the project structure and dependencies"

  Implementation Verification Examples

  Check if a feature is implemented:
  gemini -p "@src/ @lib/ Has dark mode been implemented in this codebase? Show me the relevant files and functions"

  Verify authentication implementation:
  gemini -p "@src/ @middleware/ Is JWT authentication implemented? List all auth-related endpoints and middleware"

  Check for specific patterns:
  gemini -p "@src/ Are there any React hooks that handle WebSocket connections? List them with file paths"

  Verify error handling:
  gemini -p "@src/ @api/ Is proper error handling implemented for all API endpoints? Show examples of try-catch blocks"

  Check for rate limiting:
  gemini -p "@backend/ @middleware/ Is rate limiting implemented for the API? Show the implementation details"

  Verify caching strategy:
  gemini -p "@src/ @lib/ @services/ Is Redis caching implemented? List all cache-related functions and their usage"

  Check for specific security measures:
  gemini -p "@src/ @api/ Are SQL injection protections implemented? Show how user inputs are sanitized"

  Verify test coverage for features:
  gemini -p "@src/payment/ @tests/ Is the payment processing module fully tested? List all test cases"

  When to Use Gemini CLI

  Use gemini -p when:
  - Analyzing entire codebases or large directories
  - Comparing multiple large files
  - Need to understand project-wide patterns or architecture
  - Current context window is insufficient for the task
  - Working with files totaling more than 100KB
  - Verifying if specific features, patterns, or security measures are implemented
  - Checking for the presence of certain coding patterns across the entire codebase

  Important Notes

  - Paths in @ syntax are relative to your current working directory when invoking gemini
  - The CLI will include file contents directly in the context
  - No need for --yolo flag for read-only analysis
  - Gemini's context window can handle entire codebases that would overflow Claude's context
  - When checking implementations, be specific about what you're looking for to get accurate results # Using Gemini CLI for Large Codebase Analysis


  When analyzing large codebases or multiple files that might exceed context limits, use the Gemini CLI with its massive
  context window. Use `gemini -p` to leverage Google Gemini's large context capacity.


  ## File and Directory Inclusion Syntax


  Use the `@` syntax to include files and directories in your Gemini prompts. The paths should be relative to WHERE you run the
   gemini command:


  ### Examples:


  **Single file analysis:**
  ```bash
  gemini -p "@src/main.py Explain this file's purpose and structure"


  Multiple files:
  gemini -p "@package.json @src/index.js Analyze the dependencies used in the code"


  Entire directory:
  gemini -p "@src/ Summarize the architecture of this codebase"


  Multiple directories:
  gemini -p "@src/ @tests/ Analyze test coverage for the source code"


  Current directory and subdirectories:
  gemini -p "@./ Give me an overview of this entire project"
  # Or use --all_files flag:
  gemini --all_files -p "Analyze the project structure and dependencies"


  Implementation Verification Examples


  Check if a feature is implemented:
  gemini -p "@src/ @lib/ Has dark mode been implemented in this codebase? Show me the relevant files and functions"


  Verify authentication implementation:
  gemini -p "@src/ @middleware/ Is JWT authentication implemented? List all auth-related endpoints and middleware"


  Check for specific patterns:
  gemini -p "@src/ Are there any React hooks that handle WebSocket connections? List them with file paths"


  Verify error handling:
  gemini -p "@src/ @api/ Is proper error handling implemented for all API endpoints? Show examples of try-catch blocks"


  Check for rate limiting:
  gemini -p "@backend/ @middleware/ Is rate limiting implemented for the API? Show the implementation details"


  Verify caching strategy:
  gemini -p "@src/ @lib/ @services/ Is Redis caching implemented? List all cache-related functions and their usage"


  Check for specific security measures:
  gemini -p "@src/ @api/ Are SQL injection protections implemented? Show how user inputs are sanitized"


  Verify test coverage for features:
  gemini -p "@src/payment/ @tests/ Is the payment processing module fully tested? List all test cases"


  When to Use Gemini CLI


  Use gemini -p when:
  - Analyzing entire codebases or large directories
  - Comparing multiple large files
  - Need to understand project-wide patterns or architecture
  - Current context window is insufficient for the task
  - Working with files totaling more than 100KB
  - Verifying if specific features, patterns, or security measures are implemented
  - Checking for the presence of certain coding patterns across the entire codebase


  Important Notes


  - Paths in @ syntax are relative to your current working directory when invoking gemini
  - The CLI will include file contents directly in the context
  - No need for --yolo flag for read-only analysis
  - Gemini's context window can handle entire codebases that would overflow Claude's context
  - When checking implementations, be specific about what you're looking for to get accurate results
