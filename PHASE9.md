# Phase 9 — Content Modernization, Publication Features & SEO Enrichment

## Status: Implemented; Linux validation pending

Implemented in this pass:

- Additive Prisma models/fields for SEO metadata, article view logs, newsletter campaigns, article series, editorial reviews, comment likes, and reading lists.
- Backend APIs for related articles, public series pages, newsletter unsubscribe, admin analytics, review workflow, newsletter campaigns, series management, comment likes, and authenticated reading lists.
- Frontend API clients and visible admin panels for analytics, reviews, newsletter campaigns, and series management.
- Article page support for comment likes, API-backed related articles, author/profile navigation, and richer SEO metadata consumption.
- Seed/reference content now finalizes 23 published articles, refreshes old dates/slugs, promotes former draft/review items, and adds Phase 9 SEO fields.
- Sitemap/RSS generation now uses canonical paths, `dateModified`, `metaDescription`, and full-content RSS payloads.

Not run locally by request: frontend/backend builds and Prisma generation. Validate on Linux with the commands in `ARCH.md`/`AGENTS.md`.

All work targets the `SERVER/` directory. Content research uses web search and Context7 for technical accuracy. Schema changes are additive (nullable/defaulted) and backward-compatible.

---

## Overview

Phase 9 has three pillars:

1. **Content modernization.** 17 of 18 articles have placeholder content. All are dated 1403. AI model references are two generations stale. The publication needs to be current, factually accurate, and complete.
2. **Publication features.** Ten features a real tech publication needs but Teknav currently lacks: newsletter campaigns, article series, related articles, comment votes, writer analytics, syntax highlighting, social share, admin time-series charts, editorial review workflow, and a bookmark/reading-list system.
3. **SEO enrichment.** Every article needs `metaDescription`, Open Graph metadata, JSON-LD structured data, and a canonical URL. OG images generated locally. Sitemap and RSS updated.

---

## 9.1 — Article Content Expansion

### Goal
Full Persian prose for all 17 stub articles + refresh art1. Every article must be factually current as of Ordibehesht 1405 / April 2026.

### Research Process (per article)
1. **Web search** the topic for the latest benchmarks, releases, and numbers.
2. **Context7** for articles touching library APIs, language specs, or framework internals (Rust, Kubernetes, WebAssembly).
3. Apply the model reference mapping below throughout.

### Model Reference Update Table

| Outdated reference | Replace with (1405 / 2026) |
|---|---|
| Claude 3 Opus | Claude Opus 4.7 |
| GPT-4 / GPT-4 Turbo | GPT-4o / o3 |
| Gemini Ultra / Gemini 1.5 | Gemini 2.5 Pro |
| Phi-3 | Phi-4 |
| Mistral 7B / Mistral Large | Mistral Large 2 |
| Llama 3.2 | Llama 4 Scout / Maverick |
| H100 (as cutting-edge) | GB200 / Blackwell |
| B200 (as upcoming) | B200 (shipping), GB200 NVL72 (current flagship) |
| NeurIPS 2024 / ICML 2024 | NeurIPS 2025 / ICML 2025 |

### Content Requirements (per article)
- Minimum 800 words of substantive Persian prose.
- At least two `<h2>` and one `<h3>`.
- One `<blockquote>` citing a real expert or published finding.
- One `<div class="insight-box">` with a key takeaway.
- One `<div class="footnote-box">` citing sources.
- Factually current as of Ordibehesht 1405.

### Article Date Refresh

| ID | Slug | New Date (Persian) | New dateEn |
|---|---|---|---|
| art1 | ai-clean-data | ۱۴۰۵/۰۲/۰۱ | 2026-04-21 |
| art2 | custom-ai-chips | ۱۴۰۵/۰۱/۲۵ | 2026-04-14 |
| art3 | browser-architecture | ۱۴۰۵/۰۱/۲۰ | 2026-04-09 |
| art4 | software-supply-chain | ۱۴۰۵/۰۱/۱۵ | 2026-04-04 |
| art5 | iranian-startups-scale | ۱۴۰۵/۰۱/۱۰ | 2026-03-30 |
| art6 | small-llms | ۱۴۰۵/۰۱/۰۵ | 2026-03-25 |
| art7 | edge-computing | ۱۴۰۴/۱۲/۲۵ | 2026-03-16 |
| art8 | synthetic-data | ۱۴۰۴/۱۲/۱۵ | 2026-03-06 |
| art9 | ai-hardware-roadmap | ۱۴۰۴/۱۲/۰۵ | 2026-02-24 |
| art10 | quantum-computing | ۱۴۰۴/۱۱/۲۵ | 2026-02-14 |
| art11 | microservices-vs-monolith | ۱۴۰۴/۱۱/۱۵ | 2026-02-04 |
| art12 | fintech-regulation | ۱۴۰۴/۱۱/۰۵ | 2026-01-25 |
| art13 | llm-security | ۱۴۰۴/۱۰/۲۵ | 2026-01-15 |
| art14 | data-governance | ۱۴۰۴/۱۰/۱۵ | 2026-01-05 |
| art15 | robotics-warehouse | ۱۴۰۴/۱۰/۰۵ | 2025-12-26 |
| art16 | open-source-ai | ۱۴۰۴/۰۹/۲۵ | 2025-12-16 |
| art17 | rust-systems | ۱۴۰۴/۰۹/۱۵ | 2025-12-06 |
| art18 | venture-capital-ai | ۱۴۰۴/۰۹/۰۵ | 2025-11-26 |

