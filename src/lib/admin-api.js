import { api } from './api.js';

function toQuery(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.set(key, String(value));
  });
  const s = query.toString();
  return s ? `?${s}` : '';
}

function normalizeArticle(article) {
  if (!article) return article;
  return {
    ...article,
    category: article.categorySlug || article.category,
    tags: Array.isArray(article.tags) ? article.tags : [],
  };
}

export const adminApi = {
  async listArticles(params) {
    const res = await api.get(`/api/admin/articles${toQuery(params)}`);
    return { ...res, items: (res?.items ?? []).map(normalizeArticle) };
  },
  async getDashboard() {
    const res = await api.get('/api/admin/dashboard');
    return { ...res, recentArticles: (res?.recentArticles ?? []).map(normalizeArticle), recentActivity: res?.recentActivity ?? [] };
  },
  async getPanelMetrics() {
    const res = await api.get('/api/admin/panel-metrics');
    return { ...res, recentArticles: (res?.recentArticles ?? []).map(normalizeArticle) };
  },
  async getWriterDashboard() {
    const res = await api.get('/api/admin/writer/dashboard');
    return {
      ...res,
      recentArticles: (res?.recentArticles ?? []).map(normalizeArticle),
      recentComments: res?.recentComments ?? [],
      viewsByDay: res?.viewsByDay ?? [],
    };
  },
  async getAnalytics() {
    const res = await api.get('/api/admin/analytics');
    return { ...res, topArticles: (res?.topArticles ?? []).map(normalizeArticle), viewsByDay: res?.viewsByDay ?? [] };
  },
  getSeoAudit() {
    return api.get('/api/admin/seo/audit');
  },
  getContentAnalytics() {
    return api.get('/api/admin/analytics/content');
  },
  getNewsletterAnalytics() {
    return api.get('/api/admin/analytics/newsletter');
  },
  getEngagementAnalytics() {
    return api.get('/api/admin/analytics/engagement');
  },
  async createArticle(article) {
    const res = await api.post('/api/admin/articles', article);
    return normalizeArticle(res.article);
  },
  async updateArticle(id, article) {
    const res = await api.patch(`/api/admin/articles/${encodeURIComponent(id)}`, article);
    return normalizeArticle(res.article);
  },
  async addArticleCorrection(id, note) {
    const res = await api.post(`/api/admin/articles/${encodeURIComponent(id)}/corrections`, { note });
    return normalizeArticle(res.article);
  },
  async publishArticle(id) {
    const res = await api.post(`/api/admin/articles/${encodeURIComponent(id)}/publish`, {});
    return normalizeArticle(res.article);
  },
  async scheduleArticle(id, scheduledAt) {
    const res = await api.post(`/api/admin/articles/${encodeURIComponent(id)}/schedule`, { scheduledAt });
    return normalizeArticle(res.article);
  },
  deleteArticle(id) {
    return api.del(`/api/admin/articles/${encodeURIComponent(id)}`);
  },

  async listCategories() {
    const res = await api.get('/api/admin/categories');
    return res?.items ?? [];
  },
  async createCategory(category) {
    const res = await api.post('/api/admin/categories', category);
    return res.category;
  },
  async updateCategory(id, category) {
    const res = await api.patch(`/api/admin/categories/${encodeURIComponent(id)}`, category);
    return res.category;
  },
  deleteCategory(id) {
    return api.del(`/api/admin/categories/${encodeURIComponent(id)}`);
  },

  async listTags() {
    const res = await api.get('/api/admin/tags');
    return res?.items ?? [];
  },
  async createTag(name) {
    const res = await api.post('/api/admin/tags', { name });
    return res.tag;
  },
  deleteTag(id) {
    return api.del(`/api/admin/tags/${encodeURIComponent(id)}`);
  },

  async listAuthors() {
    const res = await api.get('/api/admin/authors');
    return res?.items ?? [];
  },
  async createAuthor(author) {
    const res = await api.post('/api/admin/authors', author);
    return res;
  },
  async updateAuthor(id, author) {
    const res = await api.put(`/api/admin/authors/${encodeURIComponent(id)}`, author);
    return res;
  },
  deleteAuthor(id) {
    return api.del(`/api/admin/authors/${encodeURIComponent(id)}`);
  },

  async listUsers() {
    const res = await api.get('/api/admin/users');
    return res?.items ?? [];
  },
  async updateUser(id, updates) {
    const res = await api.patch(`/api/admin/users/${encodeURIComponent(id)}`, updates);
    return res.user;
  },

  async listActivity(params) {
    const res = await api.get(`/api/admin/activity${toQuery(params)}`);
    return res?.items ?? [];
  },
  activityExportUrl(params) {
    return `/api/admin/activity/export.csv${toQuery(params)}`;
  },

  async listComments(params) {
    const res = await api.get(`/api/admin/comments${toQuery(params)}`);
    return { items: res?.items ?? [], total: res?.total ?? 0 };
  },
  deleteComment(id) {
    return api.del(`/api/admin/comments/${encodeURIComponent(id)}`);
  },
  deleteFlaggedComments() {
    return api.del('/api/admin/comments');
  },
  bulkModerateComments(ids, action) {
    return api.post('/api/admin/comments/bulk', { ids, action });
  },
  unflagComment(id) {
    return api.put(`/api/admin/comments/${encodeURIComponent(id)}/unflag`, {});
  },

  async listMedia(params) {
    const res = await api.get(`/api/admin/media${toQuery(params)}`);
    return { items: res?.items ?? [], pagination: res?.pagination ?? null };
  },
  deleteMedia(id) {
    return api.del(`/api/admin/media/${encodeURIComponent(id)}`);
  },

  upload(payload) {
    return api.post('/api/admin/uploads', payload);
  },

  async listReviews() {
    const res = await api.get('/api/admin/reviews');
    return res?.items ?? [];
  },
  updateReview(articleId, payload) {
    return api.put(`/api/admin/articles/${encodeURIComponent(articleId)}/review`, payload);
  },

  async listNewsletterSubscribers() {
    const res = await api.get('/api/admin/newsletter/subscribers');
    return res?.items ?? [];
  },
  async listNewsletterCampaigns() {
    const res = await api.get('/api/admin/newsletter/campaigns');
    return res?.items ?? [];
  },
  async createNewsletterCampaign(payload) {
    const res = await api.post('/api/admin/newsletter/campaigns', payload);
    return res.campaign;
  },
  async sendNewsletterCampaign(id) {
    const res = await api.post(`/api/admin/newsletter/campaigns/${encodeURIComponent(id)}/send`, {});
    return res.campaign;
  },

  async listSeries() {
    const res = await api.get('/api/admin/series');
    return res?.items ?? [];
  },
  async createSeries(payload) {
    const res = await api.post('/api/admin/series', payload);
    return res.series;
  },
  async updateSeries(id, payload) {
    const res = await api.patch(`/api/admin/series/${encodeURIComponent(id)}`, payload);
    return res.series;
  },
  deleteSeries(id) {
    return api.del(`/api/admin/series/${encodeURIComponent(id)}`);
  },

  async listJobs(params) {
    const res = await api.get(`/api/admin/jobs${toQuery(params)}`);
    return res?.items ?? [];
  },
  moderateJob(id, payload) {
    return api.patch(`/api/admin/jobs/${encodeURIComponent(id)}`, payload);
  },

  getClientErrors() {
    return api.get('/api/admin/errors');
  },
};
