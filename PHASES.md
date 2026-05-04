# PHASES.md

Completion log. Active work and future roadmap live in `ARCH.md`.

## Current Production Baseline

Teknav is a Persian RTL Vite/React SPA backed by Fastify, Prisma, PostgreSQL, Redis, Argon2id sessions, CSRF, Persian search, SEO artifacts, admin CMS APIs, media uploads, scheduled publishing, SMTP email flows, and Kavenegar OTP. Production deployment is native Linux/systemd with nginx on `https://www.teknav.ir`; Docker is not the current deployment target.

## Phase 1 - Frontend: Zero CDN + Vite

Shipped.

- Vite 5 + React 18.3.1 with ES modules.
- Removed unpkg, Google Fonts, and CDN scripts.
- Local font loading from `public/fonts/`.
- `scripts/check-no-cdn.mjs` runs on `npm run build`.
- Dev/preview port is locked to `3009`.

## Phase 2 - Database + Seed

Shipped.

- Backend workspace in `backend/`.
- Prisma schema for users, authors, categories, tags, articles, reactions, saved articles, newsletter subscribers, activity logs, and media assets.
- Persian FTS function/indexes are applied idempotently from `backend/prisma/seed.ts`.
- Seed imports `teknav-data.js`, hashes credentials with Argon2id, and creates the three real Teknav authors.
- Staff seed credentials live in `backend/prisma/credentials.json`; operator-facing credentials live in ignored `ACCOUNTS.md`.

## Phase 3 - Auth

Shipped.

- Redis-backed sessions with `tek_sid` and `tek_csrf`.
- Login/logout/me APIs in `backend/src/routes/auth.ts`.
- CSRF middleware for mutating routes.
- Login/signup captcha and per-IP rate limiting.
- Frontend `AuthProvider` uses `/api/auth/*`; no localStorage auth source.

## Phase 4 - Public API + Caching

Shipped.

- Public articles, categories, tags, authors, search, newsletter, save, and reaction APIs.
- Redis response caching, search caching, newsletter rate limiting, and buffered article view counters.
- Public pages use `src/lib/content-api.js`.

## Phase 5 - Admin/CMS API

Shipped.

- Role-gated article CRUD, publish, schedule, category/tag/user/author management, uploads, activity logs, and dashboard metrics.
- Admin panels use `src/lib/admin-api.js` and show real API data only.
- No mock/example data should appear in admin, writer, reviewer, media, activity, or dashboard views.
- Media uploads are tracked in `MediaAsset`; admin/editor media library is backed by `/api/admin/media`.

## Phase 6 - Native Deployment

Shipped.

- Production runbook: `DEPLOY.md`.
- nginx templates: `nginx/nginx.conf.example` and `nginx/nginx.default.conf`.
- systemd assets: `deploy/systemd/teknav-backend.service`, `teknav-migrate.service`, `teknav-publish-due.service/.timer`, and `teknav-backup.service/.timer`.
- Log rotation: `deploy/logrotate/teknav`.
- Backups: `scripts/systemd-backup.sh`.
- Schema application: `backend/scripts/apply-schema.mjs` via `npm run prisma:apply`.

## Phase 7 - Production CMS Readiness

Shipped.

- Public profiles and profile editing.
- Avatar uploads and WebP conversion support.
- HTML article editor with image upload.
- Email verification and password reset via SMTP.
- Phone OTP via Kavenegar.
- Article scheduling and due-publish timer.
- Activity CSV export.
- Persian SEO metadata, canonical `www.teknav.ir`, sitemap, robots, and RSS feed.
- Three writer-admin seed accounts added for آرسام صباغ, رادمان قلیچی, and سیداحمدرضا محجوب.

## Phase 8 - Engagement + Real-Time Admin

Implemented; Linux validation pending.

- Prisma schema adds comments, comment flags, reading history, notifications, and writer follows.
- Article pages include real API-backed comments/replies, flagging, history tracking, and comment count.
- Header notifications use authenticated SSE at `/api/auth/notifications/stream`.
- Writer profiles expose follower count and follow/unfollow; own profile shows reading history and followed writers.
- Admin/editor dashboard uses SSE at `/api/admin/stream` for active visitors, activity, and live view counter updates.
- Admin/editor comments panel supports flagged filtering, delete, and clear-flag actions.
- nginx templates disable buffering/compression for SSE stream paths.