Rename art10 slug: `quantum-computing-2024` → `quantum-computing`.

---

## 9.2 — New Articles (1405 Topics)

Five new articles on topics that did not exist or were not prominent in 1403.

| ID | Slug | Title | Category | Author | Date |
|---|---|---|---|---|---|
| art19 | claude-opus-47-reasoning | کلود اوپوس ۴.۷ و تحول در مدل‌های استدلالی | ai | آرسام صباغ | ۱۴۰۵/۰۲/۰۸ |
| art20 | agentic-ai-production | هوش مصنوعی عاملی از آزمایشگاه تا تولید | ai | آرسام صباغ | ۱۴۰۵/۰۲/۰۵ |
| art21 | vibe-coding | وایب‌کدینگ و آینده برنامه‌نویسی با هوش مصنوعی | software | سیداحمدرضا محجوب | ۱۴۰۵/۰۱/۲۸ |
| art22 | ai-energy-crisis | بحران انرژی مراکز داده: قیمت واقعی هوش مصنوعی | future | رادمان قلیچی | ۱۴۰۵/۰۱/۲۲ |
| art23 | llama4-open-frontier | Llama 4 و مرز جدید مدل‌های متن‌باز | ai | آرسام صباغ | ۱۴۰۵/۰۱/۱۸ |

**art19:** Claude Opus 4.7 معرفی، مقایسه با o3 و Gemini 2.5 Pro، بنچمارک‌های MATH/GPQA/SWE-bench، دلالت‌های عملی برای توسعه‌دهندگان.

**art20:** چرخه think-act-observe، معماری‌های multi-agent، ریسک‌های autonomy، مقایسه Claude Code، OpenAI Operator، Google Mariner.

**art21:** تعریف Vibe Coding (اصطلاح Karpathy)، تأثیر بر چرخه توسعه، نقد جدی‌پذیری، مقایسه Cursor، Copilot، Claude Code.

**art22:** مصرف برق مراکز داده AI (500+ TWh در 2026)، چالش‌های شبکه، PUE، تأثیر بر اهداف کربن.

**art23:** Llama 4 Scout/Maverick/Behemoth، معماری MoE، مقایسه با GPT-4o و Claude Sonnet 4.6، استقرار on-premise.

---

## 9.3 — SEO Metadata Layer

### New Fields per Article in `teknav-data.js`

```js
{
  metaDescription: '...',      // 120–155 chars, Persian plain text
  keywords: ['کلمه ۱', ...],   // 6–10 Persian terms
  ogTitle: '...',              // og:title override (defaults to title)
  ogDescription: '...',        // 200–300 chars for og:description
  ogImage: '/images/og/slug.jpg',
  canonicalPath: '/articles/slug',
  dateModified: '2026-...',    // ISO — for JSON-LD dateModified and sitemap <lastmod>
}
```

### Prisma Schema Changes

```prisma
model Article {
  // existing fields unchanged ...
  metaDescription  String?   @db.VarChar(160)
  keywords         String[]  @default([])
  ogTitle          String?   @db.VarChar(200)
  ogDescription    String?   @db.VarChar(300)
  ogImage          String?
  canonicalPath    String?
  dateModified     DateTime?
}
```

All nullable/defaulted — no migration failure on existing rows. After change: `prisma:generate` → `prisma:apply`.

### `seed.ts` Update

Extend the article upsert to include all new SEO fields.

### Article Detail Page `<head>` Block

```html
<title>{title} | تکناو</title>
<meta name="description" content="{metaDescription}" />
<meta name="keywords" content="{keywords.join(',')}" />
<link rel="canonical" href="https://www.teknav.ir{canonicalPath}" />

<meta property="og:type" content="article" />
<meta property="og:title" content="{ogTitle || title}" />
<meta property="og:description" content="{ogDescription || metaDescription}" />
<meta property="og:image" content="https://www.teknav.ir{ogImage}" />
<meta property="og:url" content="https://www.teknav.ir{canonicalPath}" />
<meta property="og:locale" content="fa_IR" />
<meta property="og:site_name" content="تکناو" />
<meta property="article:published_time" content="{dateEn}" />
<meta property="article:modified_time" content="{dateModified}" />
<meta property="article:author" content="{authorName}" />
<meta property="article:section" content="{categoryName}" />

<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="{ogTitle || title}" />
<meta name="twitter:description" content="{metaDescription}" />
<meta name="twitter:image" content="https://www.teknav.ir{ogImage}" />
```

