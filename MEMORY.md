# MEMORY.md

Durable project context. Keep this concise; plans belong in `ARCH.md`, deployment steps in `DEPLOY.md`, and completion history in `PHASES.md`.

## Project

- Teknav (تکناو) is a Persian RTL technology publication for AI, data science, security, hardware, software, startups, and future tech.
- Public site target: `https://www.teknav.ir`.
- UI language is Persian. Layouts should preserve RTL behavior.

## Stack

- Frontend: Vite 5, React 18.3.1, ES modules, automatic JSX runtime.
- Backend: Node 20, Fastify 4, Prisma 5, PostgreSQL 16, Redis 7, Zod, Pino.
- Auth: Argon2id password hashes, Redis sessions, CSRF double-submit cookie, login by email or `@username`.
- Engagement/publication: comments, comment likes, comment upvotes, reading history, reading lists, notifications, writer follows, newsletter campaigns, article series, review workflow, article corrections, and admin live signals are stored in PostgreSQL and pushed through Redis pub/sub + SSE where live updates are needed.
- Web push: browser push notifications via RFC 8030/VAPID (`web-push` npm package, backend-only). `PushSubscription` DB table stores endpoint/auth/p256dh per user (userId nullable for guest subscriptions + `topics String[]`). `createNotification()` fans out push non-blockingly after every in-app notification. Guest subscriptions receive topic-scoped push from `publish-due.mjs`. `sendPushToUser()` checks `NotificationPreference` before delivery. VAPID keys are in `/etc/teknav/backend.env`.
- Notification preferences: `NotificationPreference` model with `@@unique([userId, eventType, channel])`. Default is enabled (opt-out model). `GET/PUT /api/auth/notifications/preferences` returns/updates 8×3 matrix. Collapsible toggle grid in `ProfileSettingsModal`.
- User badges: `UserBadge` model with 8 badge types (topic-specific + streak). Evaluation runs in `publish-due.mjs` cron. `GET /api/auth/badges` for self, `GET /api/admin/users/:id/badges` for admin view.
- Article version history: `ArticleRevision` snapshot before every PATCH, capped at 20 per article. `RevisionDrawer` in `ArticleEditor`. Restore available to admin/editor only.
- Collaborative presence: Redis TTL keys (`presence:article:{id}:user:{uid}`, 45s). Heartbeat + presence poll every 30s from `ArticleEditor`. Avatar chips shown when 2+ editors are on the same article.
- Delivery integrations: SMTP for password reset/email verification; Kavenegar for phone OTP.
- Growth & Community: Progressive Web App (PWA), reading streaks, personalized article feed, comment upvoting, expanded reactions (heart, fire, thinking), "Continue Reading" progress tracking, threaded Q&A, glossary pages, comparison templates, and FAQ-rich topic hubs.
- Trust & auth: Google/GitHub OAuth, SMS-based 2FA, verified expert badges, and article errata notices are part of the live surface.
- Monetization: jobs/courses public pages, premium membership, sponsored labels (Phase 10 foundations), Zarinpal subscription flow with `MembershipPayment` audit trail, and job listing admin panel are all implemented.
- Assets: fonts and runtime assets are local; zero CDN policy is enforced by `scripts/check-no-cdn.mjs`.
- Deployment: native Linux/systemd + nginx; not Docker.

## Key Paths

| Path | Purpose |
|---|---|
| `src/main.jsx` | Vite entry; mounts app |
| `src/styles/global.css` | local fonts, reset, keyframes, shared utilities |
| `teknav-app.jsx` | root route dispatch |
| `teknav-ui.jsx` | providers, header/footer, shared UI |
| `teknav-auth.jsx` | login/signup/OAuth/forgot-password UI |
| `teknav-profile.jsx` | `/profile/@username`, profile editing, avatar/password/verification controls |
| `teknav-admin.jsx` | CMS UI, article editor, media library, activity/dashboard panels |
| `src/lib/api.js` | fetch wrapper with credentials and CSRF |
| `src/lib/content-api.js` | public content API client |
| `src/lib/admin-api.js` | admin API client |
| `src/lib/engagement-api.js` | comments, history, notifications, follows, Q&A, streaks client |
| `src/lib/seo.jsx` | page-level meta tags and JSON-LD for articles, topics, glossary, newsletter, jobs, courses, and membership |
| `backend/src/routes/lists.ts` | authenticated reading-list API |
| `backend/src/routes/analytics.ts` | authenticated writer/editor analytics API |
| `backend/src/routes/monetization.ts` | public jobs/courses API, admin job moderation, Zarinpal membership routes |
| `backend/src/routes/errors.ts` | first-party client error capture (persists to `ClientError`) and `GET /api/admin/errors` |
| `backend/src/lib/storage.ts` | `StorageAdapter` interface — `LocalStorageAdapter` active by default, `S3StorageAdapter` stub behind `STORAGE_BACKEND=s3` |
| `backend/src/lib/push.ts` | VAPID setup, `sendPushToUser()` (checks preferences), `sendGuestPushByTopic()`, 410 auto-cleanup |
| `backend/src/routes/revisions.ts` | Article revision CRUD — list, get, restore (admin/editor only) |
| `backend/src/lib/realtime.ts` | Redis pub/sub, SSE helpers, visitor counter |
| `backend/src/routes/` | Fastify route modules |
| `backend/prisma/schema.prisma` | Prisma schema |
| `backend/prisma/seed.ts` | seed data, staff users, Persian FTS setup |
| `backend/prisma/credentials.json` | committed seed credentials, hashed on seed |
| `ACCOUNTS.md` | operator credential sheet; gitignored and nginx-blocked |
| `deploy/systemd/` | production units/timers |
| `nginx/nginx.conf.example` | production nginx template |

