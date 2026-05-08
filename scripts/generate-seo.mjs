import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { TeknavData } from '../teknav-data.js';

const SITE_URL = (process.env.TEKNAV_SITE_URL || process.env.VITE_SITE_URL || 'https://www.teknav.ir').replace(/\/$/, '');
const today = new Date().toISOString().slice(0, 10);
const SITEMAP_XMLNS = 'xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"';
const XHTML_XMLNS = 'xmlns:xhtml="http://www.w3.org/1999/xhtml"';
const IMAGE_XMLNS = 'xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"';
const NEWS_XMLNS = 'xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"';

function xml(value) {
  return String(value ?? '')
    .replace(/\uFFFD/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function capDate(date) {
  return String(date ?? today).slice(0, 10) > today ? today : String(date ?? today).slice(0, 10);
}

function isPastOrTodayDate(date) {
  const value = String(date ?? '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && value <= today;
}

function assertBoundNamespacePrefixes(name, source) {
  const declared = new Set([...source.matchAll(/\sxmlns:([A-Za-z_][\w.-]*)=/g)].map((match) => match[1]));
  const used = new Set([...source.matchAll(/<\/?([A-Za-z_][\w.-]*):[A-Za-z_][\w.-]*(?:\s|>|\/>)/g)].map((match) => match[1]));
  const missing = [...used].filter((prefix) => !declared.has(prefix));
  if (missing.length > 0) {
    throw new Error(`[seo] ${name} has unbound XML namespace prefix(es): ${missing.join(', ')}`);
  }
}

function writeXml(path, source) {
  assertBoundNamespacePrefixes(path, source);
  writeFileSync(resolve(path), source, 'utf8');
}

function url(path, lastmod = today, priority = '0.7', changefreq = 'weekly', images = []) {
  const lines = [
    '  <url>',
    `    <loc>${SITE_URL}${path}</loc>`,
    `    <lastmod>${capDate(lastmod)}</lastmod>`,
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
const indexableArticles = publishedArticles.filter((article) => isPastOrTodayDate(article.dateEn));
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
<urlset ${SITEMAP_XMLNS} ${XHTML_XMLNS}>
${mainUrls.join('\n')}
</urlset>
`;

// Articles Sitemap (with Images)
const articleUrls = indexableArticles.map((article) => {
  const slugImage = `/images/og/${article.slug}.jpg`;
  const image = article.ogImage || (existsSync(resolve(`public${slugImage}`)) ? slugImage : null);
  const images = image ? [{ url: image, title: article.title, caption: article.summary || article.subtitle }] : [];
  return url(article.canonicalPath || `/article/${article.slug}`, String(article.dateModified || article.dateEn || today).slice(0, 10), '0.85', 'monthly', images);
});

const articlesSitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset ${SITEMAP_XMLNS} ${XHTML_XMLNS} ${IMAGE_XMLNS}>
${articleUrls.join('\n')}
</urlset>
`;

// News Sitemap: Google News expects only recent, already-published articles.
const newsCutoff = new Date();
newsCutoff.setUTCDate(newsCutoff.getUTCDate() - 2);
const newsCutoffDate = newsCutoff.toISOString().slice(0, 10);
const recentArticles = indexableArticles.filter(a => {
  const date = String(a.dateEn ?? '').slice(0, 10);
  return date >= newsCutoffDate && date <= today;
});

const newsSitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset ${SITEMAP_XMLNS} ${XHTML_XMLNS} ${NEWS_XMLNS}>
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
Disallow: /signup
Disallow: /forgot-password
Disallow: /reset-password
Disallow: /verify-email
Disallow: /writer
Disallow: /ACCOUNTS.md
Disallow: /api/

Sitemap: ${SITE_URL}/sitemap.xml
Sitemap: ${SITE_URL}/sitemap-main.xml
Sitemap: ${SITE_URL}/sitemap-articles.xml
Sitemap: ${SITE_URL}/sitemap-news.xml
`;

const feedItems = indexableArticles
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

writeXml('public/sitemap-main.xml', sitemap);
writeXml('public/sitemap-articles.xml', articlesSitemap);
writeXml('public/sitemap-news.xml', newsSitemap);
writeXml('public/sitemap.xml', sitemapIndex);
writeFileSync(resolve('public/robots.txt'), robots, 'utf8');
writeFileSync(resolve('public/feed.xml'), feed, 'utf8');
mkdirSync(resolve('public/feeds'), { recursive: true });
for (const topic of topicHubs) {
  const topicArticles = indexableArticles.filter((article) => article.category === topic.categorySlug || article.categorySlug === topic.categorySlug);
  writeFileSync(resolve(`public/feeds/topic-${topic.slug}.xml`), scopedFeed({
    title: `${topic.title} | خوراک موضوعی تکنّاو`,
    link: `${SITE_URL}/feeds/topic-${topic.slug}.xml`,
    description: topic.description || `تازه‌ترین نوشته‌های تکنّاو درباره ${topic.title}.`,
    articles: topicArticles,
  }), 'utf8');
}
for (const author of TeknavData.authors) {
  const authorArticles = indexableArticles.filter((article) => article.authorId === author.id || article.authorSlug === author.slug || article.authorName === author.name);
  writeFileSync(resolve(`public/feeds/author-${author.slug}.xml`), scopedFeed({
    title: `${author.name} | خوراک نویسنده در تکنّاو`,
    link: `${SITE_URL}/feeds/author-${author.slug}.xml`,
    description: `آخرین نوشته‌های ${author.name} در تکنّاو.`,
    articles: authorArticles,
  }), 'utf8');
}
console.log(`[seo] generated sitemap.xml (index), main, articles, ${recentArticles.length > 0 ? 'news, ' : ''}feed.xml, ${topicHubs.length} topic feeds, and ${TeknavData.authors.length} author feeds`);