### JSON-LD Structured Data

Inject `<script type="application/ld+json">` in article detail page:

```json
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "{title}",
  "description": "{metaDescription}",
  "datePublished": "{dateEn}",
  "dateModified": "{dateModified}",
  "inLanguage": "fa",
  "author": {
    "@type": "Person",
    "name": "{authorName}",
    "url": "https://www.teknav.ir/profile/@{authorUsername}"
  },
  "publisher": {
    "@type": "Organization",
    "name": "تکناو",
    "url": "https://www.teknav.ir",
    "logo": { "@type": "ImageObject", "url": "https://www.teknav.ir/favicon.png" }
  },
  "image": "https://www.teknav.ir{ogImage}",
  "mainEntityOfPage": { "@type": "WebPage", "@id": "https://www.teknav.ir{canonicalPath}" }
}
```

---

## 9.4 — OG Image Generation

Node script `scripts/generate-og-images.mjs` uses `@napi-rs/canvas` (npm, zero CDN) to produce 23 × 1200×630 JPEG files in `public/images/og/`. Each image: category brand color background, site name top-right, article title centered (Vazirmatn font loaded locally), category badge bottom-right.

---

## 9.5 — SEO Artifacts Refresh

- Update `scripts/generate-seo.mjs` to use `dateModified` in sitemap `<lastmod>` and `metaDescription` in RSS `<description>`.
- RSS `<content:encoded>` must include the full article HTML.
- Run `npm run seo:sitemap` after all content changes.

---

## 9.6 — Article Status Cleanup

art17 (`rust-systems`) is `پیش‌نویس` and art18 (`venture-capital-ai`) is `در انتظار بررسی`. Both get full content in Phase 9 and are promoted to `منتشرشده`.

---

## 9.7 — Newsletter Campaign System

### Goal
The platform already collects subscriber emails. Phase 9 closes the loop: admins compose and send a newsletter campaign to all confirmed subscribers directly from the admin panel.

### Schema

```prisma
model NewsletterCampaign {
  id          String    @id @default(cuid())
  subject     String    @db.VarChar(200)
  bodyHtml    String    @db.Text
  sentAt      DateTime?
  recipientCount Int    @default(0)
  createdBy   User      @relation(fields: [createdById], references: [id])
  createdById Int
  createdAt   DateTime  @default(now())
}
```

### Backend Routes

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/admin/newsletter/campaigns` | admin | List all campaigns |
| `POST` | `/api/admin/newsletter/campaigns` | admin | Create draft campaign |
| `PUT` | `/api/admin/newsletter/campaigns/:id` | admin | Edit draft (before send) |
| `POST` | `/api/admin/newsletter/campaigns/:id/send` | admin | Send to all active subscribers |
| `GET` | `/api/admin/newsletter/subscribers` | admin | List subscribers (paginated, export CSV) |
| `DELETE` | `/api/admin/newsletter/subscribers/:id` | admin | Remove a subscriber |

### Send Logic
- `POST .../send` is idempotent — once `sentAt` is set, re-sending returns 409.
- Uses existing `backend/src/lib/email.ts` SMTP sender.
- Sends in batches of 50 with a 200ms delay between batches to avoid SMTP rate limits.
- Each email includes a plain-text unsubscribe link: `https://www.teknav.ir/api/newsletter/unsubscribe?token={token}`.
- Each `NewsletterSubscriber` row gets a unique `unsubscribeToken` (random UUID, generated on subscription).
- `GET /api/newsletter/unsubscribe?token=` removes the subscriber and returns a plain 200.

### Schema Addition to NewsletterSubscriber

```prisma
model NewsletterSubscriber {
  // existing fields ...
  unsubscribeToken String @unique @default(cuid())
}
```

### Frontend (Admin)
- New "خبرنامه" tab in admin sidebar (admin role only).
- Campaign list with status (پیش‌نویس / ارسال‌شده), subject, recipient count, send date.
- Campaign composer: subject input + HTML textarea (same editor controls as article editor).
- Preview renders the HTML in a sandboxed `<iframe>`.
- "ارسال به همه مشترکان" button with a count confirmation dialog: "ارسال به ۱٬۲۳۴ مشترک؟".
- Subscriber list panel: table of emails + subscribe date + unsubscribe button.

---

## 9.8 — Article Series

### Goal
Group thematically linked articles into ordered series (e.g., «سری: راهنمای کامل LLMها»). Readers see their position in the series and can navigate between parts. Great for long-form coverage and reader retention.

### Schema

