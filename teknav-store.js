// teknav-store.js — Frontend state management via localStorage (ES module)
import { TeknavData } from './teknav-data.js';

export const TeknavStore = (() => {
  const DATA_VERSION = '2026-05-02-v1';

  const LS = {
    get: (k, def) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch { return def; } },
    set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  };

  // Version check — Clear old 2024 placeholder data
  if (localStorage.getItem('teknav_data_version') !== DATA_VERSION) {
    localStorage.removeItem('teknav_articles');
    localStorage.removeItem('teknav_activity');
    localStorage.setItem('teknav_data_version', DATA_VERSION);
  }

  // Session
  const getUser = () => LS.get('teknav_user', null);
  const setUser = (user) => LS.set('teknav_user', user);
  const logout = () => { localStorage.removeItem('teknav_user'); };

  const login = (_email, _password) => {
    // localStorage auth removed. All auth goes through /api/auth/login.
    return null;
  };

  // Articles (seed + created)
  const getArticles = () => {
    const created = LS.get('teknav_articles', []);
    return [...TeknavData.articles, ...created];
  };

  const createArticle = (article) => {
    const articles = LS.get('teknav_articles', []);
    const newArt = { ...article, id: 'art_' + Date.now(), date: new Date().toLocaleDateString('fa-IR'), views: 0, reactions: 0 };
    LS.set('teknav_articles', [newArt, ...articles]);
    addActivity('مقاله جدید ایجاد شد', newArt.title, 'draft');
    return newArt;
  };

  const updateArticle = (id, updates) => {
    // Update in seed if exists
    const seedIdx = TeknavData.articles.findIndex(a => a.id === id);
    if (seedIdx !== -1) {
      Object.assign(TeknavData.articles[seedIdx], updates);
      return;
    }
    const articles = LS.get('teknav_articles', []);
    const idx = articles.findIndex(a => a.id === id);
    if (idx !== -1) { articles[idx] = { ...articles[idx], ...updates }; LS.set('teknav_articles', articles); }
    addActivity('مقاله ویرایش شد', updates.title || id, 'edit');
  };

  const deleteArticle = (id) => {
    const articles = LS.get('teknav_articles', []);
    LS.set('teknav_articles', articles.filter(a => a.id !== id));
    addActivity('مقاله حذف شد', id, 'delete');
  };

  // Saved articles
  const getSaved = () => LS.get('teknav_saved', []);
  const toggleSaved = (id) => {
    const saved = getSaved();
    const newSaved = saved.includes(id) ? saved.filter(s => s !== id) : [...saved, id];
    LS.set('teknav_saved', newSaved);
    return newSaved.includes(id);
  };
  const isSaved = (id) => getSaved().includes(id);

  // Newsletter
  const subscribeNewsletter = (email) => {
    const subs = LS.get('teknav_newsletter', []);
    if (subs.includes(email)) return false;
    LS.set('teknav_newsletter', [...subs, email]);
    return true;
  };

  // Reactions
  const getReactions = () => LS.get('teknav_reactions', {});
  const toggleReaction = (articleId, type) => {
    const reactions = getReactions();
    const key = `${articleId}_${type}`;
    const reacted = reactions[key];
    reactions[key] = !reacted;
    LS.set('teknav_reactions', reactions);
    return !reacted;
  };
  const hasReacted = (articleId, type) => getReactions()[`${articleId}_${type}`] || false;

  // Activity log
  const getActivity = () => {
    const extra = LS.get('teknav_activity', []);
    return [...extra, ...TeknavData.activityLog];
  };
  const addActivity = (action, target, type) => {
    const log = LS.get('teknav_activity', []);
    const user = getUser();
    log.unshift({ id: Date.now(), user: user?.name || 'سیستم', action, target, time: 'همین الان', type });
    LS.set('teknav_activity', log.slice(0, 50));
  };

  // Users management
  const getUsers = () => {
    const overrides = LS.get('teknav_users_override', {});
    return TeknavData.users.map(u => ({ ...u, ...(overrides[u.id] || {}) }));
  };
  const updateUser = (id, updates) => {
    const overrides = LS.get('teknav_users_override', {});
    overrides[id] = { ...(overrides[id] || {}), ...updates };
    LS.set('teknav_users_override', overrides);
  };

  // Categories management
  const getCategories = () => {
    const extra = LS.get('teknav_categories', []);
    return [...TeknavData.categories, ...extra];
  };
  const addCategory = (cat) => {
    const cats = LS.get('teknav_categories', []);
    cats.push({ ...cat, id: 'cat_' + Date.now(), articleCount: 0, authorCount: 0, avgReadTime: 0 });
    LS.set('teknav_categories', cats);
  };
  const deleteCategory = (id) => {
    const cats = LS.get('teknav_categories', []);
    LS.set('teknav_categories', cats.filter(c => c.id !== id));
  };

  // Tags management
  const getTags = () => {
    const extra = LS.get('teknav_tags', []);
    return [...TeknavData.tags, ...extra];
  };
  const addTag = (name) => {
    const tags = LS.get('teknav_tags', []);
    tags.push({ id: Date.now(), name, count: 0 });
    LS.set('teknav_tags', tags);
  };
  const deleteTag = (id) => {
    const tags = LS.get('teknav_tags', []);
    LS.set('teknav_tags', tags.filter(t => t.id !== id));
  };

  return {
    getUser, setUser, logout, login,
    getArticles, createArticle, updateArticle, deleteArticle,
    getSaved, toggleSaved, isSaved,
    subscribeNewsletter,
    getReactions, toggleReaction, hasReacted,
    getActivity, addActivity,
    getUsers, updateUser,
    getCategories, addCategory, deleteCategory,
    getTags, addTag, deleteTag,
  };
})();