## Phase 9 - Content Modernization + Publication Features

Implemented. Linux production validation pending.

- Prisma schema adds article SEO fields, daily article view logs, comment likes, newsletter campaigns, article series, editorial review workflow, and reading lists.
- Public API adds related articles, series pages, newsletter unsubscribe, comment likes, and reading-list endpoints.
- Admin API adds analytics, review queue, newsletter campaign send/list, and series CRUD endpoints.
- Frontend article pages consume richer SEO metadata, expose comment likes, keep related articles API-backed, and route public series pages at `/series/:slug`.
- Admin panel adds API-backed Phase 9 sections for analytics, review workflow, newsletter campaigns, and article series.
- `teknav-data.js` finalizes Phase 9 seed/reference metadata: 23 published articles, refreshed dates, canonical paths, Open Graph metadata, and generated content for former placeholders.
- `scripts/generate-seo.mjs` now uses `dateModified`, canonical paths, meta descriptions, and RSS `content:encoded`.
- `scripts/generate-og-images.mjs` provides local OG image generation for article cards; install dependencies on Linux before use.
- Series prev/next navigation banner added to article pages (`SeriesNavBanner`), pulling live series membership from the public article API.

## Phase 10 - SEO Growth, Trust, and Writer Studio

Implemented. Linux production validation pending.

### SEO and trust foundations
- Public topic authority hubs at `/topics/ai`, `/topics/security`, `/topics/software`, `/topics/hardware`, `/topics/startups`, and `/topics/data` with `CollectionPage`, `FAQPage`, `ItemList`, and `BreadcrumbList` JSON-LD.
- `scripts/generate-seo.mjs` covers topic hubs, public author profiles, glossary terms, newsletter archive, and `/ACCOUNTS.md` robots blocking.
- Prisma schema adds editorial trust fields (`factCheckedAt`, `reviewedById`, `sourceNotes`, `contentFreshnessStatus`), `TopicFollow`, newsletter campaign slugs, and the first-party `AnalyticsEvent` table.
- First-party analytics events for article views, newsletter subscriptions, saves, writer/topic follows, and share clicks.
- Topic follows at `/api/topics/:slug/follow` with counts on hub pages.
- Public newsletter archive at `/newsletter` and `/newsletter/:slug`.
- Role-aware panel metrics at `GET /api/admin/panel-metrics`.
- Article approval-to-publish quality gates: review workflow, Phase 10 metadata completion, cache refresh, and writer/topic follower notifications.
- Public tag pages and `GET /api/articles?tag=...`.
- Admin API adds `GET /api/admin/seo/audit`, `GET /api/admin/analytics/content`, `GET /api/admin/analytics/newsletter`, `GET /api/admin/analytics/engagement`.
- `npm run smoke:prod` production health checks.

### Community and retention
- PWA with `manifest.json`, service worker, offline caching, and install prompt.
- Personalized home feed (`sort=personalized`) using followed topics, followed writers, and read history.
- Comment upvoting with best-comment sorting; expanded heart/fire/thinking reactions.
- 5-day reading streaks and "Continue Reading" progress tracking.
- Threaded article Q&A at `/api/articles/:slug/qa`.
- Glossary/dictionary term pages at `/glossary/:slug`.
- "X vs Y" comparison templates with responsive comparison-table styling.

### Auth and trust
- Google/GitHub OAuth at `/api/auth/oauth/:provider`.
- SMS 2FA via Kavenegar OTP; `tek_2fa` ticket-based login completion.
- Verified expert badges on author records, profiles, lists, and article bylines.
- Published article corrections/errata via `ArticleCorrection`.
- Google Discover readiness: 1200×630 local hero images, `fetchPriority="high"`, `max-image-preview:large`.

### Monetization foundations
- `/jobs` with `JobListing` and company submission API.
- `/courses` with course API and public page.
- `/membership` premium membership page.
- `User.membershipTier`, `Article.premiumOnly`, content locking for non-premium readers.
- `Article.sponsored` and public "Promoted Content" labels.

### Operations
- Global Fastify rate limiting.
- Bulk comment moderation.
- First-party client error capture at `/api/errors`.
- `backend/tests/phase10-smoke.test.mjs` for auth/article/comment smoke coverage.
- Weekly newsletter digest job: `npm run newsletter:digest` and `teknav-weekly-digest.timer`.

