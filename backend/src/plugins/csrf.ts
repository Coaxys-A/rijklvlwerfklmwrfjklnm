// CSRF — double-submit cookie verification on state-changing requests.
//
// The frontend reads the non-HttpOnly `tek_csrf` cookie and echoes the value
// in an `X-CSRF-Token` header on every POST/PUT/PATCH/DELETE. We compare it
// against the token stored alongside the session in Redis (set by the session
// plugin at login). Mismatch → 403.
//
// Login itself is exempt — there's no session yet, and the protection there
// comes from same-origin + rate-limit. Logout requires a valid token (so a
// malicious site can't force-log-out an authenticated user).

import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Routes that legitimately mutate state without an existing session (so the
// double-submit check is impossible / pointless on them).
const EXEMPT_PATHS = new Set([
  '/api/auth/login',
  '/api/auth/signup',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/auth/otp/send',
  '/api/auth/otp/verify',
  '/api/auth/2fa/verify',
  '/api/newsletter',
  '/api/analytics/events',
  '/api/errors',
  '/api/jobs',
]);
const EXEMPT_PREFIX = '/api/auth/oauth/';

export default fp(async function csrfPlugin(app: FastifyInstance) {
  app.addHook('preHandler', async (req: FastifyRequest, reply: FastifyReply) => {
    if (SAFE_METHODS.has(req.method)) return;
    const path = req.url.split('?')[0];
    if (EXEMPT_PATHS.has(path) || path.startsWith(EXEMPT_PREFIX)) return;

    if (!req.session) {
      // No session means no CSRF token to compare. Auth check (`requireAuth`)
      // will reject with 401 — but if a route is intentionally public-mutating,
      // it must be added to EXEMPT_PATHS above.
      return reply.code(401).send({ error: 'unauthenticated' });
    }

    const headerToken = req.headers['x-csrf-token'];
    if (typeof headerToken !== 'string' || headerToken.length === 0) {
      return reply.code(403).send({ error: 'csrf_missing' });
    }
    if (headerToken !== req.session.csrfToken) {
      return reply.code(403).send({ error: 'csrf_mismatch' });
    }
  });
});