```prisma
model ArticleSeries {
  id          String          @id @default(cuid())
  title       String          @db.VarChar(200)
  slug        String          @unique
  description String?         @db.VarChar(500)
  coverImage  String?
  createdAt   DateTime        @default(now())
  articles    SeriesArticle[]
}

model SeriesArticle {
  id        String        @id @default(cuid())
  series    ArticleSeries @relation(fields: [seriesId], references: [id], onDelete: Cascade)
  seriesId  String
  article   Article       @relation(fields: [articleId], references: [id], onDelete: Cascade)
  articleId String
  position  Int

  @@unique([seriesId, articleId])
  @@unique([seriesId, position])
}
```

### Backend Routes

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/series` | public | List all series |
| `GET` | `/api/series/:slug` | public | Series detail with ordered articles |
| `GET` | `/api/admin/series` | editor+ | Admin list |
| `POST` | `/api/admin/series` | editor+ | Create series |
| `PUT` | `/api/admin/series/:id` | editor+ | Update title/description/cover |
| `POST` | `/api/admin/series/:id/articles` | editor+ | Add article to series at position |
| `DELETE` | `/api/admin/series/:id/articles/:articleId` | editor+ | Remove from series |
| `PUT` | `/api/admin/series/:id/reorder` | editor+ | Reorder articles (body: `{ order: [articleId, ...] }`) |

### Frontend
- **Series page** `/series/:slug` — cover, description, ordered article list with part numbers (قسمت ۱، قسمت ۲...).
- **Article detail** — if the article belongs to a series, show a "این مقاله بخشی از سری..." banner above the content. Banner includes prev/next navigation.
- **Admin series management** — new "سری‌ها" tab in admin sidebar. Create/edit series, drag-and-drop to reorder articles using a simple up/down button pair (no drag library needed).

---

## 9.9 — Related Articles Engine

### Goal
Show three related articles at the bottom of every article. Relation is computed by tag overlap — no ML needed. Results cached in Redis.

### Backend

New route: `GET /api/articles/:slug/related` — returns up to 3 articles.

Algorithm:
1. Get the current article's tag IDs.
2. Find published articles sharing the most tags (excluding self), limited to 3.
3. Tiebreak by `views DESC`.
4. Cache result in Redis `related:{articleId}` with TTL 1 hour.
5. Clear cache when any article is published, edited, or deleted.

```sql
-- Prisma raw for tag overlap score
SELECT a.id, COUNT(at.tagId) AS overlap
FROM Article a
JOIN ArticleTag at ON at.articleId = a.id
WHERE at.tagId IN (<current article tag IDs>)
  AND a.id != <current article id>
  AND a.status = 'منتشرشده'
GROUP BY a.id
ORDER BY overlap DESC, a.views DESC
LIMIT 3
```

### Frontend
- `RelatedArticles` component at the bottom of `ArticleDetail`, after comments.
- Three cards in a horizontal row (single column on mobile), each showing cover color, title, category, read time, author.
- Loaded via `GET /api/articles/:slug/related` on article mount.

---

## 9.10 — Comment Helpfulness Votes

### Goal
Readers can upvote useful comments. Comments with more votes sort higher. Discourages noise and surfaces quality discussion.

### Schema

```prisma
model CommentLike {
  id        String   @id @default(cuid())
  comment   Comment  @relation(fields: [commentId], references: [id], onDelete: Cascade)
  commentId String
  user      User     @relation(fields: [userId], references: [id])
  userId    Int
  createdAt DateTime @default(now())

  @@unique([commentId, userId])
}
```

Add `likeCount Int @default(0)` to the `Comment` model.

### Backend Routes

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/comments/:id/like` | session | Toggle like (like if not liked, unlike if already liked) |

`GET /api/articles/:slug/comments` — add `likeCount` and `likedByMe` (bool, based on session) to each comment object. Default sort changes to: top-level comments ordered by `likeCount DESC, createdAt DESC`.

### Frontend
- Each comment card shows a "👍 مفید بود ({likeCount})" button (no emoji in production — use an SVG thumbs-up from global SVG sprite or inline).
- Authenticated users can click to toggle. The count updates optimistically.
- The button is teal-accented when liked by the current user, muted otherwise.
- Guests see the count but cannot vote.

---

## 9.11 — Writer Analytics Dashboard

### Goal
Writers see per-article performance stats: views over time, reaction breakdown, comment counts, and follower growth. Editors and admins see the same for any article. Data visualised with pure SVG sparklines — no chart library dependency.