### Writer Studio V5 (close-out polish)
- HtmlEditor toolbar: grouped buttons (Formatting | Headings | Inline+Block | Lists | Media) with hover states; Bold/Italic labels styled; keyboard shortcuts Ctrl+B, Ctrl+I in editor and Ctrl+S to save draft globally.
- Live word count and character count footer on the editor textarea.
- WritingTipCard: manual prev/next navigation with position counter; auto-advance timer resets on manual nav.
- ArtifactStudio diagram library: gradient placeholder cards replaced with live scaled `DiagramRenderer compact` mini-previews.
- ArtifactStudio code mode: relabelled "code preview" with empty-state hint; was falsely claiming "live preview".
- WeeklyChart data pipeline fixed: was reading non-existent `weeklyViews`; now correctly uses `viewsByDay.slice(-7).map(d => d.views)`.
- Analytics sparklines upgraded: full-width filled-area SVG with gradient, dot on latest point, "۳۰ روز پیش → امروز" axis labels.
- Analytics table: sparklines prefetched for all articles on mount; inline 80×20 mini-sparkline per row; totals footer row; column header corrected to "روند اخیر".
- Overview tab: amber `needsRevision` banner when reviewer has flagged articles; dynamic time-of-day greeting (صبح/ظهر/عصر/شب بخیر) with matching tagline.
- Article editor meta-panel: fields grouped into "اطلاعات پایه", "زمان‌بندی", and collapsible "سئو پیشرفته" sections; slug field added to SEO section.
- Article editor preview mode: renders selected diagram (`DiagramRenderer`) and subtitle above content.
- Article editor: dirty-state indicator (● ذخیره نشده · Ctrl+S) shown when form has unsaved changes.
- Article editor: amber "بازخورد ویراستار" banner when opening a `نیازمند اصلاح` article that has a reviewer note.
- Articles list: hard cap of 15 replaced with show-more/less pagination button; reviewer note shown inline for revision-flagged rows.
- Overview recent-articles: reviewer note shown inline for `نیازمند اصلاح` articles.
- Comments tab: article title chip next to commenter name; "8-recent" cap note with redirect to article; button relabelled to direct to full comment thread.
- Backend: `articleInclude` joins `review { note, status }`; `publicArticle` exposes `reviewNote`; this flows through writer dashboard, articles list, and editor.

## Phase 11 — Platform Completeness

Implemented. Linux production validation pending.

### Track 1 — Admin completeness
- Sponsored / premiumOnly / featured toggle buttons in `ArticleEditor` meta-panel (flags group).
- Content freshness filter dropdown (`current` / `needs_update` / `scheduled_refresh` / `archived`) in articles management list.
- Dedicated SEO audit tab in AdminPanel — full paginated table with severity badges (خطا/هشدار/پیشنهاد) and per-article links; removed hard-capped inline audit from analytics panel.
- Dedicated engagement analytics sub-tab inside analytics panel — 7-day bar chart, event-type breakdown table, top-5 articles.
- Bulk comment moderation: checkbox per row, floating action bar (حذف/تأیید/علامت‌گذاری/لغو انتخاب), wired to existing `POST /api/admin/comments/bulk`.

### Track 2 — Reader UX
- Article card reading list picker: bookmark icon (admin only for logged-in users) opens `ReadingListModal` from any card on the home feed.
- Continue-reading progress overlay: progress bar + "ادامه مطالعه" chip on home feed cards when user has 5–95% progress via `engagementApi.getStreaks()`.
- Scheduled-publish topic notifications: `backend/scripts/publish-due.mjs` now also queries `TopicFollow` for the article's category and notifies topic followers (deduped against writer-follow notifications).
- Google Search Console and Bing Webmaster placeholder verification files in `public/` (`google-token-placeholder.html`, `BingSiteAuth.xml`).

### Track 3 — Monetization
- Premium gate card redesign: blurred/faded content with `mask-image` gradient, `PremiumGateCard` component with crown icon, 3-bullet benefit list, "عضویت ویژه" CTA, and "ورود به حساب" secondary for unauthenticated users.
- Zarinpal membership subscription flow: `POST /api/membership/subscribe` → Zarinpal payment request → gateway redirect; `GET /api/membership/callback` → verify → upgrade `User.membershipTier='premium'` + `membershipExpiresAt` + `Notification`; `GET /api/membership/status`; `MembershipPage` wired with live status and subscribe button; `MembershipSuccessPage` at `/membership/success`.
- Job listing admin panel: `GET /api/admin/jobs` (with status filter) and `PATCH /api/admin/jobs/:id` (approve/reject/featuredUntil) in `monetization.ts`; `JobsPanel` component in admin sidebar; `JobListing.featuredUntil` field added to schema.
- Premium enforcement confirmed: `publicArticle()` in `public.ts` already strips body and sets `premiumLocked: true` for non-premium users on `premiumOnly` articles.

