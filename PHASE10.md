# Phase 10 - SEO Growth, Trust, and Production Readiness

## Status: Implemented — Linux production validation pending

Phase 10 turns the Phase 7-9 platform into a measurable Persian-first publication for `https://www.teknav.ir`. All features are implemented and the frontend build is clean. Schema migration, seed, and smoke testing must be run on Linux before declaring production-ready.

Default target: a 90-day SEO growth roadmap, followed by reader retention and monetization only after crawlability, measurement, and editorial quality are reliable.

## Implemented in this pass

- Topic authority hubs at `/topics/ai`, `/topics/security`, `/topics/software`, `/topics/hardware`, `/topics/startups`, and `/topics/data`.
- Topic hub metadata in `teknav-data.js`: Persian SEO title/description, intro copy, keywords, and FAQ pairs.
- Frontend `TopicHubPage` with featured articles, latest articles, related series, related authors, and visible FAQ content.
- SEO manager support for topic hubs and series pages with `CollectionPage`, `FAQPage`, `ItemList`, and `BreadcrumbList` JSON-LD.
- Sitemap generation now includes topic hubs and public author profile URLs, and `robots.txt` blocks `/ACCOUNTS.md`.
- Production smoke script: `npm run smoke:prod`.
- Additive Prisma fields for editorial trust:
  - `Article.factCheckedAt`
  - `Article.reviewedById`
  - `Article.sourceNotes`
  - `Article.contentFreshnessStatus`
- Additive analytics model `AnalyticsEvent` with `type`, `userId`, `articleId`, `topic`, `metadata`, and `createdAt`.
- First-party event writes for article views, newsletter subscriptions, article saves, writer follows, topic follows, and share clicks.
- Topic follows via `TopicFollow` and `/api/topics/:slug/follow`, with topic follow counts on authority hub pages.
- Public newsletter archive routes and API:
  - `/newsletter`
  - `/newsletter/:slug`
  - `GET /api/newsletter/archive`
  - `GET /api/newsletter/archive/:slug`
- Newsletter archive SEO metadata and sitemap inclusion for `/newsletter`.
- Article saves now create/use the default reading list `بعداً بخوانم`.
- Role-aware panel metrics API `GET /api/admin/panel-metrics` covers admin, editor, writer, and reviewer dashboards with status, workflow, engagement, notification, SEO quality, and recent real event counts.
- Writer workspace `/writer` separates personal stats, writing, article management, and comments from the full admin panel. It uses `GET /api/admin/writer/dashboard` for my views, followers, comments, and recent articles.
- Writer-created articles are forced into draft or review states from the panel; they cannot bypass approval into public publication, and a linked public author profile is created on first submission when a writer account does not already have one.
- Article writing now exposes an automatic table of contents from `<h2>` and `<h3>` headings before publish.
- Review approval now runs Phase 10 quality gates, completes missing metadata, publishes the article, refreshes counts/cache, and notifies writer/topic followers.
- Public tag pages and backend tag filtering are available through `/tag/:tag` and `GET /api/articles?tag=...`, so approved content appears on category, topic, tag, author, article, sitemap, and feed surfaces.
- Topic and author RSS files are generated under `/feeds/topic-*.xml` and `/feeds/author-*.xml` in addition to `/feed.xml`.
- Weekly newsletter digest job `npm run newsletter:digest` and `teknav-weekly-digest.timer` send the latest weekly articles through the existing SMTP/newsletter stack.
- Glossary/dictionary term pages are available at `/glossary/:slug` with Persian metadata, `DefinedTerm`, `FAQPage`, and breadcrumb JSON-LD; `scripts/generate-seo.mjs` includes them in `sitemap.xml`.
- The article editor includes a structured "X vs Y" comparison template with responsive comparison-table styling for published articles.
- Topic pages continue to expose visible FAQ content and `FAQPage` schema for rich-result eligibility.
- Google Discover readiness is improved with local 1200x630 article hero images, `fetchPriority="high"` on the article hero image, `max-image-preview:large`, and OG image dimensions.
- Persian article SEO has been normalized around the `ai-data-centric-2026` success pattern:
  - Older article pages automatically get a semantic `.lead` introduction block at render time when their stored content does not already provide one.
  - Runtime article JSON-LD includes enriched `NewsArticle`/`TechArticle` signals: `alternativeHeadline`, `abstract`, `articleBody`, `wordCount`, `timeRequired`, `about`, `mentions`, `teaches`, author `knowsAbout`, review metadata, and topic-hub linkage.
  - Static article pages generated under `dist/article/{slug}/index.html` receive the same enriched metadata before React hydration.
  - Future-dated articles are excluded from article sitemaps, feeds, and static article page generation until their `dateEn` is current.
  - Article image sitemap entries now use explicit `ogImage` values or generated `/images/og/{slug}.jpg` assets.
  - `npm run check:seo` audits current Persian indexable articles for canonical, meta, OG image, review date, heading structure, entity coverage, and body-depth warnings.
