import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { TeknavData } from '../teknav-data.js';

const SITE_URL = (process.env.TEKNAV_SITE_URL || process.env.VITE_SITE_URL || 'https://www.teknav.ir').replace(/\/$/, '');
const today = new Date().toISOString().slice(0, 10);

function xml(value) {
  return String(value ?? '')
    .replace(/\uFFFD/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function url(path, lastmod = today, priority = '0.7', changefreq = 'weekly', images = []) {
  const lines = [
    '  <url>',
    `    <loc>${SITE_URL}${path}</loc>`,
    `    <lastmod>${lastmod}</lastmod>`,
    `    <changefreq>${changefreq}</changefreq>`,
    `    <priority>${priority}</priority>`,
  ];
  if (images && images.length > 0) {
    for (const img of images) {
      lines.push('    <image:image>');
      lines.push(`      <image:loc>${SITE_URL}${img.url}</image:loc>`);
      if (img.title) lines.push(`      <image:title>${xml(img.title)}</image:title>`);
      if (img.caption) lines.push(`      <image:caption>${xml(img.caption)}</image:caption>`);
      lines.push('    </image:image>');
    }
  }
  lines.push('  </url>');
  return lines.join('\n');
}

function newsUrl(path, title, date, name = 'تکنّاو') {
  return [
    '  <url>',
    `    <loc>${SITE_URL}${path}</loc>`,
    '    <news:news>',
    '      <news:publication>',
    `        <news:name>${xml(name)}</news:name>`,
    '        <news:language>fa</news:language>',
    '      </news:publication>',
    `      <news:publication_date>${date}T09:00:00+03:30</news:publication_date>`,
    `      <news:title>${xml(title)}</news:title>`,
    '    </news:news>',
    '  </url>',
  ].join('\n');
}

function text(value) {
  return String(value ?? '').replace(/\uFFFD/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function cdata(value) {
  return String(value ?? '').replace(/\uFFFD/g, '').replace(/]]>/g, ']]]]><![CDATA[>');
}

function isPublishedArticle(article) {
  if (article.status === 'منتشرشده') return true;
  if (article.status === 'پیش‌نویس' || article.status === 'در انتظار بررسی') return false;
  if (['rust-systems', 'venture-capital-ai'].includes(article.slug)) return false;
  return !!article.dateEn;
}

const publishedArticles = TeknavData.articles.filter(isPublishedArticle);
const topicHubs = TeknavData.topicHubs ?? [];
const seriesPages = TeknavData.articleSeries ?? [];

// Main Sitemap
const mainUrls = [
  url('/', today, '1.0', 'daily'),
  url('/articles', today, '0.9', 'daily'),
  url('/authors', today, '0.7', 'weekly'),
  url('/newsletter', today, '0.7', 'weekly'),
  url('/jobs', today, '0.55', 'weekly'),
  url('/courses', today, '0.55', 'monthly'),
  url('/membership', today, '0.45', 'monthly'),
  url('/search', today, '0.4', 'monthly'),
  ...TeknavData.categories.map((category) => url(`/category/${category.slug}`, today, '0.8', 'weekly')),
  ...TeknavData.tags.map((tag) => url(`/tag/${encodeURIComponent(tag.name)}`, today, '0.55', 'weekly')),
  ...(TeknavData.glossary ?? []).map((term) => url(`/glossary/${term.slug}`, today, '0.55', 'monthly')),
  ...topicHubs.map((topic) => url(`/topics/${topic.slug}`, today, '0.9', 'weekly')),
  ...TeknavData.authors.map((author) => url(`/author/${author.slug}`, today, '0.7', 'weekly')),
  ...TeknavData.authors.filter((author) => author.username).map((author) => url(`/profile/@${author.username}`, today, '0.6', 'weekly')),
  ...seriesPages.map((series) => url(`/series/${series.slug}`, today, '0.75', 'weekly')),
];

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${mainUrls.join('\n')}
</urlset>
`;

// Articles Sitemap (with Images)
const articleUrls = publishedArticles.map((article) => {
  const images = article.ogImage ? [{ url: article.ogImage, title: article.title }] : [];
  return url(article.canonicalPath || `/article/${article.slug}`, String(article.dateModified || article.dateEn || today).slice(0, 10), '0.85', 'monthly', images);
});

const articlesSitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${articleUrls.join('\n')}
</urlset>
`;

// News Sitemap (last 48 hours)
const recentArticles = publishedArticles.filter(a => {
  const date = new Date(a.dateEn);
  const now = new Date();
  return (now - date) < (48 * 60 * 60 * 1000);
});

const newsSitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${recentArticles.map(a => newsUrl(a.canonicalPath || `/article/${a.slug}`, a.title, a.dateEn)).join('\n')}
</urlset>
`;

// Sitemap Index
const sitemapIndex = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${SITE_URL}/sitemap-main.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${SITE_URL}/sitemap-articles.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>
  ${recentArticles.length > 0 ? `
  <sitemap>
    <loc>${SITE_URL}/sitemap-news.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>` : ''}
</sitemapindex>
`;

const robots = `User-agent: *
Allow: /
Disallow: /admin
Disallow: /login
Disallow: /ACCOUNTS.md
Disallow: /api/

Sitemap: ${SITE_URL}/sitemap.xml
`;

const feedItems = publishedArticles
  .slice()
  .sort((a, b) => String(b.dateEn || '').localeCompare(String(a.dateEn || '')))
  .slice(0, 20)
  .map((article) => {
    const link = `${SITE_URL}${article.canonicalPath || `/article/${article.slug}`}`;
    const pubDate = article.dateEn ? new Date(`${article.dateEn}T09:00:00+03:30`).toUTCString() : new Date().toUTCString();
    return [
      '    <item>',
      `      <title>${xml(article.title)}</title>`,
      `      <link>${xml(link)}</link>`,
      `      <guid isPermaLink="true">${xml(link)}</guid>`,
      `      <description>${xml(article.metaDescription || text(article.summary || article.subtitle))}</description>`,
      `      <content:encoded><![CDATA[${cdata(article.content || article.summary || '')}]]></content:encoded>`,
      `      <category>${xml(article.categoryName || article.category || 'فناوری')}</category>`,
      `      <author>editor@teknav.ir (${xml(article.authorName || 'تکناو')})</author>`,
      `      <pubDate>${pubDate}</pubDate>`,
      '    </item>',
    ].join('\n');
  })
  .join('\n');

const feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>تکناو - تازه‌ترین تحلیل‌های فناوری</title>
    <link>${xml(SITE_URL)}/</link>
    <atom:link href="${xml(SITE_URL)}/feed.xml" rel="self" type="application/rss+xml" />
    <description>مقاله‌ها و تحلیل‌های فارسی تکناو درباره هوش مصنوعی، علم داده، امنیت سایبری، نرم‌افزار، سخت‌افزار و آینده فناوری.</description>
    <language>fa-IR</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${feedItems}
  </channel>
</rss>
`;

function scopedFeed({ title, link, description, articles }) {
  const scopedItems = articles
    .slice()
    .sort((a, b) => String(b.dateEn || '').localeCompare(String(a.dateEn || '')))
    .slice(0, 20)
    .map((article) => {
      const articleLink = `${SITE_URL}${article.canonicalPath || `/article/${article.slug}`}`;
      const pubDate = article.dateEn ? new Date(`${article.dateEn}T09:00:00+03:30`).toUTCString() : new Date().toUTCString();
      return [
        '    <item>',
        `      <title>${xml(article.title)}</title>`,
        `      <link>${xml(articleLink)}</link>`,
        `      <guid isPermaLink="true">${xml(articleLink)}</guid>`,
        `      <description>${xml(article.metaDescription || text(article.summary || article.subtitle))}</description>`,
        `      <content:encoded><![CDATA[${cdata(article.content || article.summary || '')}]]></content:encoded>`,
        `      <category>${xml(article.categoryName || article.category || 'فناوری')}</category>`,
        `      <author>editor@teknav.ir (${xml(article.authorName || 'تکنّاو')})</author>`,
        `      <pubDate>${pubDate}</pubDate>`,
        '    </item>',
      ].join('\n');
    })
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${xml(title)}</title>
    <link>${xml(link)}</link>
    <atom:link href="${xml(link)}" rel="self" type="application/rss+xml" />
    <description>${xml(description)}</description>
    <language>fa-IR</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${scopedItems}
  </channel>
</rss>
`;
}

writeFileSync(resolve('public/sitemap-main.xml'), sitemap, 'utf8');
writeFileSync(resolve('public/sitemap-articles.xml'), articlesSitemap, 'utf8');
if (recentArticles.length > 0) writeFileSync(resolve('public/sitemap-news.xml'), newsSitemap, 'utf8');
writeFileSync(resolve('public/sitemap.xml'), sitemapIndex, 'utf8');
writeFileSync(resolve('public/robots.txt'), robots, 'utf8');
writeFileSync(resolve('public/feed.xml'), feed, 'utf8');
mkdirSync(resolve('public/feeds'), { recursive: true });
for (const topic of topicHubs) {
  const topicArticles = publishedArticles.filter((article) => article.category === topic.categorySlug || article.categorySlug === topic.categorySlug);
  writeFileSync(resolve(`public/feeds/topic-${topic.slug}.xml`), scopedFeed({
    title: `${topic.title} | خوراک موضوعی تکنّاو`,
    link: `${SITE_URL}/feeds/topic-${topic.slug}.xml`,
    description: topic.description || `تازه‌ترین نوشته‌های تکنّاو درباره ${topic.title}.`,
    articles: topicArticles,
  }), 'utf8');
}
for (const author of TeknavData.authors) {
  const authorArticles = publishedArticles.filter((article) => article.authorId === author.id || article.authorSlug === author.slug || article.authorName === author.name);
  writeFileSync(resolve(`public/feeds/author-${author.slug}.xml`), scopedFeed({
    title: `${author.name} | خوراک نویسنده در تکنّاو`,
    link: `${SITE_URL}/feeds/author-${author.slug}.xml`,
    description: `آخرین نوشته‌های ${author.name} در تکنّاو.`,
    articles: authorArticles,
  }), 'utf8');
}
console.log(`[seo] generated sitemap.xml (index), main, articles, ${recentArticles.length > 0 ? 'news, ' : ''}feed.xml, ${topicHubs.length} topic feeds, and ${TeknavData.authors.length} author feeds`);
