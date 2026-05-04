// Password reset — forgot + reset flows.
// Emails are sent via the email stub (console log until SMTP is configured).
// OTP phone flow uses src/lib/otp.ts (SMS stub until provider is configured).

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { randomBytes } from 'node:crypto';
import * as argon2 from '@node-rs/argon2';
import { prisma } from '../db.js';
import { redis } from '../redis.js';
import { sendEmail } from '../lib/email.js';
import { issueOtp, verifyOtp } from '../lib/otp.js';
import { requireAuth } from '../plugins/session.js';

const RESET_TTL_SECONDS = 60 * 60; // 1 hour
const resetKey = (token: string) => `pwreset:${token}`;
const emailVerifyKey = (token: string) => `emailverify:${token}`;

async function hash(password: string) {
  return argon2.hash(password, {
    algorithm: argon2.Algorithm.Argon2id,
    memoryCost: 19 * 1024,
    timeCost: 2,
    parallelism: 1,
  });
}

export default async function passwordResetRoutes(app: FastifyInstance) {
  // 1. Request a reset link by email
  app.post('/api/auth/forgot-password', async (req, reply) => {
    const parsed = z.object({ email: z.string().email().max(254).toLowerCase() }).safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_input' });

    // Always return success to avoid email enumeration.
    const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (user && user.status === 'active') {
      const token = randomBytes(32).toString('hex');
      await redis.set(resetKey(token), user.id, 'EX', RESET_TTL_SECONDS);
      const resetUrl = `${process.env.OAUTH_CALLBACK_BASE || 'https://teknav.ir'}/#/reset-password?token=${token}`;
      await sendEmail({
        to: user.email,
        subject: 'بازیابی رمز عبور تکناو',
        html: `<div dir="rtl" style="font-family:sans-serif;max-width:480px;margin:0 auto">
          <h2>بازیابی رمز عبور</h2>
          <p>سلام ${user.name}،</p>
          <p>برای تنظیم رمز عبور جدید روی دکمه زیر کلیک کنید. این لینک یک ساعت معتبر است.</p>
          <a href="${resetUrl}" style="display:inline-block;background:#0F6B73;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;margin:16px 0">تنظیم رمز عبور جدید</a>
          <p style="font-size:12px;color:#666">اگر این درخواست از طرف شما نیست، این ایمیل را نادیده بگیرید.</p>
        </div>`,
      });
    }

    return reply.send({ ok: true });
  });

  // 2. Set a new password using the token
  app.post('/api/auth/reset-password', async (req, reply) => {
    const parsed = z.object({
      token: z.string().min(1),
      password: z.string().min(8).max(256),
    }).safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_input' });

    const userId = await redis.get(resetKey(parsed.data.token));
    if (!userId) return reply.code(400).send({ error: 'token_invalid_or_expired' });

    const passwordHash = await hash(parsed.data.password);
    await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    await redis.del(resetKey(parsed.data.token));

    return reply.send({ ok: true });
  });

  app.post('/api/auth/email/verify/request', { preHandler: requireAuth() }, async (req, reply) => {
    const user = await prisma.user.findUnique({ where: { id: req.session!.userId } });
    if (!user?.email) return reply.code(400).send({ error: 'email_required' });
    if (user.emailVerifiedAt) return reply.send({ ok: true, alreadyVerified: true });

    const token = randomBytes(32).toString('hex');
    await redis.set(emailVerifyKey(token), user.id, 'EX', RESET_TTL_SECONDS);
    const verifyUrl = `${process.env.OAUTH_CALLBACK_BASE || 'https://www.teknav.ir'}/login?verifyEmail=${token}`;
    await sendEmail({
      to: user.email,
      subject: 'تایید ایمیل تکناو',
      html: `<div dir="rtl" style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2>تایید ایمیل</h2>
        <p>سلام ${user.name}،</p>
        <p>برای تایید ایمیل حساب تکناو روی دکمه زیر کلیک کنید. این لینک یک ساعت معتبر است.</p>
        <a href="${verifyUrl}" style="display:inline-block;background:#0F6B73;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;margin:16px 0">تایید ایمیل</a>
      </div>`,
    });
    return reply.send({ ok: true });
  });

  app.post('/api/auth/email/verify/confirm', { preHandler: requireAuth() }, async (req, reply) => {
    const parsed = z.object({ token: z.string().min(1) }).safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_input' });
    const userId = await redis.get(emailVerifyKey(parsed.data.token));
    if (!userId || userId !== req.session!.userId) return reply.code(400).send({ error: 'token_invalid_or_expired' });
    await prisma.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } });
    await redis.del(emailVerifyKey(parsed.data.token));
    return reply.send({ ok: true });
  });

  // 3. Send OTP to a phone number
  app.post('/api/auth/otp/send', async (req, reply) => {
    const parsed = z.object({
      phone: z.string().trim().regex(/^\+?[0-9]{8,15}$/),
    }).safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_phone' });

    // Rate limit: 5 OTPs per phone per 10 min
    const rl = `otp:rl:${parsed.data.phone}`;
    const hits = await redis.incr(rl);
    if (hits === 1) await redis.expire(rl, 600);
    if (hits > 5) return reply.code(429).send({ error: 'too_many_otp_requests' });

    const result = await issueOtp(parsed.data.phone);
    if (!result.sent) return reply.code(503).send({ error: result.reason, provider: result.provider });
    return reply.send({ ok: true, provider: result.provider });
  });

  // 4. Verify OTP (used for phone verification after signup)
  app.post('/api/auth/otp/verify', async (req, reply) => {
    if (!req.session) return reply.code(401).send({ error: 'unauthenticated' });
    const parsed = z.object({
      phone: z.string().trim().regex(/^\+?[0-9]{8,15}$/),
      code: z.string().length(6).regex(/^[0-9]{6}$/),
    }).safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_input' });

    const valid = await verifyOtp(parsed.data.phone, parsed.data.code);
    if (!valid) return reply.code(400).send({ error: 'invalid_otp' });

    await prisma.user.update({ where: { id: req.session.userId }, data: { phone: parsed.data.phone, phoneVerifiedAt: new Date() } });
    return reply.send({ ok: true });
  });
}
