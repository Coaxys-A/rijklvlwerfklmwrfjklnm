# Phase 11 - Production Launch + Platform Completeness

## Status: Implemented (Linux production validation pending)

## Goal

Ship `https://www.teknav.ir` by completing Linux production validation (Track 0), then close the 13 confirmed platform gaps across admin completeness, reader UX, monetization activation, and reliability without introducing new dependencies or architectural shifts.

---

## Track 0 — Production Gate `[BLOCKING]`

All items in this track must be completed before any Phase 11 feature work begins.

### 0.1 Linux Validation Sequence

Run in order on the production or staging Linux host:

| Step | Command |
|------|---------|
| Generate Prisma client | `cd backend && npm run prisma:generate` |
| Apply schema | `cd backend && npm run prisma:apply` |
| Seed database | `cd backend && npm run seed` |
| Install frontend deps (if needed) | `npm install` |
| Generate SEO artifacts | `npm run seo:sitemap` |
| Generate OG images | `npm run og:images` |
| Build frontend | `npm run build` |
| Build backend | `cd backend && npm run build` |
| Run smoke tests | `npm run smoke:prod` |

### 0.2 Functional Verification Checklist

After schema apply, manually verify each flow:

- [ ] Login by email and by `@username`
- [ ] Signup with display name, username, password, email/phone
- [ ] SMS 2FA enable from profile → login returns `tek_2fa` ticket → `/api/auth/2fa/verify` completes session
- [ ] Google/GitHub OAuth callback and session creation
- [ ] Password reset via SMTP
- [ ] Email verification via SMTP
- [ ] Profile edit for reader, writer, editor, reviewer, admin roles
- [ ] Password change with current-password confirmation
- [ ] Avatar upload and WebP conversion
- [ ] Article create → review workflow → publish (writer → reviewer → editor/admin)
- [ ] Scheduled publish fires via `teknav-publish-due.timer`
- [ ] Comments, replies, likes, flags, upvotes
- [ ] Reading history tracked on article view
- [ ] Reading lists — save to default list, list management
- [ ] Notifications and SSE stream at `/api/auth/notifications/stream`
- [ ] Admin SSE at `/api/admin/stream` (visitor counter, activity)
- [ ] Writer/topic follows and follow counts
- [ ] Tag pages at `/tag/:tag`
- [ ] Topic hub pages at `/topics/ai` etc.
- [ ] Newsletter archive at `/newsletter` and `/newsletter/:slug`
- [ ] Series pages at `/series/:slug`
- [ ] Glossary pages at `/glossary/:slug`
- [ ] Reactions (heart/fire/thinking) on articles
- [ ] Reading streak increments on daily visits
- [ ] Continue-reading progress saved in `ReadHistory.progress`
- [ ] Q&A endpoints at `/api/articles/:slug/qa`
- [ ] `/jobs`, `/courses`, `/membership` pages render
- [ ] Premium article content locking for non-premium readers
- [ ] Sponsored label visible on promoted articles
- [ ] Errata notices on corrected articles
- [ ] Admin analytics at `/api/admin/analytics/*`
- [ ] Panel metrics at `/api/admin/panel-metrics`
- [ ] SEO audit at `/api/admin/seo/audit`
- [ ] First-party error capture at `/api/errors`
- [ ] `/ACCOUNTS.md` returns 403/404 through nginx
- [ ] `/sitemap.xml`, `/robots.txt`, `/feed.xml` return 2xx

### 0.3 Credential Rotation and Hardening

- [ ] Rotate all seed/admin passwords after first production login
- [ ] Remove `resetPasswordOnSeed` flag from writer-admin credentials in `backend/prisma/credentials.json`
- [ ] Confirm SMTP credentials in `/etc/teknav/backend.env`
- [ ] Confirm Kavenegar API key in `/etc/teknav/backend.env`
- [ ] Confirm `OAUTH_CALLBACK_BASE=https://www.teknav.ir` in env
- [ ] Verify `ACCOUNTS.md` is gitignored and HTTP-blocked

---

## Track 1 — Admin + Editor Completeness `[Quick wins — backend fully built]`