### Track 4 — Reliability
- `ClientError` Prisma model: persists client errors from `POST /api/errors` (was logging-only); `GET /api/admin/errors` returns top-10 messages by count, daily counts (30 days), and 20 most recent raw errors; `ClientErrorsPanel` admin tab with daily sparkline, top-errors table, recent errors list.
- `StorageAdapter` interface in `backend/src/lib/storage.ts`: `LocalStorageAdapter` (default, active on `STORAGE_BACKEND=local` or unset — all uploads go to `config.UPLOAD_DIR`), `S3StorageAdapter` stub (activate with `STORAGE_BACKEND=s3`; not yet wired to a real S3 client). Upload handler in `admin.ts` switched to use the adapter.
- Schema additions: `ClientError`, `MembershipPayment`, `JobListing.featuredUntil`, `NotificationType.system`.

### Data completeness
- `teknav-data.js` expanded to 32 articles (`art1`–`art32`) with full content via `article-contents-*.js` files; all `contentFreshnessStatus` values corrected from `fresh`/`stable` to `current`.

## Phase 12 — Web Push + Published Article Editing

Implemented. Linux production validation pending (VAPID keys + `web-push` install + `PushSubscription` schema apply).

### Web push notifications
- `PushSubscription` Prisma model: `id`, `userId`, `endpoint` (unique), `auth`, `p256dh`, `userAgent`, `createdAt`; `@@index([userId])`; cascade-delete on user removal.
- `backend/src/lib/push.ts`: VAPID init guarded by env var presence (no-op if unconfigured); `buildPushPayload()` maps all 8 `NotificationType` values to Persian `{title, body, url, icon}`; `sendPushToUser()` queries subscriptions, sends via `web-push`, auto-deletes expired (410) endpoints.
- Three new authenticated routes in `notifications.ts`: `GET /api/auth/push/vapid-key` (returns public key), `POST /api/auth/push/subscribe` (upsert by endpoint), `DELETE /api/auth/push/unsubscribe`.
- `createNotification()` in `realtime.ts` extended: fire-and-forget `sendPushToUser()` call after SSE publish; in-app notification path unchanged.
- Service worker: `push` event handler shows RTL/Persian notification with badge; `notificationclick` handler focuses existing window or opens new one at `data.url`.
- `pushApi` client in `engagement-api.js`: `getVapidKey()`, `isSubscribed()`, `subscribe()`, `unsubscribe()` with CSRF token from cookie.
- `PushNotificationPrompt` dismissible banner in `teknav-ui.jsx`: shown to authenticated users when `Notification.permission === 'default'` and not previously dismissed; bottom-right dark overlay, RTL.
- Push toggle in `ProfileSettingsModal` (`teknav-profile.jsx`): handles enabled / blocked / unsupported states; calls `pushApi.subscribe()` / `unsubscribe()`.

### Published article editing
- `ArticleEditor` accepts `role` prop (default `'writer'`); derives `isPublished` and `canPublishDirectly` (true for admin/editor).
- Info banners: blue for writers (changes go to draft/review), green for admin/editor (direct publish with Ctrl+S note).
- Button set branches: admin/editor on published article → "بروزرسانی و انتشار" / "تبدیل به پیش‌نویس" / "زمان‌بندی مجدد"; writer on published article → "ذخیره پیش‌نویس" / "ارسال برای بررسی مجدد".
- Backend PATCH bug fixed in `admin.ts`: removed `PUBLISHED → PENDING` conversion in bulk data update; `requestedStatus === PUBLISHED` is now excluded from the initial DB write and handled cleanly by the existing `publishArticleWithPhase10Checks()` block (preserves original `publishedAt`, runs quality gates).
- `quality_check_failed` (409) error surfaced in `ArticleEditor` save handler — shows specific issue list via toast.

### Bug fixes
- `scripts/generate-seo.mjs`: local `xml` variable inside `url()` function renamed to `lines`; was shadowing the outer `xml()` HTML-escape function, causing image titles to not be escaped.

