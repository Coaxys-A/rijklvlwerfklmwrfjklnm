// Frontend ↔ backend client.
// All requests are same-origin in prod (reverse-proxied at /api/*); in dev we
// rely on Vite's proxy or a fully-qualified backend URL. Set VITE_API_BASE
// in .env to override (e.g. "http://localhost:3010" during dev).

const BASE = (import.meta.env?.VITE_API_BASE ?? '').replace(/\/$/, '');

const CSRF_COOKIE = 'tek_csrf';

function readCookie(name) {
  const m = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : null;
}

class ApiError extends Error {
  constructor(message, { status, body } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

async function request(path, { method = 'GET', body, headers = {} } = {}) {
  const finalHeaders = { Accept: 'application/json', ...headers };
  let payload;
  if (body !== undefined) {
    finalHeaders['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  // Attach CSRF token on mutating methods if one is present.
  if (method !== 'GET' && method !== 'HEAD') {
    const csrf = readCookie(CSRF_COOKIE);
    if (csrf) finalHeaders['X-CSRF-Token'] = csrf;
  }

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: finalHeaders,
    body: payload,
    credentials: 'include',
  });

  const text = await res.text();
  const data = text ? safeJson(text) : null;

  if (!res.ok) {
    throw new ApiError(data?.error ?? `http_${res.status}`, { status: res.status, body: data });
  }
  return data;
}

function safeJson(s) {
  try { return JSON.parse(s); } catch { return s; }
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body }),
  put: (path, body) => request(path, { method: 'PUT', body }),
  patch: (path, body) => request(path, { method: 'PATCH', body }),
  del: (path) => request(path, { method: 'DELETE' }),
};

export { ApiError };
