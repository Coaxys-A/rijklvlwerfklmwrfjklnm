# ARCH.md

Living roadmap and current work status. Detailed completed phase history is in `PHASES.md`; durable project facts are in `MEMORY.md`.

## Current Focus

Phase 13 implemented. Next step: Linux production validation — `prisma:apply` for Phase 13 schema additions (`PushSubscription` extension + `NotificationPreference` + `UserBadge` + `ArticleRevision`), then smoke:prod before `www.teknav.ir` goes live.

Core rules:
- zero CDN dependencies
- Persian/RTL UI
- real backend APIs for all panels
- no Docker deployment work unless explicitly requested
- keep `ACCOUNTS.md` ignored and nginx-blocked

## Recently Shipped

- **Phase 13 — Community depth + writer tools (implemented this session):**
  - Guest push subscriptions: nullable `userId` on `PushSubscription`, `topics String[]`, `POST /api/push/guest-subscribe` (IP-rate-limited), `sendGuestPushByTopic()` in `push.ts`, `publish-due.mjs` fans out to guest subs, "🔔 دریافت اعلان" button on topic hub pages.
  - Fine-grained notification center: `NotificationPreference` model + `GET/PUT /api/auth/notifications/preferences`; `sendPushToUser()` checks push preference before delivery; collapsible toggle grid in `ProfileSettingsModal`.
  - Verified reader badges: `UserBadge` model + 8 badge rules evaluated in `publish-due.mjs` cron; `GET /api/auth/badges` + `GET /api/admin/users/:id/badges`.
  - Article version history: `ArticleRevision` snapshot on every PATCH (capped at 20); `GET/GET/POST /api/admin/articles/:id/revisions[/:id[/restore]]` in `revisions.ts`; `RevisionDrawer` side-panel in `ArticleEditor` with content preview and restore.
  - Collaborative presence: Redis TTL keys (`presence:article:{id}:user:{uid}`, 45s); `POST /api/admin/articles/:id/heartbeat` + `GET /api/admin/articles/:id/presence`; `ArticleEditor` polls every 30s; avatar chips shown when 2+ editors online.
- **Phase 12 — Web push notifications + published article editing:**
  - Browser web push (RFC 8030/VAPID): `PushSubscription` Prisma model + relation on `User`; `backend/src/lib/push.ts` with `sendPushToUser()` fanning out to all user subscriptions, auto-cleaning expired (410) endpoints; `GET /api/auth/push/vapid-key`, `POST /api/auth/push/subscribe`, `DELETE /api/auth/push/unsubscribe` routes in `notifications.ts`; `createNotification()` in `realtime.ts` extended with non-blocking push fan-out; service worker `push` + `notificationclick` handlers with Persian RTL options; `pushApi` client in `engagement-api.js`; `PushNotificationPrompt` dismissible banner in `teknav-ui.jsx`; push toggle (enabled/blocked/unsupported states) in `ProfileSettingsModal`.
  - Published article editing: `ArticleEditor` now accepts `role` prop and derives `isPublished` / `canPublishDirectly`; shows role-appropriate info banner and button set (admin/editor: "بروزرسانی و انتشار" / "تبدیل به پیش‌نویس" / "زمان‌بندی مجدد"; writer: "ذخیره پیش‌نویس" / "ارسال برای بررسی مجدد"); fixed critical backend bug in `admin.ts` PATCH route (was converting `PUBLISHED → PENDING` before the Phase10 quality-gate block, now skips status in the bulk update and lets `publishArticleWithPhase10Checks()` handle it cleanly); `quality_check_failed` error now surfaced in the editor save handler.
  - `scripts/generate-seo.mjs` variable-shadow bug fixed: local `xml` array inside `url()` renamed to `lines` so the outer `xml()` escape function is no longer shadowed.
  - `DEPLOY.md` updated: VAPID key generation block, three VAPID env vars in Section 6, VAPID private key security note, and "Web push not delivering" troubleshooting block.

