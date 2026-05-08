# SEO Architecture & Content Strategy Analysis

This document outlines the SEO architecture of Teknav (`www.teknav.ir`) and provides an analysis of the content and technical strategies that enabled the article *"هوش مصنوعی داده‌محور ۲۰۲۶"* (ai-data-centric-2026) to achieve a #1 ranking on Google, surpassing even Wikipedia.

## 1. Content Strategy Analysis (Case Study: ai-data-centric-2026)

The article's success is a direct result of aligning deep technical expertise with search engine NLP (Natural Language Processing) expectations, specifically catering to Google's E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness) guidelines.

### 1.1. Semantic Structure & Readability
- **The Lead Paragraph:** The article begins with a `<p class="lead">` tag containing a highly condensed, keyword-rich executive summary. This provides immediate context for both human readers and search crawlers.
- **Hierarchical Headings:** The content is broken down into numbered, highly descriptive `<h2>` headings (e.g., `<h2>۱. بحران انباشت نویز و پدیده فروپاشی مدل (Model Collapse)</h2>`). This creates a clear table of contents and outlines the semantic structure of the document.
- **Entity Highlighting:** Key industry terms and concepts are wrapped in `<strong>` tags (e.g., `<strong>Model Collapse</strong>`, `<strong>Semantic Layers</strong>`). This helps Google's Knowledge Graph easily identify the core entities discussed in the article.
- **Bilingual Terminology:** The seamless integration of Persian technical terms alongside their English counterparts (e.g., "توهم (Hallucination)", "مسموم‌سازی داده‌ها (Data Poisoning)") ensures the article ranks for both Persian and English long-tail queries.

### 1.2. Depth and Authority (E-E-A-T)
- **High-Value Technical Density:** The article covers advanced, bleeding-edge topics (EU AI Act of 2026, Compounding Failure Math, Agentic Self-Instruct) rather than generic fluff. The inclusion of mathematical formulas (e.g., `P(Success) = 0.95 ^ 10`) signals high expertise to search engines.
- **Trust Metrics:** According to the platform's schema (`teknav-data.js`), the article includes a `factCheckedAt` timestamp. The author profile links to verified social identities (`sameAs` links to X/LinkedIn).

## 2. Technical SEO Architecture (Phase 10 Foundations)

The #1 ranking is not just about the text; it is deeply supported by Teknav's robust, custom-built technical SEO architecture.

### 2.1. Structured Data (JSON-LD)
Teknav employs an aggressive structured data strategy:
- **Article & NewsArticle Schema:** Provides explicit metadata including `headline`, `alternativeHeadline`, `description`, `abstract`, `articleBody`, `datePublished`, `dateModified`, `wordCount`, `timeRequired`, `author` (with `Person` schema), and `publisher`.
- **Entity Graph Enrichment:** Runtime and static article pages derive `keywords`, `about`, `mentions`, `teaches`, and topic-hub `isPartOf` links from article tags, keywords, headings, category, and author expertise. This gives older Persian articles the same entity density that helped `ai-data-centric-2026`.
- **BreadcrumbList:** Helps Google understand the site hierarchy (`Home > Articles > AI > Article Name`), enabling rich snippets in search results.
- **FAQPage & CollectionPage:** Used on Topic Hubs to capture "People Also Ask" SERP real estate.
- **DefinedTerm:** Used for glossary pages to build topical authority.

### 2.1.1. Static Article Pages
Production builds generate static article HTML under `dist/article/{slug}/index.html` for every currently indexable Persian article. These pages include article-specific title, description, keywords, canonical, Open Graph/Twitter metadata, and the enriched JSON-LD graph before React hydration. This matters because crawlers can evaluate the article URL immediately, without waiting for the SPA to fetch article data.

### 2.2. Topical Authority & Internal Linking
- **Authority Hubs (`/topics/*`):** The site structures content into specific hubs (e.g., `/topics/ai`) with featured articles, related series, and FAQs. This silo structure passes link equity effectively to deep articles.
- **Tag Pages & Series:** Articles are interlinked via tags and series navigation, keeping crawlers engaged and establishing thematic relevance.

### 2.3. Performance & Core Web Vitals
- **Zero CDN Policy:** By hosting all assets (fonts, scripts, images) locally and enforcing a zero-CDN policy, Teknav eliminates third-party DNS lookups and TLS handshakes, ensuring a lightning-fast Time to First Byte (TTFB).
- **Image Optimization:** Open Graph (OG) images are generated locally (`scripts/generate-og-images.mjs`). Critical images like the hero image use `fetchPriority="high"` and the `<meta name="robots" content="max-image-preview:large">` directive, making the site highly optimized for Google Discover.
- **Native Deployment:** Running on native Linux/systemd with Nginx (no Docker overhead) ensures maximum server response speed.

### 2.4. Crawler Management & Indexing
- **Automated Artifacts:** The `scripts/generate-seo.mjs` script automatically generates dynamic `sitemap.xml`, `robots.txt`, and RSS feeds (`feed.xml`, topic feeds, author feeds), ensuring Google instantly discovers new content and updates.
- **Future-date Protection:** Sitemaps, RSS feeds, and static article pages include only articles whose Gregorian `dateEn` is today or in the past. Scheduled content does not leak into indexable artifacts early.
- **Namespace Safety:** Sitemap generation validates XML namespace bindings before writing files, preventing Search Console/Bing "Unbound XML namespace prefix" errors.
- **Image Sitemap Coverage:** The article sitemap discovers both explicit `ogImage` values and generated `/images/og/{slug}.jpg` files, so every indexable Persian article can expose a local 1200x630 image.
- **Canonicalization:** Every article enforces a strict `canonicalPath` to prevent duplicate content issues.
- **Status Workflows:** The `PUBLISHED` status is guarded by Phase 10 quality checks, ensuring only complete, metadata-rich articles reach the public sitemap.

## 3. Persian SEO Quality Gate

The Persian-first SEO baseline is now enforced by:

```bash
npm run check:seo
```

The check audits current, indexable Persian articles for:

- canonical path
- meta description depth
- local OG image availability
- fact-check/review timestamp
- minimum heading structure
- derived entity/keyword coverage
- body depth warnings for articles that should be expanded editorially

Warnings are editorial prioritization signals; failures are indexability or trust gaps that should be fixed before deployment.

## 4. Conclusion

The #1 ranking of the "ai-data-centric-2026" article is a textbook example of programmatic SEO combined with high-quality journalism. The Teknav architecture ensures that the deep technical expertise of the writers is perfectly translated into a machine-readable format through strict semantic HTML, comprehensive JSON-LD, localized performance optimizations, and a robust topical hub structure.