### Backend Routes

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/auth/analytics/overview` | session (writer+) | Total views, reactions, comments, followers |
| `GET` | `/api/auth/analytics/articles` | session (writer+) | Per-article stats list |
| `GET` | `/api/auth/analytics/article/:slug` | session (writer+, must own or be editor+) | Daily view/reaction time-series for one article (last 30 days) |
| `GET` | `/api/admin/analytics/article/:slug` | editor+ | Same, unrestricted |

### Time-Series Data Source
The existing `ActivityLog` table logs article publishes. Views are buffered in Redis and flushed to the `Article.views` field. For a time-series breakdown, add:

```prisma
model ArticleViewLog {
  id        String   @id @default(cuid())
  article   Article  @relation(fields: [articleId], references: [id], onDelete: Cascade)
  articleId String
  date      DateTime @db.Date
  views     Int      @default(0)

  @@unique([articleId, date])
}
```

`flushViewCounters()` (which already runs every 60s) is extended to also upsert a `ArticleViewLog` row for today's date. This gives per-day granularity.

### Frontend
- New "آمار" tab in the writer's profile settings panel (visible to own writer/editor/admin).
- Overview cards: کل بازدیدها، کل واکنش‌ها، کل نظرها، دنبال‌کنندگان.
- Article table: slug, title, views, reactions, comments — sortable.
- Clicking an article row shows a 30-day sparkline (SVG, pure path element) for views.
- SVG sparkline: 300×60px, line chart, no axes — just the trend shape.

---

## 9.12 — Local Syntax Highlighting

### Goal
Technical articles with `<pre><code>` blocks render highlighted code. Highlight.js installed via npm (not CDN). Auto-detects language from `class="language-*"`. RTL article layout must not break LTR code blocks.

### Implementation

Install: `npm install highlight.js` in root package.json.

In `teknav-articles.jsx`, after the article HTML is injected via `dangerouslySetInnerHTML`, use a `useEffect` to:
1. Query all `pre code` elements inside the article body.
2. Call `hljs.highlightElement(el)` on each.
3. Force `direction: ltr; text-align: left` on every `<pre>` via inline style so RTL layout doesn't reverse code.

Import only the languages needed to keep bundle size small:
- `javascript`, `typescript`, `python`, `bash`, `sql`, `json`, `rust`, `go`, `yaml`, `docker`

Register them with `hljs.registerLanguage(...)`. Do not use `hljs.highlightAll()` (too broad).

Add a highlight.js theme (`github-dark.min.css`) to `src/styles/` — copied from the npm package's `styles/` folder, never from a CDN.

Add a language label above each code block: read the `class` attribute, strip `language-`, show as a small badge (e.g., `python`).

### Zero CDN Check
`scripts/check-no-cdn.mjs` must not flag highlight.js. Since it's bundled via Vite from npm, it produces a local `/assets/...` chunk — no external URL. Verify after `npm run build`.

---

## 9.13 — Social Share (URL-Scheme Only)

### Goal
Readers can share articles to Telegram, Twitter/X, and WhatsApp, and copy the article URL to clipboard. Zero CDN — all share actions use URL schemes or the browser Clipboard API. No tracking pixels.

### Frontend

`SocialShare` component rendered in `ArticleDetail` below the article byline.

Share targets:

| Platform | URL scheme |
|---|---|
| Telegram | `https://t.me/share/url?url={url}&text={title}` |
| Twitter/X | `https://x.com/intent/tweet?url={url}&text={title}` |
| WhatsApp | `https://api.whatsapp.com/send?text={title}+{url}` |
| Copy link | `navigator.clipboard.writeText(url)` → toast "لینک کپی شد" |

All share URLs open in a new tab (`target="_blank" rel="noopener"`). Icons are inline SVGs from a local sprite (no CDN icon fonts). Buttons are small and unobtrusive — placed in a compact row right of the article metadata line.

Share count is NOT tracked (avoids the need for a counter service or extra storage).

---

## 9.14 — Admin Time-Series Analytics

### Goal
Admin and editor roles see trend charts in the dashboard: daily active users (7-day), new registrations (30-day), total article views (30-day), and top 5 articles of the week. All charts are pure SVG — no chart.js or D3 dependency.

### Backend Routes

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/admin/analytics/users` | editor+ | New user registrations by day (last 30 days) |
| `GET` | `/api/admin/analytics/views` | editor+ | Total site views by day (last 30 days, from ArticleViewLog) |
| `GET` | `/api/admin/analytics/top-articles` | editor+ | Top 5 articles by views in last 7 days |

### Data Source

User registrations: aggregate `User.createdAt` by date.

Views: sum `ArticleViewLog.views` grouped by date (requires 9.11's `ArticleViewLog` model).

Top articles: sum `ArticleViewLog.views` where `date >= 7 days ago`, group by article, top 5.

### Frontend
- New "آمار سایت" panel in admin dashboard (below the live feed widget).
- Two SVG bar charts: "ثبت‌نام روزانه (۳۰ روز)" and "بازدید روزانه (۳۰ روز)".
- Bar chart: 300×120px SVG. Bars drawn as `<rect>` elements, scaled to max value. Day labels below each bar (Persian numerals, rotated 45°). Hover tooltip showing exact value.
- Top articles table: rank, title (linked), category, 7-day views.

### SVG Bar Chart Component
Pure React component, no dependencies:
```jsx
function BarChart({ data, label }) {
  const max = Math.max(...data.map(d => d.value), 1);
  const W = 300, H = 100, BAR_W = Math.floor(W / data.length) - 2;
  return (
    <svg width={W} height={H} style={{ direction: 'ltr' }}>
      {data.map((d, i) => {
        const h = Math.round((d.value / max) * (H - 20));
        return <rect key={i} x={i * (BAR_W + 2)} y={H - 20 - h} width={BAR_W} height={h} fill="#0F6B73" rx={2} />;
      })}
    </svg>
  );
}
```

---

## 9.15 — Editorial Submission & Review Workflow

### Goal
Writers submit articles for editorial review. Editors see a "صف بررسی" (review queue) panel. Editors can approve (publish), request revisions, or reject with a note. Writers get an in-app notification of the decision.

### Schema

```prisma
enum ReviewStatus {
  pending
  revision_requested
  approved
  rejected
}