## Data And Accounts

- `teknav-data.js` is seed/reference data, not an admin-panel fallback source.
- Admin/panel surfaces must use backend APIs only.
- Every seeded user gets a URL-safe username.
- Public signup requires display name, username, password, and email or phone.
- Reader users cannot change username from their profile panel; elevated roles can. All roles can edit display name, bio, avatar, and password.
- Authenticated readers can enable SMS 2FA from profile settings; the login flow returns a 2FA ticket when enabled.
- Writers/editors can mark an article sponsored or premium-only, and editors/admins can record corrections and verified-expert status.
- Current real writers: آرسام صباغ (`arsam-sabbagh`), سیداحمدرضا محجوب (`ahmadreza-mahjoub`), رادمان قلیچی (`radman-ghelichi`).

## Development Status

- Phases 1–13 are fully implemented on Windows. Linux production validation is the only remaining gate before `https://www.teknav.ir` launch. **Phases 11–13 require a `prisma:apply` for new schema additions: `ClientError`, `MembershipPayment`, `JobListing.featuredUntil`, `NotificationType.system`, `PushSubscription` (now extended with nullable userId + topics), `NotificationPreference`, `UserBadge`, `ArticleRevision`.** Also: `cd backend && npm install web-push` and generate VAPID keys on Linux before push goes live.
- File uploads use `LocalStorageAdapter` by default (writes to `config.UPLOAD_DIR` = `/var/lib/teknav/uploads`). S3 migration: set `STORAGE_BACKEND=s3` and wire the `S3StorageAdapter` stub in `backend/src/lib/storage.ts` in a future phase.
- Zarinpal integration requires `ZARINPAL_MERCHANT_ID` in `/etc/teknav/backend.env` to become active. Until set, the subscribe endpoint returns `payment_unavailable`.
- `teknav-data.js` has 32 published articles (`art1`–`art32`) with full content via `article-contents-1.js` through `article-contents-10.js`.
- Writer Studio (`/writer` → `WriterWorkspace`) is fully polished as of V5: grouped toolbar, keyboard shortcuts, live word count, mini diagram previews, analytics inline sparklines, reviewer feedback banners, dirty-state indicator, and collapsible SEO meta-panel.
- Backend `articleInclude` in `backend/src/routes/admin.ts` joins `review { note, status }` so reviewer notes flow to the frontend via `publicArticle.reviewNote`.
- Published article editing: `ArticleEditor` derives `isPublished` and `canPublishDirectly` from props. Admin/editor get "بروزرسانی و انتشار" which PATCHes with `status: 'منتشرشده'`; the backend updates content and runs Phase10 quality gates, keeping the article published. Writers get draft/re-review buttons. PATCH route in `admin.ts` no longer converts `PUBLISHED → PENDING` in the bulk data update.

## Operational Facts

- Production env file: `/etc/teknav/backend.env`.
- Uploads: `/var/lib/teknav/uploads` (local disk, default). S3 migration: set `STORAGE_BACKEND=s3` + S3 env vars.
- Backups: `/var/backups/teknav`.
- Scheduled publishing: `backend/scripts/publish-due.mjs` via `teknav-publish-due.timer`. Also notifies topic followers since Phase 11.
- Schema apply: `npm run prisma:apply`, using migrations when present and `db push --skip-generate` otherwise.
- After schema changes, run `npm run prisma:generate --prefix backend` before backend type-check/build.
- SEO artifacts: `scripts/generate-seo.mjs` writes `public/sitemap.xml`, `public/robots.txt`, and `public/feed.xml`; `scripts/generate-og-images.mjs` writes article OG images to `public/images/og/`.
- Public SEO surfaces include topic hubs, glossary pages, newsletter archive pages, jobs, courses, and membership.
- Zarinpal env vars: `ZARINPAL_MERCHANT_ID`, `ZARINPAL_SANDBOX` (set to `1` for testing), `MEMBERSHIP_PRICE_IRR` (default 5000000 = 500,000 Tomans), `MEMBERSHIP_DURATION_DAYS` (default 365).
- VAPID env vars: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT=mailto:admin@teknav.ir`. If any are missing, `sendPushToUser()` is a no-op (no crash). Generate keys once on Linux: `node -e "const wp=require('web-push');const k=wp.generateVAPIDKeys();console.log(JSON.stringify(k,null,2))"`.
- `BRAND.muted` (`#5F6B6D`) is now defined in the `BRAND` constant in `teknav-admin.jsx` — was used in existing code but missing from the object.