All 5 items in this track have complete backend support. Only frontend wiring is missing.

### 1.1 Sponsored / premiumOnly / featured Toggles in ArticleEditor `[S]` ✓ DONE

**Gap:** `Article.sponsored`, `Article.premiumOnly`, and `Article.featured` exist in the Prisma schema and are returned by the admin articles API, but the `ArticleEditor` form in `teknav-admin.jsx` has no UI controls for them. A field helper (`fieldRow`) exists and is used for other boolean fields; these three are simply not called.

**Fix:** Add three toggle rows in the ArticleEditor meta-panel under a new "نشانه‌گذاری" (Flags) collapsible group:
- `premiumOnly` — "فقط اعضای ویژه" with lock icon
- `sponsored` — "محتوای حمایت‌شده" with badge icon
- `featured` — "مقاله ویژه" with star icon

**Files:** `teknav-admin.jsx` → `ArticleEditor` meta-panel

---

### 1.2 Content Freshness Filter in ArticlesManagement `[S]` ✓ DONE

**Gap:** `Article.contentFreshnessStatus` (values: `up_to_date`, `needs_update`, `outdated`) was added in Phase 10 but the `ArticlesManagement` filter bar only filters by `status` (draft/review/published etc.), not by freshness.

**Fix:** Add a `<select>` freshness filter dropdown alongside the existing status filter. Values: همه | به‌روز | نیاز به بازنگری | قدیمی. Wire to the existing articles list query param.

**Files:** `teknav-admin.jsx` → `ArticlesManagement`

---

### 1.3 SEO Audit Dedicated Tab `[S]` ✓ DONE

**Gap:** The SEO audit data from `GET /api/admin/seo/audit` is fetched and displayed inline inside the analytics panel with a hard `.slice(0,8)` cap, and there is no dedicated tab for it. Issues beyond 8 are silently hidden.

**Fix:** Add a `seo-audit` tab to the `AdminPanel` tab bar. Move the full audit table there: show all issues paginated, add severity badges (خطا / هشدار / پیشنهاد), an article link per row, and a summary count header ("X مشکل یافت شد").

**Files:** `teknav-admin.jsx` → `AdminPanel` tabs, remove inline audit from analytics panel

---

### 1.4 Engagement Analytics Dedicated Tab `[S]` ✓ DONE

**Gap:** `GET /api/admin/analytics/engagement` returns event-type counts, but the admin analytics panel only shows them as static count pills with no time-series, no per-article breakdown, and no comparison window.

**Fix:** Add an `engagement` sub-tab inside the existing analytics panel. Show:
- 7-day event count bar chart (reuse `WeeklyChart` or the filled-area SVG sparkline pattern)
- Event-type breakdown table: type | count | percentage of total
- Top 5 articles by engagement event count

**Files:** `teknav-admin.jsx` → analytics panel, `src/lib/admin-api.js` if endpoint not already called

---

### 1.5 Bulk Comment Moderation UI `[M]` ✓ DONE

**Gap:** `POST /api/admin/comments/bulk` with `{ ids: [], action: 'delete'|'approve'|'flag' }` exists in the backend but the `CommentsModeration` panel has no checkboxes or bulk-action toolbar.

**Fix:**
- Add a checkbox column to each comment row (left side, RTL-aware)
- Show a floating bulk-action bar when ≥1 comment is checked: "X مورد انتخاب شده | حذف | تأیید | علامت‌گذاری | لغو انتخاب"
- Wire to `bulkModerateComments(ids, action)` in `src/lib/admin-api.js` (method already exists)
- Clear selection and refresh list after action completes

**Files:** `teknav-admin.jsx` → `CommentsModeration`, `src/lib/admin-api.js`

---

## Track 2 — Reader Experience `[API infrastructure ready]`

### 2.1 Article Card Save List Picker `[S]` ✓ DONE

**Gap:** Saving an article from the article card (home feed, search results, topic pages) calls `contentApi.saveArticle()` directly, which saves to the default list "بعداً بخوانم" without giving the reader a choice. The `ReadingListModal` (list picker) exists in `teknav-articles.jsx` for the full article detail page but is not wired to cards.