model ArticleReview {
  id        String       @id @default(cuid())
  article   Article      @relation(fields: [articleId], references: [id], onDelete: Cascade)
  articleId String       @unique
  reviewer  User?        @relation(fields: [reviewerId], references: [id])
  reviewerId Int?
  status    ReviewStatus @default(pending)
  note      String?      @db.VarChar(1000)
  createdAt DateTime     @default(now())
  updatedAt DateTime     @updatedAt
}
```

The existing `Article.status` enum gains a new value: `در_انتظار_بررسی` (already exists in data but now is the formal submission state).

### Backend Routes

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/admin/articles/:id/submit` | writer+ (own article) | Submit article for review → creates ArticleReview, sets status `در انتظار بررسی`, notifies editors |
| `GET` | `/api/admin/review-queue` | editor+ | List all pending reviews with article previews |
| `POST` | `/api/admin/review-queue/:id/approve` | editor+ | Publish article, set review status `approved`, notify writer |
| `POST` | `/api/admin/review-queue/:id/revise` | editor+ | Set status `revision_requested`, send note to writer |
| `POST` | `/api/admin/review-queue/:id/reject` | editor+ | Set status `rejected`, send note to writer |

### Notification Events
Reuse the Phase 8 `Notification` model with new types:

```prisma
enum NotificationType {
  comment
  comment_reply
  new_article
  review_approved    // new
  review_revision    // new
  review_rejected    // new
  review_submitted   // new — sent to editors when writer submits
}
```

### Frontend
- **Writer article editor** — "ارسال برای بررسی" button visible when article is in draft or revision_requested state.
- **Admin sidebar** — new "صف بررسی" tab with a badge showing pending count (editor+ only).
- **Review queue panel** — article title, author, category, word count, submit date. Action buttons: تأیید و انتشار / درخواست اصلاح / رد کردن. "درخواست اصلاح" and "رد کردن" open a note textarea before sending.
- **Writer notification** — bell notification with the editor's decision and note.
- **Article status badge** — `ArticleDetail` in admin view shows the current review status clearly.

---

## 9.16 — Saved Articles & Reading List Enhancement

### Goal
Phase 4 added a `save` API but the frontend reading list is minimal. Phase 9 elevates it: users can organize saved articles into named lists (e.g., "بعداً بخوانم"، "مقالات مرجع")، reorder items, and access the list from their profile.

### Schema

```prisma
model ReadingList {
  id        String            @id @default(cuid())
  user      User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId    Int
  name      String            @db.VarChar(80)
  isDefault Boolean           @default(false)
  createdAt DateTime          @default(now())
  items     ReadingListItem[]

  @@unique([userId, name])
}

model ReadingListItem {
  id            String      @id @default(cuid())
  list          ReadingList @relation(fields: [listId], references: [id], onDelete: Cascade)
  listId        String
  article       Article     @relation(fields: [articleId], references: [id], onDelete: Cascade)
  articleId     String
  position      Int
  addedAt       DateTime    @default(now())

  @@unique([listId, articleId])
}
```

Each user gets a default list "ذخیره‌شده" created on first save. The existing `SavedArticle` model (Phase 4) is migrated to this system.

