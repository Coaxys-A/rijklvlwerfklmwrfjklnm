import test from 'node:test';
import assert from 'node:assert/strict';

const BASE = process.env.TEST_BASE_URL || 'http://127.0.0.1:3010';
const SESSION = process.env.TEST_SESSION_COOKIE || '';
const CSRF = process.env.TEST_CSRF_TOKEN || '';
const TEST_ARTICLE_SLUG = process.env.TEST_ARTICLE_SLUG || 'agentic-ai-production';

async function request(path, options = {}) {
  const headers = {
    'content-type': 'application/json',
    ...(SESSION ? { cookie: SESSION } : {}),
    ...(CSRF ? { 'x-csrf-token': CSRF } : {}),
    ...(options.headers || {}),
  };
  return fetch(`${BASE}${path}`, { ...options, headers });
}

test('auth rejects invalid credentials without leaking internals', async () => {
  const res = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier: 'nobody@example.invalid', password: 'wrong', captchaId: 'invalid', userSolution: '0000' }),
  });
  assert.ok([400, 401, 429].includes(res.status));
  const body = await res.json().catch(() => ({}));
  assert.ok(body.error || body.message);
});

test('public article and comments endpoints are reachable', async () => {
  const articleRes = await request(`/api/articles/${TEST_ARTICLE_SLUG}`);
  assert.equal(articleRes.status, 200);
  const articleBody = await articleRes.json();
  assert.ok(articleBody.article?.id);

  const commentsRes = await request(`/api/articles/${TEST_ARTICLE_SLUG}/comments`);
  assert.equal(commentsRes.status, 200);
  const commentsBody = await commentsRes.json();
  assert.ok(Array.isArray(commentsBody.items));
});

test('authenticated comment flow works when TEST_SESSION_COOKIE and TEST_CSRF_TOKEN are set', { skip: !SESSION || !CSRF }, async () => {
  const res = await request(`/api/articles/${TEST_ARTICLE_SLUG}/comments`, {
    method: 'POST',
    body: JSON.stringify({ body: `Phase 10 smoke ${Date.now()}` }),
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(body.comment?.id);
});

test('authenticated article publish workflow is protected and callable when configured', { skip: !SESSION || !CSRF || !process.env.TEST_PUBLISH_ARTICLE_ID }, async () => {
  const res = await request(`/api/admin/articles/${encodeURIComponent(process.env.TEST_PUBLISH_ARTICLE_ID)}/publish`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
  assert.ok([200, 403, 404].includes(res.status));
});