- **Phase 11 — Platform completeness (implemented this session):**
  - Track 1 admin quick wins: sponsored/premiumOnly/featured toggles in ArticleEditor; content freshness filter in article list; dedicated SEO audit tab (full paginated table); dedicated engagement analytics sub-tab with bar chart and event breakdown; bulk comment moderation with checkbox selection and floating action bar.
  - Track 2 reader UX: article card save-list picker (ReadingListModal wired to bookmark button); continue-reading progress overlay on home feed cards (progress bar + "ادامه مطالعه" chip); scheduled-publish notifications extended to topic followers; Google/Bing webmaster verification placeholder files in `public/`.
  - Track 3 monetization: premium gate card redesigned (blurred fade + crown icon + benefit list + dual CTA); Zarinpal membership subscription flow end-to-end (`POST /api/membership/subscribe` → gateway redirect → `GET /api/membership/callback` → tier upgrade + notification → `/membership/success`); job listing admin panel with approve/reject/featured actions; premium content enforcement confirmed in `publicArticle()`.
  - Track 4 reliability: `ClientError` Prisma model + `GET /api/admin/errors` aggregated admin view + admin "خطاهای کلاینت" tab with daily sparkline and top-errors table; `StorageAdapter` interface in `backend/src/lib/storage.ts` — `LocalStorageAdapter` is active (default, no env var needed), `S3StorageAdapter` stub activates with `STORAGE_BACKEND=s3`; upload route in `admin.ts` switched to use the adapter.
  - Schema additions: `ClientError`, `MembershipPayment`, `JobListing.featuredUntil`, `NotificationType.system` enum value.
  - 32 articles with complete metadata now in `teknav-data.js`; all `contentFreshnessStatus` values corrected to enum-valid values.
- Phase 10 foundation: `/topics/*` authority hubs, public tag pages, topic/series/newsletter structured data, sitemap topic/profile/newsletter/tag coverage, topic follows, newsletter archive pages, share tracking, role-aware panel metrics, approval-to-publish quality gates, production smoke script, editorial quality fields, first-party analytics events, and admin SEO/analytics endpoints.
- **Writer Studio V5 polish (Phase 10 close-out):** HtmlEditor grouped toolbar with hover states and keyboard shortcuts (Ctrl+B/I/S); live word/char count footer; WritingTipCard prev/next nav with timer reset; ArtifactStudio diagram library replaced gradient placeholders with live scaled mini-previews; analytics sparklines upgraded to filled-area SVG with gradient and date labels; analytics table gains prefetched inline mini-sparklines per row and a totals footer; dirty-state indicator; reviewer feedback banner; articles list pagination; backend `articleInclude` joins `review { note, status }` and `publicArticle` exposes `reviewNote`.
- Phase 9 publication features: SEO article fields, daily view logs, related articles, article series, comment likes, reading lists, newsletter campaigns, review workflow, and admin analytics.
- Phase 8 reader engagement: article comments/replies, comment flagging, reading history, in-app notifications, writer follows, and SSE-powered live admin signals.
- Username login: users can authenticate with email or `@username`.
- Signup finalization: display name, username, password, and email/phone are collected.
- Profile finalization: every role can edit display name, username, bio, avatar, verification data, and password.
- Seed finalization: every seeded user gets a username.
- Writer-admin accounts: آرسام صباغ, رادمان قلیچی, سیداحمدرضا محجوب in `backend/prisma/credentials.json`; operator credentials in ignored `ACCOUNTS.md`.
- Native deployment docs: `DEPLOY.md` covers systemd, nginx, TLS, env, backups, schema apply, scheduled publishing, and health checks.
- Phase 7 CMS readiness: media library, scheduled publishing, activity CSV export, real dashboard metrics, SMTP email flows, Kavenegar OTP.

## Active Checklist

### Phase 13 — Linux production setup (required before new features go live)
- [ ] `cd backend && npm run prisma:apply` — apply Phase 13 schema: `PushSubscription` changes, `NotificationPreference`, `UserBadge`, `ArticleRevision`
- [ ] `cd backend && npm run prisma:generate` — regenerate Prisma client
- [ ] Verify guest push: visit topic hub → click "🔔 دریافت اعلان" → grant permission → push subscription in DB with `userId=null`
- [ ] Verify notification preferences: profile settings → "تنظیمات اعلان‌ها" → toggle push channel → notification skipped on next trigger
- [ ] Verify revision history: edit any article → save → open "تاریخچه" drawer → revision appears → restore works
- [ ] Verify presence: open same article in two tabs → both show avatar chip in editor header

