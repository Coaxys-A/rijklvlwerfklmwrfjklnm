# Phase 16 — English Version (`/en/` subdirectory)

**Status:** Planned — not started  
**Scope:** Full English-language version of the site under `www.teknav.ir/en/`, with independent SEO, metadata, and content pipeline. Do not implement until the LTR layout and English content pipeline are ready.

---

## Approach: Option B — `/en/` subdirectory

```
fa (canonical): https://www.teknav.ir/article/ai-clean-data
en (canonical): https://www.teknav.ir/en/article/ai-clean-data
```

All English pages live under `/en/` on the main domain. Domain authority consolidates on `www.teknav.ir`.

---

## Prerequisites (blockers before implementation)

1. **LTR layout pass** — `dir="rtl"` is baked into the root HTML and nearly every component. A full LTR CSS pass across all shared components is required before any English UI can render correctly.
2. **English content pipeline** — `teknav-data-en.js` (or a `lang` field in the existing data) with translated/original English article data, author bios, category names, tag names, and slugs.
3. **English OG images** — current OG images contain Persian text; English variants needed.

---

## SEO & Metadata Architecture

### hreflang
Each page links its Persian and English counterparts:
```html
<link rel="alternate" hreflang="fa" href="https://www.teknav.ir/article/slug" />
<link rel="alternate" hreflang="en" href="https://www.teknav.ir/en/article/slug" />
<link rel="alternate" hreflang="x-default" href="https://www.teknav.ir/article/slug" />
```
`x-default` points to the Persian (primary) version.

### JSON-LD
- `"inLanguage": "en"` on all English article/page nodes
- `"@type": ["NewsArticle", "TechArticle"]` unchanged
- Organization stays `https://www.teknav.ir/#organization` (same entity, both languages)
- WebSite node gets a separate `@id`: `https://www.teknav.ir/#website-en`

### Canonical rules
- English pages are self-canonical (do not point back to the Persian URL)
- `<html lang="en" dir="ltr">`
- `og:locale` = `en_US`, `og:locale:alternate` = `fa_IR`

---

## Build Pipeline Changes

- New Vite build target producing `dist/en/` output (or a post-build copy step)
- `generate-article-pages.mjs` adapted to also generate `dist/en/article/{slug}/index.html`
- Separate sitemaps: `sitemap-en-main.xml`, `sitemap-en-articles.xml` added to `sitemap.xml` index
- Separate RSS feed: `/en/feed.xml`
- `robots.txt`: add `Sitemap: https://www.teknav.ir/sitemap-en-articles.xml`

---

## nginx Changes

New location block (mirrors the existing article block):
```nginx
location ~ ^/en/article/([^/]+?)/?$ {
    gzip_static on;
    brotli_static on;
    try_files /en/article/$1/index.html /index.html;
}

location /en/ {
    gzip_static on;
    brotli_static on;
    try_files $uri $uri/ /index.html;
}
```

No sub_filter needed for `/en/` pages — static HTML generation handles all canonical/og:url values at build time.

---

## Content Strategy Decision (to be made before implementation)

- **Translations of Persian articles:** link with hreflang; slugs can match or differ.
- **Original English-only articles:** no hreflang needed; independent SEO.
- Hybrid approach is valid — hreflang only on articles that have both versions.
