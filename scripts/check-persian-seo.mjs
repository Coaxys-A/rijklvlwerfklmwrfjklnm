import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { TeknavData } from '../teknav-data.js';

const today = new Date().toISOString().slice(0, 10);

function clean(value) {
  return String(value ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function isPastOrTodayDate(date) {
  const value = String(date ?? '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && value <= today;
}

function isPublishedArticle(article) {
  if (article.status === 'منتشرشده') return true;
  if (article.status === 'پیش‌نویس' || article.status === 'در انتظار بررسی') return false;
  return !!article.dateEn;
}

function ogImageExists(article) {
  const image = article.ogImage || `/images/og/${article.slug}.jpg`;
  return existsSync(resolve(`public${image}`));
}

const problems = [];
const warnings = [];
const rows = TeknavData.articles
  .filter((article) => isPublishedArticle(article) && isPastOrTodayDate(article.dateEn))
  .map((article) => {
    const h2 = (article.content?.match(/<h2/g) || []).length;
    const words = clean(article.content).split(/\s+/).filter(Boolean).length;
    const keywordCount = new Set([
      ...(article.keywords || []),
      ...(article.tags || []),
      article.title,
      article.subtitle,
      article.categoryName,
      article.type,
      'تحلیل فارسی فناوری',
      'تکناو',
    ].filter(Boolean)).size;
    const checks = {
      meta: clean(article.metaDescription).length >= 120,
      keywords: keywordCount >= 7,
      headings: h2 >= 4,
      body: words >= 600,
      image: ogImageExists(article),
      reviewed: !!article.factCheckedAt,
      canonical: !!article.canonicalPath,
    };
    for (const [name, ok] of Object.entries({
      meta: checks.meta,
      headings: checks.headings,
      image: checks.image,
      reviewed: checks.reviewed,
      canonical: checks.canonical,
    })) {
      if (!ok) problems.push(`${article.slug}: ${name}`);
    }
    if (!checks.keywords) warnings.push(`${article.slug}: broaden keywords/tags`);
    if (!checks.body) warnings.push(`${article.slug}: consider expanding article body`);
    return {
      slug: article.slug,
      words,
      h2,
      keywordCount,
      metaLength: clean(article.metaDescription).length,
      image: checks.image,
      reviewed: checks.reviewed,
    };
  });

console.table(rows);

if (problems.length > 0) {
  console.error(`[seo-quality] ${problems.length} issue(s):`);
  for (const problem of problems) console.error(`- ${problem}`);
  process.exit(1);
}

if (warnings.length > 0) {
  console.warn(`[seo-quality] ${warnings.length} warning(s):`);
  for (const warning of warnings) console.warn(`- ${warning}`);
}

console.log(`[seo-quality] passed ${rows.length} Persian indexable articles`);