- OAuth login remains production-wired for Google and GitHub through `/api/auth/oauth/:provider` and `OAUTH_CALLBACK_BASE=https://www.teknav.ir`.
- SMS-based 2FA is implemented through Kavenegar OTP: users can enable it from profile settings, login returns a 2FA ticket, and `/api/auth/2fa/verify` completes session creation.
- Verified expert badges are supported on author records and rendered on author lists, author profiles, public user profiles, and article bylines.
- Published article corrections/errata are supported through `ArticleCorrection`, admin correction submission, public correction notices, and article `dateModified` updates.
- PWA support includes `public/manifest.json`, service-worker registration in `index.html`, offline cache handling for article pages/API responses, and an install prompt in `teknav-ui.jsx`.
- Personalized home feed uses the public article API with `sort=personalized`, followed topics, followed writers, and read history.
- Community retention now includes comment upvoting with best-comment sorting, expanded article reactions, reading streaks, continue-reading data, and article Q&A endpoints.
- Monetization foundations are in place:
  - `/jobs` with `JobListing` storage and company submission API.
  - `/courses` with course API and public course page.
  - `/membership` premium membership positioning page.
  - `User.membershipTier`, `Article.premiumOnly`, premium article labels, and content locking for non-premium readers.
  - `Article.sponsored` and public "Promoted Content" labels.
- Operations foundations now include global Fastify rate limiting, selected bulk comment moderation, first-party client error capture at `/api/errors`, and `backend/tests/phase10-smoke.test.mjs` for auth/article/comment smoke coverage.
- Living docs that describe the current surface now stay aligned: `DEPLOY.md`, `AGENTS.md`, `CLAUDE.md`, `SECURITY.md`, and backend index docs.
- Admin API foundations:
  - `GET /api/admin/seo/audit`
  - `GET /api/admin/analytics/content`
  - `GET /api/admin/analytics/newsletter`
  - `GET /api/admin/analytics/engagement`

## Linux Validation Checklist

Run only on Linux/staging or production-like infrastructure:

```bash
cd /opt/teknav/SERVER
cd backend && npm run prisma:generate
cd backend && npm run prisma:apply
cd backend && npm run seed
cd ..
npm run seo:sitemap
npm run check:seo
npm run og:images
npm run build
cd backend && npm run build
cd backend && npm test
cd ..
npm run smoke:prod
```

Production smoke checks expect:

- `/api/health` returns 2xx and reports PostgreSQL/Redis healthy.
- `/sitemap.xml`, `/robots.txt`, and `/feed.xml` return 2xx.
- `/ACCOUNTS.md` returns 403 or 404 through nginx.
- Selected article URLs return canonical URL evidence.

Override smoke targets when needed:

