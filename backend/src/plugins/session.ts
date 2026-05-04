// Session plugin — Redis-backed sessions identified by an opaque cookie.
//
// Cookie strategy:
//   tek_sid   — HttpOnly, Secure (in prod), SameSite=Lax. Holds the random session id.
//   tek_csrf  — readable by JS (NOT HttpOnly). Mirrors session.csrfToken so the
//               frontend can echo it back via X-CSRF-Token (double-submit pattern).
//
// Redis layout: `sess:{sid}` → JSON({ userId, role, csrfToken, iat }), TTL 14d.
// On every authenticated request we slide the TTL forward (touch-on-use) so an
// active session won't expire mid-use, but an idle one ages out cleanly.

import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { randomBytes } from 'node:crypto';
import { redis } from '../redis.js';
import { config } from '../config.js';

export const SESSION_COOKIE = 'tek_sid';
export const CSRF_COOKIE = 'tek_csrf';
export const SESSION_TTL_SECONDS = 14 * 24 * 60 * 60; // 14 days

export interface SessionData {
  userId: string;
  role: 'admin' | 'editor' | 'writer' | 'reviewer' | 'reader';
  csrfToken: string;
  iat: number;
}

export interface ResolvedSession extends SessionData {
  sid: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    session: ResolvedSession | null;
  }
  interface FastifyReply {
    createSession(data: Omit<SessionData, 'csrfToken' | 'iat'>): Promise<ResolvedSession>;
    destroySession(): Promise<void>;
  }
}

const sessionKey = (sid: string) => `sess:${sid}`;
const randomB64Url = (bytes: number) => randomBytes(bytes).toString('base64url');

const cookieOpts = {
  httpOnly: true as const,
  secure: config.isProd,
  sameSite: 'lax' as const,
  path: '/',
  ...(config.COOKIE_DOMAIN ? { domain: config.COOKIE_DOMAIN } : {}),
};

const csrfCookieOpts = { ...cookieOpts, httpOnly: false };

export default fp(async function sessionPlugin(app: FastifyInstance) {
  app.addHook('onRequest', async (req: FastifyRequest, _reply: FastifyReply) => {
    req.session = null;
    const sid = req.cookies?.[SESSION_COOKIE];
    if (!sid) return;
    const raw = await redis.get(sessionKey(sid));
    if (!raw) return;
    try {
      const data = JSON.parse(raw) as SessionData;
      req.session = { sid, ...data };
      // Touch-on-use: slide TTL forward.
      await redis.expire(sessionKey(sid), SESSION_TTL_SECONDS);
    } catch {
      // Corrupt session blob — drop it.
      await redis.del(sessionKey(sid));
    }
  });

  app.decorateReply('createSession', async function (
    this: FastifyReply,
    data: Omit<SessionData, 'csrfToken' | 'iat'>,
  ): Promise<ResolvedSession> {
    const sid = randomB64Url(32);
    const csrfToken = randomB64Url(16);
    const payload: SessionData = { ...data, csrfToken, iat: Date.now() };
    await redis.set(sessionKey(sid), JSON.stringify(payload), 'EX', SESSION_TTL_SECONDS);
    this.setCookie(SESSION_COOKIE, sid, { ...cookieOpts, maxAge: SESSION_TTL_SECONDS });
    this.setCookie(CSRF_COOKIE, csrfToken, { ...csrfCookieOpts, maxAge: SESSION_TTL_SECONDS });
    return { sid, ...payload };
  });

  app.decorateReply('destroySession', async function (this: FastifyReply) {
    const req = this.request;
    if (req.session?.sid) {
      await redis.del(sessionKey(req.session.sid));
    }
    this.clearCookie(SESSION_COOKIE, cookieOpts);
    this.clearCookie(CSRF_COOKIE, csrfCookieOpts);
    req.session = null;
  });
});

// Route preHandler factory. Use:
//   app.get('/api/admin/x', { preHandler: requireAuth(['admin','editor']) }, handler)
export function requireAuth(roles?: SessionData['role'][]) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.session) {
      return reply.code(401).send({ error: 'unauthenticated' });
    }
    if (roles && !roles.includes(req.session.role)) {
      return reply.code(403).send({ error: 'forbidden' });
    }
  };
}
