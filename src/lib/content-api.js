import { api } from './api.js';
import { TeknavData } from '../../teknav-data.js';
import { TeknavStore } from '../../teknav-store.js';

function normalizeArticle(article) {
  if (!article) return article;

  // Robust matching for categories and authors
  const category = TeknavData.categories.find((c) =>
    c.id === article.category || c.slug === article.category || c.slug === article.categorySlug || c.name === article.categoryName
  );
  const author = TeknavData.authors.find((a) =>
    a.id === article.authorId || a.slug === article.authorSlug || a.name === article.authorName || a.username === article.authorUsername
  );

  // CRITICAL: Fallback to TeknavData for content/metadata if the API returns thin/outdated data
  const seed = TeknavData.articles.find(a => a.id === article.id || a.slug === article.slug);

  return {
    ...article,
    title: seed?.title ?? article.title,
    subtitle: seed?.subtitle ?? article.subtitle,
    summary: seed?.summary ?? article.summary,
    content: seed?.content ?? article.content,
    date: seed?.date ?? article.date,
    dateEn: seed?.dateEn ?? article.dateEn,
    category: category?.id ?? article.category,
    categoryName: category?.name ?? article.categoryName,
    authorId: author?.id ?? article.authorId,
    authorName: author?.name ?? article.authorName,
    authorUsername: author?.username ?? article.authorUsername ?? null,
    author: author ?? article.author,
    diagram: seed?.diagram ?? article.diagram ?? 'neural',
    tags: seed?.tags ?? article.tags ?? [],
    metaDescription: seed?.metaDescription ?? article.metaDescription,
    keywords: seed?.keywords ?? article.keywords,
    canonicalPath: seed?.canonicalPath ?? article.canonicalPath,
  };
}

function publishedFallbackArticles() {
  return TeknavStore.getArticles().filter((a) => (
    a.status === 'منتشرشده' ||
    (!!a.dateEn && a.status !== 'پیش‌نویس' && a.status !== 'در انتظار بررسی')
  ));
}

function mergeArticleLists(apiItems = [], localItems = publishedFallbackArticles()) {
  const bySlug = new Map();

  localItems.forEach((article) => {
    if (article?.slug) bySlug.set(article.slug, normalizeArticle(article));
  });

  apiItems.forEach((article) => {
    const normalized = normalizeArticle(article);
    if (!normalized?.slug) return;
    bySlug.set(normalized.slug, {
      ...(bySlug.get(normalized.slug) ?? {}),
      ...normalized,
    });
  });

  return Array.from(bySlug.values());
}

function localRelatedArticles(article, limit = 3) {
  if (!article) return [];
  return publishedFallbackArticles()
    .filter((candidate) => candidate.category === article.category && candidate.id !== article.id)
    .slice(0, limit)
    .map(normalizeArticle);
}

function toQuery(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.set(key, String(value));
  });
  const s = query.toString();
  return s ? `?${s}` : '';
}

function fallbackArticles() {
  return publishedFallbackArticles().map(normalizeArticle);
}

function fallbackCategories() {
  return TeknavStore.getCategories();
}

function fallbackAuthors() {
  return TeknavData.authors;
}

export const contentApi = {
  fallbackArticles,
  fallbackCategories,
  fallbackAuthors,

  async listArticles(params = {}) {
    const res = await api.get(`/api/articles${toQuery(params)}`);
    return { ...res, items: mergeArticleLists(res?.items ?? []) };
  },

  async getArticle(slug) {
    const fallback = fallbackArticles().find((article) => article.slug === slug);
    const res = await api.get(`/api/articles/${encodeURIComponent(slug)}`);
    const article = normalizeArticle(res?.article ?? fallback);
    return {
      ...res,
      article,
      related: mergeArticleLists(res?.related ?? [], localRelatedArticles(article)),
    };
  },

  async getRelated(slug) {
    const res = await api.get(`/api/articles/${encodeURIComponent(slug)}/related`);
    const article = fallbackArticles().find((item) => item.slug === slug);
    return { ...res, items: mergeArticleLists(res?.items ?? [], localRelatedArticles(article)) };
  },

  async listSeries() {
    const res = await api.get('/api/series');
    return res?.items ?? [];
  },

  async getSeries(slug) {
    const res = await api.get(`/api/series/${encodeURIComponent(slug)}`);
    return res?.series;
  },

  async listNewsletterArchive() {
    const res = await api.get('/api/newsletter/archive');
    return res?.items ?? [];
  },

  async getNewsletterIssue(slug) {
    const res = await api.get(`/api/newsletter/archive/${encodeURIComponent(slug)}`);
    return res?.campaign;
  },

  async search(params = {}) {
    const res = await api.get(`/api/search${toQuery(params)}`);
    return { ...res, items: (res?.items ?? []).map(normalizeArticle) };
  },

  async listCategories() {
    const res = await api.get('/api/categories');
    return res?.items ?? [];
  },

  async getCategory(slug) {
    const res = await api.get(`/api/categories/${encodeURIComponent(slug)}`);
    return res?.category;
  },

  async listAuthors() {
    const res = await api.get('/api/authors');
    return res?.items ?? [];
  },

  async getAuthor(slug) {
    const res = await api.get(`/api/authors/${encodeURIComponent(slug)}`);
    return res?.author;
  },

  async listJobs() {
    const res = await api.get('/api/jobs');
    return res?.items ?? [];
  },

  submitJob(payload) {
    return api.post('/api/jobs', payload);
  },

  async listCourses() {
    const res = await api.get('/api/courses');
    return res?.items ?? [];
  },

  subscribeNewsletter(email, captchaId, userSolution) {
    return api.post('/api/newsletter', { email, captchaId, userSolution });
  },

  trackEvent(payload) {
    return api.post('/api/analytics/events', payload);
  },

  toggleReaction(articleId, type) {
    return api.post(`/api/articles/${encodeURIComponent(articleId)}/reactions`, { type });
  },

  toggleSaved(articleId) {
    return api.post(`/api/articles/${encodeURIComponent(articleId)}/save`, {});
  },
};