## Phase 13 — Community Depth + Writer Tools

Implemented. Linux production validation pending (requires `prisma:apply` for new schema additions).

### Schema additions
- `PushSubscription.userId` made nullable (supports guest subscriptions); `topics String[]` array added.
- `NotificationPreference` model: per-user, per-eventType, per-channel (push/email/sms) opt-out toggle; defaults to enabled.
- `UserBadge` model: earned reading badges (AI enthusiast, streak-7, etc.) with `@@unique([userId, badgeType])`.
- `ArticleRevision` model: content snapshot before each article PATCH, capped at 20 per article.

### Web Push for guests
- `POST /api/push/guest-subscribe` (unauthenticated, IP-rate-limited 5/min): stores `PushSubscription` with `userId=null` and `topics` array.
- `DELETE /api/push/guest-unsubscribe`: removes guest subscription by endpoint.
- `GET /api/push/vapid-key`: unauthenticated VAPID public key endpoint.
- `backend/src/lib/push.ts`: `sendGuestPushByTopic(topic, payload)` fans out to `userId IS NULL AND topics @> [topic]`.
- `backend/scripts/publish-due.mjs`: after notifying registered topic followers, also calls `sendGuestPush` for each published article's topic.
- Topic hub pages (`teknav-pages.jsx`): "🔔 دریافت اعلان مقالات" button next to follow button; works without login; persists in browser push subscription.

### Fine-Grained Notification Center
- `GET /api/auth/notifications/preferences`: returns full 8×3 matrix (eventType × channel) with enabled state (default true for unset).
- `PUT /api/auth/notifications/preferences`: batch upsert via `@@unique([userId, eventType, channel])`.
- `sendPushToUser()` in `push.ts` now checks `NotificationPreference` for `channel='push'` before delivering — honors user opt-out.
- `NotificationPreferencesPanel` collapsible section in `ProfileSettingsModal`: toggle grid with inline optimistic updates.

### Verified Reader Badges
- Badge rules: `ai_enthusiast`, `security_expert`, `data_scientist`, `hardware_geek`, `software_craftsman`, `startup_explorer` (10 articles read in topic), plus `streak_7` and `streak_30` (streak count).
- Evaluation runs in `publish-due.mjs` cron — NOT on the article-view hot path.
- `GET /api/auth/badges` and `GET /api/admin/users/:id/badges` endpoints.
- `engagementApi.listBadges()` client method.

### Article Version History
- `ArticleRevision` snapshot created before every PATCH update in `admin.ts` (captures title, content, summary, status, savedById).
- Pruned to 20 most recent per article at write time.
- `GET /api/admin/articles/:id/revisions` (paginated list, no content), `GET /api/admin/articles/:id/revisions/:revisionId` (with full content), `POST /api/admin/articles/:id/revisions/:revisionId/restore` (admin/editor only; snapshots current state before restoring).
- `RevisionDrawer` side-panel in `ArticleEditor`: lists revisions with date/author/status; click to preview content; "بازیابی این نسخه" restores for admin/editor.
- `revisionsApi` client in `engagement-api.js`.

### Collaborative Editing Presence
- Heartbeat: `POST /api/admin/articles/:id/heartbeat` sets `Redis SET presence:article:{id}:user:{uid}` with 45s TTL.
- `GET /api/admin/articles/:id/presence`: SCAN + MGET, enriches with user name/avatar from DB.
- `ArticleEditor` fires heartbeat on mount and every 30s; polls presence every 30s.
- Shows avatar-chip row in editor header when 2+ editors are online on the same article.
- `presenceApi` client in `engagement-api.js`.

## Production Follow-Ups

- On Linux: `cd backend && npm run prisma:generate && npm run prisma:apply && npm run seed`, then frontend SEO/OG generation, frontend/backend builds, `npm run smoke:prod`.
- Verify all flows after schema apply: auth, comments/likes/flags, history, notifications/SSE, reading lists, topic/writer follows, tag pages, series pages, topic hubs, newsletter archive/campaigns, review workflow, analytics endpoints, panel metrics, first-party events.
- Rotate all seed/admin passwords after first production login.
- Remove `resetPasswordOnSeed` from writer-admin credentials after rotation.
- Confirm SMTP and Kavenegar credentials on the server before sending emails/OTPs.