**Fix:** Lift `ReadingListModal` (or extract it to a shared location) so it can be triggered from `ArticleCard`. On card save-icon click: open the list picker modal, show user's reading lists + "ایجاد لیست جدید", save to the selected list.

**Files:** `teknav-home.jsx` (or wherever `ArticleCard` lives), `teknav-articles.jsx` (source of `ReadingListModal`)

---

### 2.2 Scheduled-Publish Topic Notifications Bug Fix `[S]` ✓ DONE

**Gap:** `backend/scripts/publish-due.mjs` sends writer-follow notifications when a scheduled article is published, but it does NOT look up `TopicFollow` records and notify topic followers. The `TopicFollow` model and the notification-creation pattern are already in the codebase from Phase 10.

**Fix:** After publishing a scheduled article in `publish-due.mjs`, query `TopicFollow` for the article's topic slug, then insert `Notification` records for each topic follower (same pattern as writer-follow notifications already in the script).

**Files:** `backend/scripts/publish-due.mjs`

---

### 2.3 Continue-Reading Progress Overlay on Article Cards `[S]` ✓ DONE

**Gap:** `ReadHistory.progress` (0–100 integer) is stored per article per user, and the backend returns it in history API responses. Article cards do not show any reading progress indicator, so readers cannot see which articles they have partially read.

**Fix:** On authenticated article card render, check if the article slug appears in the user's recent read history (available from `engagementApi.getHistory()`). If `progress` is between 5 and 95, show a thin progress bar at the bottom of the card image and a "ادامه مطالعه" chip.

**Files:** `teknav-home.jsx` → `ArticleCard`, `src/lib/engagement-api.js`

---

### 2.4 Search Console / Bing Webmaster Verification `[S, operational]` [DONE]

**Gap:** Site verification files for Google Search Console and Bing Webmaster Tools are not in `public/`. These are static files the crawlers expect (e.g. `google<token>.html` and `BingSiteAuth.xml`).

**Fix:** Add placeholder files to `public/` with documented variable names. Operator fills in the actual tokens after production DNS is live. Add them to `sitemap.xml` exclusion so they don't show up as content pages.

**Files:** `public/google<token>.html` (placeholder), `public/BingSiteAuth.xml` (placeholder), `scripts/generate-seo.mjs`

---

## Track 3 — Monetization & Premium

### 3.1 Premium Paywall Gate Card UX Upgrade `[S]` ✓ DONE

**Gap:** Premium article content locking in `teknav-articles.jsx` shows a single bare CTA button with no value proposition, no feature list, and no visual differentiation from the article content above. This produces low conversion.

**Fix:** Replace the bare CTA with a styled "قفل ویژه" gate card:
- Blurred/faded article excerpt above the gate (CSS `mask-image` gradient)
- Crown/lock icon + "این مقاله برای اعضای ویژه" headline
- 3-bullet benefit list (دسترسی به همه مقالات ویژه / بدون تبلیغ / حمایت از تکناو)
- Primary CTA: "عضویت ویژه" → `/membership`
- Secondary: "ورود به حساب" if user is not authenticated

**Files:** `teknav-articles.jsx` → premium gate section

---

### 3.2 Zarinpal Membership Subscription Flow `[L]` ✓ DONE

**Gap:** The `/membership` page is a static positioning page with no payment wiring. `User.membershipTier` exists in the schema but there is no route that upgrades it.

**Design decisions:**
- Payment gateway: **Zarinpal** for IRR transactions; Stripe noted as fallback for USD
- Flow: `/membership` → POST `/api/membership/subscribe` → redirect to Zarinpal → callback to `/api/membership/callback` → set `User.membershipTier = 'premium'` → redirect to `/membership/success`

**New backend routes in `backend/src/routes/monetization.ts`:**
- `POST /api/membership/subscribe` — create Zarinpal payment request, return redirect URL
- `GET /api/membership/callback` — verify Zarinpal callback, upgrade tier, create `Notification`
- `GET /api/membership/status` — return current tier for authenticated user