### Backend Routes

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/auth/lists` | session | Get user's reading lists |
| `POST` | `/api/auth/lists` | session | Create a list |
| `DELETE` | `/api/auth/lists/:id` | session | Delete a list (not default) |
| `POST` | `/api/auth/lists/:id/items` | session | Add article to list |
| `DELETE` | `/api/auth/lists/:id/items/:articleId` | session | Remove article |
| `PUT` | `/api/auth/lists/:id/reorder` | session | Reorder items |

### Frontend
- Profile "ذخیره‌شده" tab shows reading lists, each expandable to see its articles.
- "+" button to create a new named list.
- Save button on articles now opens a small dropdown: pick which list to save to (or create new).
- Reading list items show article cover color, title, category, and a remove button.

---

## Dependencies to Add

| Package | Location | Purpose |
|---|---|---|
| `@napi-rs/canvas` | root (devDependency) | OG image generation script |
| `highlight.js` | root | Local syntax highlighting |

Both installed via npm. Neither violates the zero-CDN policy — they are bundled locally by Vite.

---

## Implementation Sequence

1. Web-search each article topic for 1405/2026 state.
2. Write full content for art2–art18 + update art1.
3. Write full content for art19–art23 (new articles).
4. Add SEO fields to all 23 articles in `teknav-data.js`, update dates.
5. Rename art10 slug.
6. Add SEO + `ArticleViewLog` + `NewsletterCampaign` + `ArticleSeries` + `SeriesArticle` + `CommentLike` + `ArticleReview` + `ReviewStatus` + `ReadingList` + `ReadingListItem` + extended `NotificationType` to `schema.prisma`.
7. Run `prisma:generate` → `prisma:apply`.
8. Update `seed.ts` to upsert SEO fields and create default reading lists for seeded users.
9. Implement backend routes: newsletter campaigns (9.7), series (9.8), related articles (9.9), comment likes (9.10), writer analytics + `ArticleViewLog` flush (9.11), admin analytics (9.14), editorial review (9.15), reading lists (9.16).
10. Update article detail page: full `<head>` meta + JSON-LD + `SocialShare` + `RelatedArticles` (9.3, 9.13, 9.9).
11. Implement syntax highlighting in article body (9.12).
12. Admin: newsletter campaign panel (9.7), series management (9.8), review queue (9.15), subscriber list (9.7), analytics charts (9.14).
13. Writer profile: analytics tab (9.11), reading lists tab (9.16).
14. Write `scripts/generate-og-images.mjs`, install `@napi-rs/canvas`, run script.
15. Update `scripts/generate-seo.mjs` for `dateModified` and RSS `<content:encoded>`.
16. Run `npm run seo:sitemap`.
17. Run `npm run build` — verify zero CDN, check highlight.js bundle chunk is local.
18. Run `cd backend && npm run build`.

---

## Phase 9 Checklist

Current implementation status: core schema, seed/reference data, SEO artifacts, public APIs, admin APIs, and primary frontend entry points are implemented. Several originally listed polish items remain intentionally pending for Linux/browser validation or a later UI pass: full researched 800-word rewrites for every legacy article, syntax-highlighting runtime integration, dedicated writer analytics profile tab, richer social-share buttons, article-series prev/next navigation, review notifications, and reading-list picker UI.

### Content
- [ ] Web-search each article topic for 1405/2026 facts
- [ ] Write full content for art2 (`custom-ai-chips`)
- [ ] Write full content for art3 (`browser-architecture`)
- [ ] Write full content for art4 (`software-supply-chain`)
- [ ] Write full content for art5 (`iranian-startups-scale`)
- [ ] Write full content for art6 (`small-llms`) — Phi-3→Phi-4, Llama 3.2→Llama 4
- [ ] Write full content for art7 (`edge-computing`)
- [ ] Write full content for art8 (`synthetic-data`)
- [ ] Write full content for art9 (`ai-hardware-roadmap`) — H100→GB200
- [ ] Write full content for art10 (`quantum-computing`) — rename slug
- [ ] Write full content for art11 (`microservices-vs-monolith`)
- [ ] Write full content for art12 (`fintech-regulation`)
- [ ] Write full content for art13 (`llm-security`) — Claude 3→Claude Opus 4.7
- [ ] Write full content for art14 (`data-governance`)
- [ ] Write full content for art15 (`robotics-warehouse`)
- [ ] Write full content for art16 (`open-source-ai`) — Llama 3.2→Llama 4
- [ ] Write full content for art17 (`rust-systems`) + promote to `منتشرشده`
- [ ] Write full content for art18 (`venture-capital-ai`) + promote to `منتشرشده`
- [ ] Update art1 (`ai-clean-data`) — refresh model refs and 2024 citations
- [ ] Write full content for art19 (`claude-opus-47-reasoning`)
- [ ] Write full content for art20 (`agentic-ai-production`)
- [ ] Write full content for art21 (`vibe-coding`)
- [ ] Write full content for art22 (`ai-energy-crisis`)
- [ ] Write full content for art23 (`llama4-open-frontier`)

### SEO Metadata
- [ ] Add SEO fields to all 23 articles in `teknav-data.js`
- [ ] Update all `date`/`dateEn` fields per date table
- [ ] Rename `quantum-computing-2024` slug → `quantum-computing`
- [ ] Article detail page: inject full `<head>` meta block
- [ ] Article detail page: inject JSON-LD structured data
- [ ] Verify meta tags in browser DevTools

### OG Images
- [ ] Write `scripts/generate-og-images.mjs`
- [ ] `npm install --save-dev @napi-rs/canvas`
- [ ] Run script → verify 23 JPEGs in `public/images/og/`

### SEO Artifacts
- [ ] Update `scripts/generate-seo.mjs` (`dateModified`, `metaDescription`, `content:encoded`)
- [ ] Run `npm run seo:sitemap`
- [ ] Verify sitemap `<lastmod>` for all 23 slugs
- [ ] Verify RSS `<content:encoded>` is populated

### Schema & Seed
- [ ] Add SEO columns to `Article` in `schema.prisma`
- [ ] Add `ArticleViewLog` model
- [ ] Add `NewsletterCampaign` model + `unsubscribeToken` to `NewsletterSubscriber`
- [ ] Add `ArticleSeries` + `SeriesArticle` models
- [ ] Add `CommentLike` model + `likeCount` to `Comment`
- [ ] Add `ArticleReview` model + `ReviewStatus` enum
- [ ] Extend `NotificationType` enum with review notification types
- [ ] Add `ReadingList` + `ReadingListItem` models
- [ ] Run `prisma:generate` + `prisma:apply` on Linux host
- [ ] Update `seed.ts` to upsert SEO fields
- [ ] Run `npm run seed` on Linux host

### Newsletter Campaigns (9.7)
- [ ] Backend: campaign CRUD + send route with batch SMTP
- [ ] Backend: `GET /api/newsletter/unsubscribe?token=` route
- [ ] Admin: "خبرنامه" sidebar tab
- [ ] Admin: campaign list + composer + HTML preview iframe
- [ ] Admin: subscriber list with remove action

### Article Series (9.8)
- [ ] Backend: public series routes (`GET /api/series`, `GET /api/series/:slug`)
- [ ] Backend: admin series CRUD + article add/remove/reorder
- [ ] Frontend: `/series/:slug` series landing page
- [ ] Frontend: series banner + prev/next nav in `ArticleDetail`
- [ ] Admin: "سری‌ها" sidebar tab with series management

### Related Articles (9.9)
- [ ] Backend: `GET /api/articles/:slug/related` with tag-overlap algorithm + Redis cache
- [ ] Frontend: `RelatedArticles` component in `ArticleDetail`

### Comment Likes (9.10)
- [ ] Backend: `POST /api/comments/:id/like` (toggle)
- [ ] Backend: add `likeCount` + `likedByMe` to comment listing
- [ ] Frontend: like button with count on each comment card
- [ ] Frontend: optimistic update on click

### Writer Analytics (9.11)
- [ ] Backend: extend `flushViewCounters()` to upsert `ArticleViewLog`
- [ ] Backend: `GET /api/auth/analytics/overview`
- [ ] Backend: `GET /api/auth/analytics/articles`
- [ ] Backend: `GET /api/auth/analytics/article/:slug`
- [ ] Frontend: "آمار" tab in writer profile settings
- [ ] Frontend: SVG sparkline component for 30-day view trend

### Syntax Highlighting (9.12)
- [ ] `npm install highlight.js`
- [ ] Copy `github-dark.min.css` theme to `src/styles/`
- [ ] Import and register 10 languages in `teknav-articles.jsx`
- [ ] `useEffect` to apply `hljs.highlightElement()` on article body `<code>` blocks
- [ ] Force `direction: ltr` on all `<pre>` blocks
- [ ] Add language label badge above each code block
- [ ] `npm run build` — confirm no CDN URLs in `dist/`

### Social Share (9.13)
- [ ] `SocialShare` component with Telegram, Twitter/X, WhatsApp, copy-link
- [ ] Inline SVG icons for each platform
- [ ] Toast "لینک کپی شد" on clipboard copy
- [ ] Integrate in `ArticleDetail` below byline

### Admin Time-Series Analytics (9.14)
- [ ] Backend: `GET /api/admin/analytics/users`
- [ ] Backend: `GET /api/admin/analytics/views`
- [ ] Backend: `GET /api/admin/analytics/top-articles`
- [ ] Frontend: `BarChart` SVG component
- [ ] Admin dashboard: "آمار سایت" panel with two bar charts + top-articles table

### Editorial Review Workflow (9.15)
- [ ] Backend: `POST /api/admin/articles/:id/submit`
- [ ] Backend: `GET /api/admin/review-queue`
- [ ] Backend: approve / revise / reject routes
- [ ] Backend: notification on each decision + on submission
- [ ] Frontend: "ارسال برای بررسی" button in article editor
- [ ] Admin: "صف بررسی" sidebar tab with pending badge
- [ ] Admin: review queue panel with decision buttons + note textarea

### Reading Lists (9.16)
- [ ] Backend: reading list CRUD + item add/remove/reorder
- [ ] Frontend: profile "ذخیره‌شده" tab shows named lists
- [ ] Frontend: article save button opens list-picker dropdown
- [ ] Frontend: list item card with remove button
- [ ] Migrate existing `SavedArticle` rows to default reading list in `seed.ts`

### Build & Docs
- [ ] `npm run build` passes (zero CDN check)
- [ ] `cd backend && npm run build` passes
- [ ] Update `MEMORY.md`
- [ ] Update `ARCH.md`
- [ ] Update `PHASES.md`
- [ ] Mark `PHASE9.md` complete
