import { api } from './api.js';

function toQuery(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.set(key, String(value));
  });
  const s = query.toString();
  return s ? `?${s}` : '';
}

export const engagementApi = {
  listComments(slug, params) {
    return api.get(`/api/articles/${encodeURIComponent(slug)}/comments${toQuery(params)}`);
  },
  postComment(slug, body, replyToId) {
    return api.post(`/api/articles/${encodeURIComponent(slug)}/comments`, { body, replyToId });
  },
  flagComment(id) {
    return api.post(`/api/comments/${encodeURIComponent(id)}/flag`, {});
  },
  likeComment(id) {
    return api.post(`/api/comments/${encodeURIComponent(id)}/like`, {});
  },
  upvoteComment(id) {
    return api.post(`/api/comments/${encodeURIComponent(id)}/upvote`, {});
  },
  recordHistory(articleId, progress = 0) {
    return api.post('/api/auth/history', { articleId, progress });
  },
  getStreaks() {
    return api.get('/api/auth/streaks');
  },
  listHistory(params) {
    return api.get(`/api/auth/history${toQuery(params)}`);
  },
  clearHistory() {
    return api.del('/api/auth/history');
  },
  listNotifications(params) {
    return api.get(`/api/auth/notifications${toQuery(params)}`);
  },
  markNotificationsRead() {
    return api.post('/api/auth/notifications/read-all', {});
  },
  markNotificationRead(id) {
    return api.patch(`/api/auth/notifications/${encodeURIComponent(id)}/read`, {});
  },
  deleteNotification(id) {
    return api.del(`/api/auth/notifications/${encodeURIComponent(id)}`);
  },
  followWriter(username) {
    return api.post(`/api/writers/${encodeURIComponent(username.replace(/^@/, ''))}/follow`, {});
  },
  unfollowWriter(username) {
    return api.del(`/api/writers/${encodeURIComponent(username.replace(/^@/, ''))}/follow`);
  },
  writerFollowers(username, params) {
    return api.get(`/api/writers/${encodeURIComponent(username.replace(/^@/, ''))}/followers${toQuery(params)}`);
  },
  followTopic(slug) {
    return api.post(`/api/topics/${encodeURIComponent(slug)}/follow`, {});
  },
  unfollowTopic(slug) {
    return api.del(`/api/topics/${encodeURIComponent(slug)}/follow`);
  },
  topicFollowers(slug, params) {
    return api.get(`/api/topics/${encodeURIComponent(slug)}/followers${toQuery(params)}`);
  },
  following() {
    return api.get('/api/auth/following');
  },
  listReadingLists() {
    return api.get('/api/auth/lists');
  },
  createReadingList(name) {
    return api.post('/api/auth/lists', { name });
  },
  deleteReadingList(id) {
    return api.del(`/api/auth/lists/${encodeURIComponent(id)}`);
  },
  addToReadingList(listId, articleId) {
    return api.post(`/api/auth/lists/${encodeURIComponent(listId)}/items`, { articleId });
  },
  removeFromReadingList(listId, itemId) {
    return api.del(`/api/auth/lists/${encodeURIComponent(listId)}/items/${encodeURIComponent(itemId)}`);
  },
  reorderReadingList(listId, itemIds) {
    return api.put(`/api/auth/lists/${encodeURIComponent(listId)}/reorder`, { itemIds });
  },
  listQa(slug) {
    return api.get(`/api/articles/${encodeURIComponent(slug)}/qa`);
  },
  postQuestion(slug, body) {
    return api.post(`/api/articles/${encodeURIComponent(slug)}/qa`, { body });
  },
  postAnswer(questionId, body) {
    return api.post(`/api/qa/questions/${encodeURIComponent(questionId)}/answers`, { body });
  },
  writerAnalyticsOverview() {
    return api.get('/api/auth/analytics/overview');
  },
  writerAnalyticsArticles() {
    return api.get('/api/auth/analytics/articles');
  },
  writerAnalyticsArticle(slug) {
    return api.get(`/api/auth/analytics/article/${encodeURIComponent(slug)}`);
  },
  listBadges() {
    return api.get('/api/auth/badges');
  },
};

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

function getCsrfToken() {
  return document.cookie.match(/tek_csrf=([^;]+)/)?.[1] ?? '';
}

export const notificationPreferencesApi = {
  get() {
    return api.get('/api/auth/notifications/preferences');
  },
  update(preferences) {
    return api.put('/api/auth/notifications/preferences', preferences);
  },
};

export const revisionsApi = {
  list(articleId, page = 1) {
    return api.get(`/api/admin/articles/${encodeURIComponent(articleId)}/revisions?page=${page}`);
  },
  get(articleId, revisionId) {
    return api.get(`/api/admin/articles/${encodeURIComponent(articleId)}/revisions/${encodeURIComponent(revisionId)}`);
  },
  restore(articleId, revisionId) {
    return api.post(`/api/admin/articles/${encodeURIComponent(articleId)}/revisions/${encodeURIComponent(revisionId)}/restore`, {});
  },
};

export const presenceApi = {
  heartbeat(articleId) {
    return api.post(`/api/admin/articles/${encodeURIComponent(articleId)}/heartbeat`, {});
  },
  getEditors(articleId) {
    return api.get(`/api/admin/articles/${encodeURIComponent(articleId)}/presence`);
  },
};

export const pushApi = {
  async getVapidKey() {
    const r = await fetch('/api/auth/push/vapid-key', { credentials: 'include' });
    if (!r.ok) throw new Error('push_not_configured');
    const { publicKey } = await r.json();
    return publicKey;
  },
  async isSubscribed() {
    if (!('PushManager' in window) || !('serviceWorker' in navigator)) return false;
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return !!sub;
  },
  async subscribe() {
    const publicKey = await this.getVapidKey();
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
    const json = sub.toJSON();
    await fetch('/api/auth/push/subscribe', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCsrfToken() },
      body: JSON.stringify({
        endpoint: json.endpoint,
        auth: json.keys.auth,
        p256dh: json.keys.p256dh,
        userAgent: navigator.userAgent,
      }),
    });
    return sub;
  },
  async unsubscribe() {
    if (!('serviceWorker' in navigator)) return;
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;
    await fetch('/api/auth/push/unsubscribe', {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCsrfToken() },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    });
    await sub.unsubscribe();
  },
  async getGuestVapidKey() {
    const r = await fetch('/api/push/vapid-key');
    if (!r.ok) throw new Error('push_not_configured');
    const { publicKey } = await r.json();
    return publicKey;
  },
  async subscribeAsGuest(topics) {
    const publicKey = await this.getGuestVapidKey();
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
    const json = sub.toJSON();
    const r = await fetch('/api/push/guest-subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: json.endpoint,
        auth: json.keys.auth,
        p256dh: json.keys.p256dh,
        topics,
        userAgent: navigator.userAgent,
      }),
    });
    if (!r.ok) throw new Error('subscribe_failed');
    return sub;
  },
  async unsubscribeGuest() {
    if (!('serviceWorker' in navigator)) return;
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;
    await fetch('/api/push/guest-unsubscribe', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    });
    await sub.unsubscribe();
  },
};