**Frontend changes:**
- `/membership` page: wire CTA to `POST /api/membership/subscribe`
- `/membership/success` route: show confirmation and "بازگشت به خانه"
- Profile settings: show current membership tier badge

**Files:** `backend/src/routes/monetization.ts`, `teknav-articles.jsx` (membership page), `backend/prisma/schema.prisma` (add `MembershipPayment` model for audit trail)

---

### 3.3 Job Listing Admin Panel `[M]` ✓ DONE

**Gap:** `JobListing` has a `status` field (`pending`, `approved`, `rejected`) and the public `/jobs` endpoint filters for `approved` only. Company submissions go through `POST /api/jobs` but there is no admin UI or admin API endpoint to review and approve/reject pending listings.

**New backend endpoint:**
- `GET /api/admin/jobs` — list all job listings with status filter
- `PATCH /api/admin/jobs/:id` — set status to `approved` or `rejected`, optionally set `featuredUntil`

**Frontend:** Add a "آگهی‌های شغلی" tab to AdminPanel. Show a table: company | title | location | status | submitted date | actions (تأیید / رد / ویژه). Wire to new admin API methods in `src/lib/admin-api.js`.

**Files:** `backend/src/routes/monetization.ts`, `teknav-admin.jsx` → AdminPanel tabs, `src/lib/admin-api.js`

---

### 3.4 Premium Enforcement Audit `[S]` ✓ DONE (confirmed, no changes needed)

**Gap:** `Article.premiumOnly` is stored and returned by the admin API, but a review of `backend/src/routes/public.ts` is needed to confirm that `publicArticle()` strips article body content for non-premium authenticated users and unauthenticated users.

**Fix:** Audit `publicArticle()` in `public.ts`. If body is not stripped, add a content-gate: if `article.premiumOnly && (!user || user.membershipTier !== 'premium')`, return `body: null` and `premiumGated: true` in the serialized response. Confirm the frontend gate card is triggered by `premiumGated: true`.

**Files:** `backend/src/routes/public.ts`, `teknav-articles.jsx`

---

## Track 4 — Reliability & Scale

### 4.1 Automated Test Suite `[L]`

**Gap:** `backend/tests/phase10-smoke.test.mjs` has 3 tests (auth, article fetch, comment post). There are no tests for: auth edge cases, profile editing, reading lists, comment moderation, analytics endpoints, panel metrics, or the review workflow.

**Plan:**
- Expand `backend/tests/` with test files per domain: `auth.test.mjs`, `articles.test.mjs`, `engagement.test.mjs`, `admin.test.mjs`
- Each file: happy path + one error case per endpoint
- Use Node `test` runner (already used in smoke file) — no new test framework
- Target: ~40 tests total; run via `cd backend && npm test`
- Tests run against a local test database (separate `TEST_DATABASE_URL` env var)

**Files:** `backend/tests/`, `backend/package.json` (test script already wired)

---

### 4.2 First-Party Error Aggregation Dashboard `[M]` ✓ DONE

**Gap:** `POST /api/errors` (in `backend/src/routes/errors.ts`) logs client errors to Pino but does not persist them. There is no way for ops/admin to see frontend error counts, top error messages, or affected users.

**Design decision:** Enhance first-party `/api/errors` — consistent with zero-CDN, privacy-first architecture. No self-hosted GlitchTip or external SaaS.

**Backend changes:**
- Add `ClientError` model to `backend/prisma/schema.prisma`: `id`, `message`, `stack`, `url`, `userId` (nullable), `userAgent`, `createdAt`
- `POST /api/errors` persists to `ClientError` in addition to Pino log
- `GET /api/admin/errors` — aggregated view: top 10 error messages by count, count by day (last 30 days), most recent 20 raw errors (admin only)

**Frontend changes:**
- Add "خطاهای کلاینت" tab to AdminPanel (admin-only visibility)
- Show: daily error count sparkline, top-errors table (message | count | last seen), recent raw errors list

**Files:** `backend/prisma/schema.prisma`, `backend/src/routes/errors.ts`, `teknav-admin.jsx`, `src/lib/admin-api.js`

---

### 4.3 S3 Object Storage Interface Design `[M]` ✓ DONE (LocalStorageAdapter active, S3 stub ready)