### Phase 12 — Linux production setup (required before push goes live)
- [ ] `cd backend && npm install web-push` — install web-push package (can't install on Windows)
- [ ] Generate VAPID keys: `node -e "const wp=require('web-push');const k=wp.generateVAPIDKeys();console.log(JSON.stringify(k,null,2))"`
- [ ] Add to `/etc/teknav/backend.env`: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT=mailto:admin@teknav.ir`
- [ ] `cd backend && npm run prisma:generate` — regenerate client for `PushSubscription` model
- [ ] `cd backend && npm run prisma:apply` — apply all Phase 11+12 schema additions
- [ ] `cd backend && npm run seed` — reseed if needed

### Full Linux production verification
- [ ] `npm run seo:sitemap` — regenerate sitemaps
- [ ] `npm run check:seo` — audit Persian article SEO quality gate
- [ ] `npm run build` — frontend build
- [ ] `cd backend && npm run build` — backend TypeScript build
- [ ] `npm run smoke:prod` — smoke test all endpoints
- [ ] Verify Phase 8–10 flows: comments, history, notifications/SSE, reading lists, follows, analytics, review workflow, newsletter campaigns.
- [ ] Verify Phase 11 flows: `/membership` subscribe → Zarinpal callback → success page; `/api/admin/jobs` approve/reject; `/api/admin/errors` aggregated view; premium gate card on premium articles; article card bookmark → reading list picker; continue-reading overlay on home feed.
- [ ] Verify Phase 12 push flow: log in as reader → `PushNotificationPrompt` banner appears → grant permission → `PushSubscription` row in DB → profile toggle shows "فعال" → publish article or trigger comment reply → browser push notification arrives → click notification navigates correctly.
- [ ] Verify published article editing: admin opens published article → sees green "بروزرسانی و انتشار" button → save updates content and keeps status published; writer opens own published article → sees draft/re-review buttons → save demotes to draft/pending.
- [ ] Verify `/api/errors` persists to `ClientError` table (was logging-only before Phase 11).
- [ ] Verify `STORAGE_BACKEND` is unset or `local` on server — uploads go to `/var/lib/teknav/uploads`.
- [ ] Verify `/ACCOUNTS.md` returns 404/403 through nginx.
- [ ] Rotate production passwords after first login.
- [ ] Set `ZARINPAL_MERCHANT_ID` in `/etc/teknav/backend.env` when payment goes live.
- [ ] Remove `resetPasswordOnSeed` from writer-admin accounts after rotation.
- [ ] Confirm SMTP and Kavenegar credentials on the server.

## Roadmap

### Done

- Phase 1: Vite/React conversion and zero-CDN frontend.
- Phase 2: PostgreSQL/Prisma/Redis backend seed and Persian FTS.
- Phase 3: Argon2id auth, Redis sessions, CSRF, captcha, login/signup.
- Phase 4: public REST API, caching, search, newsletter, reactions/saves.
- Phase 5: role-gated Admin/CMS API and API-backed admin panel.
- Phase 6: native nginx/systemd deployment assets and runbook.
- Phase 7: profiles, media, scheduled publishing, verification delivery, SEO/crawler artifacts, account finalization.
- Phase 8: reader engagement and real-time admin over SSE.
- Phase 9: content modernization, SEO enrichment, publication workflow, reading lists, newsletter campaigns, article series, and analytics.
- Phase 10: topic authority hubs, tag pages, newsletter archive, topic/writer follows, share tracking, role-aware panel metrics, approval-to-publish quality gates, editorial fields, first-party analytics events, admin SEO/analytics endpoints, production smoke checks, PWA, reading streaks, personalized feed, comment upvoting, reactions, Q&A, glossary, comparison templates, OAuth, 2FA, verified expert badges, errata, monetization foundations (jobs/courses/membership/premium), Writer Studio V5 full polish, and series article navigation. Linux production validation pending.

### Future

Phases 11–13 are implemented. Remaining deferred items:

- **4.1 Automated test suite** `[L]` — expand `backend/tests/` to ~40 tests covering auth edge cases, profiles, reading lists, comment moderation, analytics, and review workflow.
- **4.4 Meilisearch evaluation** `[S]` — stand up Meilisearch on staging, index articles, compare Persian FTS quality and latency vs PostgreSQL; write evaluation note in `docs/meilisearch-eval.md`.

Phase 14 candidates:
- Wire `S3StorageAdapter` with a real S3 client when upload volume requires it (activate with `STORAGE_BACKEND=s3`).
- Expand Zarinpal flow to cover renewal/expiry reminders.
- Surface earned badges on public profile pages and article comment bylines.
- Email/SMS channel enforcement in `createNotification()` — currently only push channel is gated by preferences.

## Known Risks

- Production email/SMS requires correct SMTP and Kavenegar credentials.
- `ACCOUNTS.md` intentionally contains plaintext operator credentials; it must remain ignored and inaccessible over HTTP.
- This repo currently uses `prisma:apply` because no Prisma migration directory is present.
- `teknav-store.js` and `teknav-data.js` still exist for seed/reference paths; do not reintroduce them as admin-panel data fallbacks.