```bash
TEKNAV_SMOKE_URL=https://www.teknav.ir TEKNAV_SMOKE_ARTICLES=/article/agentic-ai-production,/article/ai-clean-data npm run smoke:prod
```

## Writer Studio V5 — Close-out polish (implemented)

- HtmlEditor toolbar: grouped buttons (Formatting | Headings | Inline+Block | Lists | Media) with hover states, Bold/Italic label styling, and keyboard shortcuts Ctrl+B / Ctrl+I in the textarea and Ctrl+S globally to save draft.
- Live word count + character count footer on the editor textarea.
- WritingTipCard: manual prev/next navigation with `1/N` counter; auto-advance timer resets on manual interaction.
- ArtifactStudio diagram library: gradient placeholder thumbnails replaced with live scaled `DiagramRenderer compact` mini-previews (CSS scale 0.33, overflow-hidden 56px container).
- ArtifactStudio code mode: relabelled "code preview" with empty-state guidance; was falsely labelled "live preview".
- WeeklyChart data pipeline fixed: was reading the non-existent `weeklyViews` field; now correctly reads `viewsByDay.slice(-7).map(d => d.views)` from the dashboard response.
- Analytics sparklines upgraded: full-width filled-area SVG with `linearGradient`, dot on latest point, "۳۰ روز پیش → امروز" axis labels.
- Analytics table: sparklines prefetched for all articles on mount (parallel requests); inline 80×20 mini-sparkline visible per row; totals footer row; column header corrected from "روند (۳۰ روز)" to "روند اخیر".
- Overview tab: amber `needsRevision` alert banner when reviewer has flagged articles; dynamic time-of-day greeting (صبح / ظهر / عصر / شب بخیر) with matching tagline.
- Article editor meta-panel: fields grouped into "اطلاعات پایه", "زمان‌بندی", and collapsible "سئو پیشرفته"; slug field added inside SEO section.
- Article editor preview mode: renders selected diagram via `DiagramRenderer` and subtitle above the article body.
- Article editor: dirty-state indicator (● ذخیره نشده · Ctrl+S) shown when form differs from last-saved snapshot; cleared on successful save.
- Article editor: amber "بازخورد ویراستار" banner when opening a `نیازمند اصلاح` article with a reviewer note.
- Articles list: hard cap of 15 replaced with "نمایش X مورد دیگر" show-more/less button; reviewer note shown inline for revision-flagged rows.
- Overview recent-articles: reviewer note shown inline for `نیازمند اصلاح` articles.
- Comments tab: article title chip added next to commenter name; cap note explains 8-recent limit and redirects to article for full thread.
- Backend: `articleInclude` now joins `review { note, status }`; `publicArticle` exposes `reviewNote`; flows through writer dashboard, articles list, and editor.

## Remaining Work

- **Linux validation** (blocking for production):
  - `cd backend && npm run prisma:generate`
  - `cd backend && npm run prisma:apply`
  - `cd backend && npm run seed`
  - `npm run seo:sitemap && npm run og:images && npm run build`
  - `npm run check:seo`
  - `cd backend && npm run build`
  - `npm run smoke:prod`
- Verify all flows after schema apply: auth, comments/likes/flags, history, notifications/SSE, reading lists, topic/writer follows, tag pages, series, topic hubs, newsletter archive/campaigns, review workflow, analytics endpoints, panel metrics, first-party events.
- Rotate all seed/admin passwords after first production login.
- Remove `resetPasswordOnSeed` from writer-admin credentials after rotation.
- Confirm SMTP and Kavenegar credentials.
- **Nice-to-have (not blocking):** article save list picker UI; topic-targeted new-article notifications; Search Console/Bing Webmaster local verification files.

## Editorial Rules

- Every published article should have one topic/category, two or more internal links, a canonical path, local OG image, source notes, and fact-check date.
- Articles older than 90 days should be marked `needs_update` unless reviewed.
- External analytics scripts remain out of scope for Phase 10 because of zero-CDN and privacy goals.
