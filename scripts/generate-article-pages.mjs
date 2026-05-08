import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { TeknavData } from '../teknav-data.js';

const SITE_URL = (process.env.TEKNAV_SITE_URL || process.env.VITE_SITE_URL || 'https://www.teknav.ir').replace(/\/$/, '');
const today = new Date().toISOString().slice(0, 10);

const template = readFileSync(resolve('dist/index.html'), 'utf8');

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function clean(value) {
  return String(value ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function truncate(value, max = 155) {
  const text = clean(value);
  return text.length > max ? `${text.slice(0, max - 1).trim()}…` : text;
}

function uniqueList(values, limit = 18) {
  const seen = new Set();
  return values
    .map((value) => clean(value))
    .filter(Boolean)
    .filter((value) => {
      const key = value.toLocaleLowerCase('fa-IR');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

function articleKeywords(article, category, author) {
  return uniqueList([
    ...(article.keywords || []),
    ...(article.tags || []),
    article.title,
    article.subtitle,
    article.categoryName || category?.name,
    article.type,
    author?.specialty,
    'تحلیل فارسی فناوری',
    'تکناو',
  ]);
}

function articleEntities(article, category) {
  return uniqueList([
    article.categoryName || category?.name,
    ...(article.tags || []),
    ...(article.keywords || []),
  ], 24).map((name) => ({ '@type': 'Thing', name }));
}

function articleSections(content) {
  return [...String(content || '').matchAll(/<h2[^>]*>(.*?)<\/h2>/g)]
    .map((match) => clean(match[1]))
    .filter(Boolean)
    .slice(0, 12);
}

function isPastOrTodayDate(date) {
  const value = String(date ?? '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && value <= today;
}

function isPublishedArticle(article) {
  if (article.status === 'منتشرشده') return true;
  if (article.status === 'پیش‌نویس' || article.status === 'در انتظار بررسی') return false;
  if (['rust-systems', 'venture-capital-ai'].includes(article.slug)) return false;
  return !!article.dateEn;
}

const publishedArticles = TeknavData.articles.filter((article) => isPublishedArticle(article) && isPastOrTodayDate(article.dateEn));
const categories = TeknavData.categories ?? [];
const authors = TeknavData.authors ?? [];

let count = 0;
for (const article of publishedArticles) {
  const path = article.canonicalPath || `/article/${article.slug}`;
  const canonical = `${SITE_URL}${path}`;
  const rawTitle = article.ogTitle || `${article.title} | تکناو`;
  const rawDesc = truncate(article.metaDescription || article.ogDescription || article.summary || article.subtitle || '', 160);
  const slugImg = `/images/og/${article.slug}.jpg`;
  const hasSlugImg = existsSync(resolve(`dist${slugImg}`));
  const rawOgImage = article.ogImage || (hasSlugImg ? slugImg : null);
  const image = rawOgImage ? `${SITE_URL}${rawOgImage}` : `${SITE_URL}/images/og/default.jpg`;

  const title = esc(rawTitle);
  const description = esc(rawDesc);

  const category = categories.find(c =>
    c.id === article.category || c.slug === article.category ||
    c.slug === article.categorySlug || c.name === article.categoryName
  );
  const author = authors.find(a =>
    a.id === article.authorId || a.slug === article.authorSlug || a.name === article.authorName
  );
  const keywords = articleKeywords(article, category, author);
  const entities = articleEntities(article, category);
  const sections = articleSections(article.content);

  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': ['Organization', 'NewsMediaOrganization'],
        '@id': `${SITE_URL}/#organization`,
        name: 'تکناو',
        alternateName: ['Teknav', 'تکنّاو'],
        url: SITE_URL,
        description: 'تکناو رسانه فارسی تحلیل فناوری، هوش مصنوعی، علم داده، امنیت سایبری، نرم‌افزار، سخت‌افزار و آینده تکنولوژی است.',
        logo: { '@type': 'ImageObject', '@id': `${SITE_URL}/#logo`, url: `${SITE_URL}/favicon.png`, width: 512, height: 512 },
        image: { '@id': `${SITE_URL}/#logo` },
        publishingPrinciples: `${SITE_URL}/about`,
        masthead: `${SITE_URL}/authors`,
        areaServed: { '@type': 'Country', name: 'Iran' },
        audience: { '@type': 'Audience', audienceType: 'فارسی‌زبانان علاقه‌مند به فناوری' },
        sameAs: ['https://twitter.com/teknavir', 'https://x.com/teknavir', 'https://linkedin.com/company/teknav'],
      },
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        url: SITE_URL,
        name: 'تکناو',
        alternateName: 'Teknav',
        description: 'تکناو رسانه فارسی تحلیل فناوری، هوش مصنوعی، علم داده، امنیت سایبری، نرم‌افزار، سخت‌افزار و آینده تکنولوژی است.',
        inLanguage: 'fa-IR',
        publisher: { '@id': `${SITE_URL}/#organization` },
      },
      {
        '@type': ['NewsArticle', 'TechArticle'],
        '@id': `${canonical}#article`,
        mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
        headline: clean(article.title).slice(0, 110),
        alternativeHeadline: clean(article.subtitle || article.summary).slice(0, 110) || undefined,
        description: rawDesc,
        abstract: clean(article.summary || article.subtitle || rawDesc),
        articleBody: truncate(article.content, 5000),
        image: { '@type': 'ImageObject', url: image, width: 1200, height: 630 },
        datePublished: article.publishedAt || article.dateEn,
        dateModified: article.dateModified || article.updatedAt || article.dateEn,
        inLanguage: 'fa-IR',
        articleSection: article.categoryName || category?.name,
        keywords,
        wordCount: clean(article.content).split(/\s+/).filter(Boolean).length || undefined,
        timeRequired: article.readTime ? `PT${article.readTime}M` : undefined,
        genre: article.type,
        teaches: sections,
        author: {
          '@type': 'Person',
          name: article.authorName || author?.name,
          url: author ? `${SITE_URL}/author/${author.slug}` : undefined,
          jobTitle: author?.specialty,
          description: author?.bio,
          knowsAbout: author?.expertise,
          sameAs: author?.social ? Object.values(author.social).filter(v => v && v !== '#') : [],
        },
        publisher: { '@id': `${SITE_URL}/#organization` },
        about: [
          category ? { '@type': 'Thing', name: category.name, url: `${SITE_URL}/topics/${category.slug}` } : null,
          ...entities.slice(0, 5),
        ].filter(Boolean),
        mentions: entities,
        isPartOf: [
          { '@id': `${SITE_URL}/#website` },
          category ? { '@type': 'CollectionPage', '@id': `${SITE_URL}/topics/${category.slug}` } : null,
        ].filter(Boolean),
        speakable: {
          '@type': 'SpeakableSpecification',
          xpath: ['/html/head/title', '/html/head/meta[@name="description"]/@content'],
        },
        isAccessibleForFree: true,
        educationalLevel: 'Intermediate',
        ...(article.factCheckedAt ? {
          reviewedBy: { '@id': `${SITE_URL}/#organization` },
          lastReviewed: article.factCheckedAt,
        } : {}),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'تکناو', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: 'مقاله‌ها', item: `${SITE_URL}/articles` },
          ...(category ? [{ '@type': 'ListItem', position: 3, name: category.name, item: `${SITE_URL}/category/${category.slug}` }] : []),
          { '@type': 'ListItem', position: category ? 4 : 3, name: clean(article.title) },
        ],
      },
    ],
  });

  let html = template;
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`);
  html = html.replace(/(<meta name="description" content=")[^"]*(")/,        `$1${description}$2`);
  html = html.replace(/(<meta name="keywords" content=")[^"]*(")/,           `$1${esc(keywords.join(', '))}$2`);
  html = html.replace(/(<meta property="og:title" content=")[^"]*(")/,       `$1${title}$2`);
  html = html.replace(/(<meta property="og:description" content=")[^"]*(")/,  `$1${description}$2`);
  html = html.replace(/(<meta property="og:url" content=")[^"]*(")/,         `$1${esc(canonical)}$2`);
  html = html.replace(/(<meta property="og:image" content=")[^"]*(")/,       `$1${esc(image)}$2`);
  html = html.replace(/(<meta name="twitter:title" content=")[^"]*(")/,      `$1${title}$2`);
  html = html.replace(/(<meta name="twitter:description" content=")[^"]*(")/,`$1${description}$2`);
  html = html.replace(/(<meta name="twitter:image" content=")[^"]*(")/,      `$1${esc(image)}$2`);
  html = html.replace(/(<link rel="canonical" href=")[^"]*(")/,              `$1${esc(canonical)}$2`);
  html = html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/,
    `<script type="application/ld+json">${jsonLd}</script>`);

  const dir = resolve(`dist/article/${article.slug}`);
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/index.html`, html, 'utf8');
  count++;
}

console.log(`[article-pages] generated ${count} static article HTML pages`);