**Gap:** Uploads go to `/var/lib/teknav/uploads` on local disk. When upload volume outgrows disk, migration to S3-compatible storage (Liara Object Storage, ArvanCloud, or MinIO) will be needed. No interface layer exists; storage path is hardcoded.

**Design (no production wiring in Phase 11):**
- Extract a `StorageAdapter` interface in `backend/src/lib/storage.ts`: `upload(file, key) → url`, `delete(key)`, `url(key)`
- Implement `LocalStorageAdapter` (current behavior, no change)
- Implement `S3StorageAdapter` stub (wired but inactive; activated by `STORAGE_BACKEND=s3` env var)
- Switch upload route in `backend/src/routes/admin.ts` to use the adapter
- Document required env vars: `STORAGE_BACKEND`, `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`

**Files:** `backend/src/lib/storage.ts` (new), `backend/src/routes/admin.ts` (upload handler)

---

### 4.4 Meilisearch Evaluation `[S]`

**Gap:** Persian FTS is handled by PostgreSQL `to_tsvector` with a custom Persian configuration. As article volume grows, ranking quality and response time may degrade. Meilisearch supports Persian (no stemming required for most Persian queries) and has a clean REST API.

**Plan:**
- Stand up a Meilisearch instance on the staging server alongside PostgreSQL
- Index the current 23 published articles
- Run identical queries through both PostgreSQL FTS and Meilisearch
- Measure: result relevance (manual spot-check), P95 query latency, index rebuild time
- Write a short evaluation note (2–3 paragraphs) as a follow-up to this phase
- Production wiring deferred to Phase 12 only if evaluation warrants

**Files:** `backend/src/routes/public.ts` (search endpoint, read-only audit), evaluation note in `docs/meilisearch-eval.md`

---

## Complexity Reference

| ID | Task | Complexity | Track |
|----|------|-----------|-------|
| 1.1 | Sponsored/premiumOnly/featured toggles | S | Admin |
| 1.2 | Content freshness filter | S | Admin |
| 1.3 | SEO audit dedicated tab | S | Admin |
| 1.4 | Engagement analytics dedicated tab | S | Admin |
| 1.5 | Bulk comment moderation UI | M | Admin |
| 2.1 | Article card save list picker | S | Reader |
| 2.2 | Scheduled-publish topic notifications fix | S | Reader |
| 2.3 | Continue-reading overlay on cards | S | Reader |
| 2.4 | Search Console/Bing verification files | S | Ops |
| 3.1 | Premium gate card UX upgrade | S | Monetization |
| 3.2 | Zarinpal membership subscription flow | L | Monetization |
| 3.3 | Job listing admin panel | M | Monetization |
| 3.4 | Premium enforcement audit | S | Monetization |
| 4.1 | Automated test suite | L | Reliability |
| 4.2 | First-party error aggregation dashboard | M | Reliability |
| 4.3 | S3 storage interface design | M | Reliability |
| 4.4 | Meilisearch evaluation | S | Reliability |

S = hours | M = 1–2 days | L = 3–5 days

---

## Implementation Order

All batches 1–4 are complete. Remaining:

### Batch 5 — Deferred (Phase 12 candidates)
- `4.1` Automated test suite (~40 tests) — `backend/tests/`
- `4.4` Meilisearch evaluation on staging → `docs/meilisearch-eval.md`
- S3 storage wiring (when upload volume requires it)

---

## Constraints (carry-forward from Phase 10)

- **Zero CDN.** No third-party hosted JS, CSS, fonts, or assets. Zarinpal redirect is a server-side redirect — no inline scripts.
- **Persian/RTL first.** All new UI labels in Persian; logical CSS properties; no left/right assumptions.
- **No mock admin data.** Every new admin panel or tab must use real API data and show a proper empty state.
- **No Docker.** Production remains native Linux/systemd. S3 storage interface may reference MinIO as a local-dev option only.
- **`ACCOUNTS.md` stays protected.** No new paths or rewrites that could expose it.
- **Backend APIs for all persistence.** Frontend never touches the DB or session store directly.
