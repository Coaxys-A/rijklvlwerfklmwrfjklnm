// Auth routes — /api/auth/{login,logout,me}.
// Argon2id verify; per-IP login rate-limit (5 fails / 15 min) backed by Redis.

import type { FastifyInstance } from 'fastify';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import * as argon2 from '@node-rs/argon2';
import { prisma } from '../db.js';
import { redis } from '../redis.js';
import type { SessionData } from '../plugins/session.js';
import { verifyCaptcha } from '../lib/captcha.js';
import { issueOtp, verifyOtp } from '../lib/otp.js';

const LOGIN_FAIL_WINDOW_SECONDS = 15 * 60;
const LOGIN_FAIL_MAX = 5;
const TWO_FACTOR_TTL_SECONDS = 5 * 60;
const USERNAME_RE = /^[a-z0-9_][a-z0-9_.]{1,28}[a-z0-9_]$/;

const loginSchema = z.object({
  identifier: z.string().trim().min(3).max(254),
  password: z.string().min(1).max(256),
  captchaId: z.string().trim().min(1).max(64),
  userSolution: z.string().trim().min(1).max(20),
});

const twoFactorVerifySchema = z.object({
  ticket: z.string().trim().min(16).max(160),
  code: z.string().trim().regex(/^\d{6}$/),
});

const twoFactorSettingsSchema = z.object({
  enabled: z.coerce.boolean(),
});

function publicUser(u: {
  id: string;
  email: string;
  phone: string | null;
  username: string | null;
  name: string;
  bio: string | null;
  avatarUrl: string | null;
  role: string;
  status: string;
  emailVerifiedAt: Date | null;
  phoneVerifiedAt: Date | null;
  twoFactorEnabled: boolean;
}) {
  return {
    id: u.id,
    email: u.email,
    phone: u.phone,
    username: u.username,
    name: u.name,
    bio: u.bio,
    avatarUrl: u.avatarUrl,
    role: u.role,
    status: u.status,
    emailVerified: !!u.emailVerifiedAt,
    phoneVerified: !!u.phoneVerifiedAt,
    twoFactorEnabled: u.twoFactorEnabled,
  };
}

export default async function authRoutes(app: FastifyInstance) {
  app.post('/api/auth/login', async (req, reply) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_input' });
    }
    const { password, captchaId, userSolution } = parsed.data;
    const identifier = parsed.data.identifier.replace(/^@/, '').toLowerCase();

    // Verify captcha first
    const captchaValid = verifyCaptcha(captchaId, userSolution);
    if (!captchaValid) {
      return reply.code(400).send({ error: 'invalid_captcha' });
    }

    // Per-IP fail counter. Hits the limit → 429 until window expires.
    const ip = req.ip;
    const failKey = `loginfail:${ip}`;
    const failCount = Number((await redis.get(failKey)) ?? 0);
    if (failCount >= LOGIN_FAIL_MAX) {
      const ttl = await redis.ttl(failKey);
      reply.header('Retry-After', String(Math.max(ttl, 1)));
      return reply.code(429).send({ error: 'too_many_attempts', retryAfter: ttl });
    }

    const user = USERNAME_RE.test(identifier) && !identifier.includes('@')
      ? await prisma.user.findUnique({ where: { username: identifier } })
      : await prisma.user.findUnique({ where: { email: identifier } });
    // Always run a verify to keep response time roughly constant whether or not
    // the email exists — protects against email-enumeration via timing.
    const fakeHash = '$argon2id$v=19$m=19456,t=2,p=1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    const ok = await argon2
      .verify(user?.passwordHash ?? fakeHash, password)
      .catch(() => false);

    if (!user || !ok) {
      const next = await redis.incr(failKey);
      if (next === 1) await redis.expire(failKey, LOGIN_FAIL_WINDOW_SECONDS);
      return reply.code(401).send({ error: 'invalid_credentials' });
    }
    if (user.status !== 'active') {
      return reply.code(403).send({ error: 'account_' + user.status });
    }
    if (user.twoFactorEnabled) {
      if (!user.phone) return reply.code(409).send({ error: 'two_factor_phone_required' });
      const sent = await issueOtp(user.phone);
      if (!sent.sent) return reply.code(503).send({ error: 'two_factor_unavailable', reason: sent.reason });
      const ticket = randomBytes(32).toString('base64url');
      await redis.set(`2fa:${ticket}`, user.id, 'EX', TWO_FACTOR_TTL_SECONDS);
      await redis.del(failKey);
      return reply.send({ ok: true, twoFactorRequired: true, ticket });
    }

    // Success — clear the IP fail counter and create a session.
    await redis.del(failKey);
    await reply.createSession({
      userId: user.id,
      role: user.role as SessionData['role'],
    });

    return reply.send({ ok: true, user: publicUser(user) });
  });

  app.post('/api/auth/2fa/verify', async (req, reply) => {
    const parsed = twoFactorVerifySchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_input' });
    const userId = await redis.get(`2fa:${parsed.data.ticket}`);
    if (!userId) return reply.code(400).send({ error: 'two_factor_ticket_expired' });
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.phone) return reply.code(400).send({ error: 'two_factor_phone_required' });
    const ok = await verifyOtp(user.phone, parsed.data.code);
    if (!ok) return reply.code(400).send({ error: 'invalid_otp' });
    await redis.del(`2fa:${parsed.data.ticket}`);
    await reply.createSession({
      userId: user.id,
      role: user.role as SessionData['role'],
    });
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }).catch(() => undefined);
    return reply.send({ ok: true, user: publicUser(user) });
  });

  app.put('/api/auth/2fa', async (req, reply) => {
    if (!req.session) return reply.code(401).send({ error: 'unauthenticated' });
    const parsed = twoFactorSettingsSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_input' });
    const user = await prisma.user.findUnique({ where: { id: req.session.userId } });
    if (!user) return reply.code(404).send({ error: 'user_not_found' });
    if (parsed.data.enabled && !user.phone) return reply.code(409).send({ error: 'phone_required' });
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorEnabled: parsed.data.enabled, twoFactorMethod: parsed.data.enabled ? 'sms' : null },
    });
    return reply.send({ ok: true, user: publicUser(updated) });
  });

  app.post('/api/auth/logout', async (_req, reply) => {
    await reply.destroySession();
    return reply.send({ ok: true });
  });

  app.get('/api/auth/me', async (req, reply) => {
    if (!req.session) return reply.code(401).send({ error: 'unauthenticated' });
    const user = await prisma.user.findUnique({ where: { id: req.session.userId } });
    if (!user) {
      // Session points at a deleted user — clean up.
      await reply.destroySession();
      return reply.code(401).send({ error: 'unauthenticated' });
    }
    return reply.send({ user: publicUser(user) });
  });
}
