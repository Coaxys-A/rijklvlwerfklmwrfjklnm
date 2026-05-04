// Signup — public registration as a `reader` (regular viewer with an account).
// Email or phone is required; both can be provided. Password is Argon2id-hashed.
//
// On success we create a Redis-backed session immediately so the user is logged
// in. Captcha is required to deter bot signups.

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import * as argon2 from '@node-rs/argon2';
import { prisma } from '../db.js';
import { redis } from '../redis.js';
import { verifyCaptcha } from '../lib/captcha.js';
import type { SessionData } from '../plugins/session.js';
import { publishRealtime } from '../lib/realtime.js';

const SIGNUP_WINDOW_SECONDS = 60 * 60; // 1 hour
const SIGNUP_MAX_PER_IP = 10;          // 10 fresh accounts / IP / hour

// Loose Persian-friendly phone regex: optional +, 8–15 digits.
const PHONE_RE = /^\+?[0-9]{8,15}$/;
const USERNAME_RE = /^[a-z0-9_][a-z0-9_.]{1,28}[a-z0-9_]$/;

const signupSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    username: z.string().trim().toLowerCase().regex(USERNAME_RE),
    email: z.string().email().max(254).toLowerCase().optional(),
    phone: z
      .string()
      .trim()
      .transform((s) => s.replace(/[\s-]/g, ''))
      .refine((s) => s === '' || PHONE_RE.test(s), 'invalid_phone')
      .optional(),
    password: z.string().min(8).max(256),
    captchaId: z.string().trim().min(1).max(64),
    userSolution: z.string().trim().min(1).max(20),
  })
  .refine((d) => !!d.email || !!d.phone, { message: 'email_or_phone_required' });

async function hash(password: string) {
  return argon2.hash(password, {
    algorithm: argon2.Algorithm.Argon2id,
    memoryCost: 19 * 1024,
    timeCost: 2,
    parallelism: 1,
  });
}

export default async function signupRoutes(app: FastifyInstance) {
  app.post('/api/auth/signup', async (req, reply) => {
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_input', details: parsed.error.flatten().fieldErrors });
    }
    const { name, username, email, phone, password, captchaId, userSolution } = parsed.data;

    if (!verifyCaptcha(captchaId, userSolution)) {
      return reply.code(400).send({ error: 'invalid_captcha' });
    }

    // Per-IP rate limit on signup.
    const ip = req.ip;
    const rlKey = `signup:ip:${ip}`;
    const hits = await redis.incr(rlKey);
    if (hits === 1) await redis.expire(rlKey, SIGNUP_WINDOW_SECONDS);
    if (hits > SIGNUP_MAX_PER_IP) {
      const ttl = await redis.ttl(rlKey);
      reply.header('Retry-After', String(Math.max(ttl, 1)));
      return reply.code(429).send({ error: 'too_many_signups', retryAfter: ttl });
    }

    // Uniqueness pre-check (race-safe via the unique index below).
    if (email) {
      const dupe = await prisma.user.findUnique({ where: { email } });
      if (dupe) return reply.code(409).send({ error: 'email_taken' });
    }
    const usernameDupe = await prisma.user.findUnique({ where: { username } });
    if (usernameDupe) return reply.code(409).send({ error: 'username_taken' });
    if (phone) {
      const dupe = await prisma.user.findUnique({ where: { phone } });
      if (dupe) return reply.code(409).send({ error: 'phone_taken' });
    }

    const passwordHash = await hash(password);

    let user;
    try {
      user = await prisma.user.create({
        data: {
          name,
          // Email is the primary identifier; if the user only gave phone,
          // synthesize a placeholder so the unique index is satisfied. They can
          // add a real email later.
          email: email ?? `phone+${phone}@teknav.local`,
          username,
          phone: phone || null,
          passwordHash,
          role: 'reader',
          status: 'active',
          lastLoginAt: new Date(),
        },
      });
    } catch (e: any) {
      // P2002 = unique constraint violation
      if (e?.code === 'P2002') {
        return reply.code(409).send({ error: 'account_exists' });
      }
      throw e;
    }

    await reply.createSession({
      userId: user.id,
      role: user.role as SessionData['role'],
    });

    await prisma.activityLog.create({
      data: { userId: user.id, action: 'کاربر ثبت‌نام کرد', target: user.username ?? user.email, type: 'signup' },
    });
    await publishRealtime({
      event: 'activity',
      data: { type: 'signup', actor: user.username ?? user.email, target: user.name, ts: new Date().toISOString() },
    }).catch(() => undefined);

    return reply.send({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        username: user.username,
        name: user.name,
        bio: user.bio,
        avatarUrl: user.avatarUrl,
        role: user.role,
        status: user.status,
        emailVerified: !!user.emailVerifiedAt,
        phoneVerified: !!user.phoneVerifiedAt,
      },
    });
  });
}
