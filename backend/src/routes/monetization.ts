import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAuth } from '../plugins/session.js';

const PUBLISHED = 'published';
const ZARINPAL_REQUEST_URL = process.env.ZARINPAL_SANDBOX === '1'
  ? 'https://sandbox.zarinpal.com/pg/v4/payment/request.json'
  : 'https://payment.zarinpal.com/pg/v4/payment/request.json';
const ZARINPAL_VERIFY_URL = process.env.ZARINPAL_SANDBOX === '1'
  ? 'https://sandbox.zarinpal.com/pg/v4/payment/verify.json'
  : 'https://payment.zarinpal.com/pg/v4/payment/verify.json';
const ZARINPAL_GATEWAY = process.env.ZARINPAL_SANDBOX === '1'
  ? 'https://sandbox.zarinpal.com/pg/StartPay'
  : 'https://www.zarinpal.com/pg/StartPay';
const MEMBERSHIP_AMOUNT = Number(process.env.MEMBERSHIP_PRICE_IRR ?? 5_000_000); // default 500,000 Tomans
const MEMBERSHIP_DAYS = Number(process.env.MEMBERSHIP_DURATION_DAYS ?? 365);

const jobSchema = z.object({
  company: z.string().trim().min(2).max(120),
  title: z.string().trim().min(3).max(160),
  location: z.string().trim().min(2).max(120).default('Remote'),
  remote: z.coerce.boolean().default(true),
  url: z.string().trim().url().max(500).optional().or(z.literal('')),
  contactEmail: z.string().trim().email().max(254).optional().or(z.literal('')),
  description: z.string().trim().min(20).max(3000),
});

function badInput(reply: FastifyReply) {
  return reply.code(400).send({ error: 'invalid_input' });
}

export default async function monetizationRoutes(app: FastifyInstance) {
  app.get('/api/jobs', async () => ({
    items: await prisma.jobListing.findMany({
      where: { status: PUBLISHED },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
  }));

  app.post('/api/jobs', async (req, reply) => {
    const parsed = jobSchema.safeParse(req.body);
    if (!parsed.success) return badInput(reply);
    const body = parsed.data;
    const job = await prisma.jobListing.create({
      data: {
        company: body.company,
        title: body.title,
        location: body.location,
        remote: body.remote,
        url: body.url || null,
        contactEmail: body.contactEmail || null,
        description: body.description,
        status: 'pending',
      },
    });
    return reply.code(201).send({ ok: true, job: { id: job.id, status: job.status } });
  });

  // Admin: list all job listings with optional status filter
  app.get('/api/admin/jobs', { preHandler: requireAuth(['admin', 'editor']) }, async (req) => {
    const { status } = req.query as { status?: string };
    const where = status ? { status } : {};
    const items = await prisma.jobListing.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return { items };
  });

  // Admin: approve/reject a job listing
  const jobModerationSchema = z.object({
    status: z.enum(['approved', 'rejected', 'pending']),
    featuredUntil: z.string().datetime().optional(),
  });

  app.patch('/api/admin/jobs/:id', { preHandler: requireAuth(['admin', 'editor']) }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = jobModerationSchema.safeParse(req.body);
    if (!parsed.success) return badInput(reply);
    const data: Record<string, unknown> = { status: parsed.data.status };
    if (parsed.data.featuredUntil) data.featuredUntil = new Date(parsed.data.featuredUntil);
    const job = await prisma.jobListing.update({ where: { id }, data }).catch(() => null);
    if (!job) return reply.code(404).send({ error: 'not_found' });
    return { ok: true, job: { id: job.id, status: job.status } };
  });

  // ── Membership subscription via Zarinpal ──────────────────────────────────
  app.post('/api/membership/subscribe', { preHandler: requireAuth() }, async (req: FastifyRequest, reply) => {
    const merchantId = process.env.ZARINPAL_MERCHANT_ID;
    if (!merchantId) return reply.code(503).send({ error: 'payment_unavailable' });

    const callbackBase = process.env.OAUTH_CALLBACK_BASE ?? 'https://www.teknav.ir';
    const callbackUrl = `${callbackBase}/api/membership/callback`;

    const zarinRes = await fetch(ZARINPAL_REQUEST_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        merchant_id: merchantId,
        amount: MEMBERSHIP_AMOUNT,
        callback_url: callbackUrl,
        description: 'عضویت پریمیوم تکناو',
        metadata: { userId: req.session!.userId },
      }),
    });
    const zarinData = await zarinRes.json() as { data?: { code?: number; authority?: string }; errors?: unknown };
    const authority = zarinData.data?.authority;
    if (!authority || zarinData.data?.code !== 100) {
      req.log.error({ zarinData }, 'zarinpal_request_failed');
      return reply.code(502).send({ error: 'payment_gateway_error' });
    }

    await prisma.membershipPayment.create({
      data: {
        userId: req.session!.userId,
        authority,
        amount: MEMBERSHIP_AMOUNT,
        durationDays: MEMBERSHIP_DAYS,
        status: 'pending',
      },
    });

    return { redirectUrl: `${ZARINPAL_GATEWAY}/${authority}` };
  });

  app.get('/api/membership/callback', async (req: FastifyRequest, reply) => {
    const { Authority, Status } = req.query as { Authority?: string; Status?: string };
    const frontendBase = process.env.OAUTH_CALLBACK_BASE ?? 'https://www.teknav.ir';

    if (!Authority || Status !== 'OK') {
      return reply.redirect(`${frontendBase}/membership?payment=cancelled`);
    }

    const payment = await prisma.membershipPayment.findUnique({ where: { authority: Authority } });
    if (!payment || payment.status !== 'pending') {
      return reply.redirect(`${frontendBase}/membership?payment=invalid`);
    }

    const merchantId = process.env.ZARINPAL_MERCHANT_ID ?? '';
    const verifyRes = await fetch(ZARINPAL_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ merchant_id: merchantId, amount: payment.amount, authority: Authority }),
    });
    const verifyData = await verifyRes.json() as { data?: { code?: number; ref_id?: number } };
    const code = verifyData.data?.code;
    if (code !== 100 && code !== 101) {
      await prisma.membershipPayment.update({ where: { authority: Authority }, data: { status: 'failed' } });
      return reply.redirect(`${frontendBase}/membership?payment=failed`);
    }

    const refId = String(verifyData.data?.ref_id ?? '');
    const expiresAt = new Date(Date.now() + payment.durationDays * 24 * 60 * 60 * 1000);

    await prisma.$transaction([
      prisma.membershipPayment.update({
        where: { authority: Authority },
        data: { status: 'paid', refId },
      }),
      prisma.user.update({
        where: { id: payment.userId },
        data: { membershipTier: 'premium', membershipExpiresAt: expiresAt },
      }),
      prisma.notification.create({
        data: {
          userId: payment.userId,
          type: 'system',
          payload: {
            title: 'عضویت ویژه فعال شد',
            body: `عضویت پریمیوم تکناو تا ${expiresAt.toLocaleDateString('fa-IR')} فعال است.`,
            refId,
          },
        },
      }),
    ]);

    return reply.redirect(`${frontendBase}/membership/success?ref=${refId}`);
  });

  app.get('/api/membership/status', { preHandler: requireAuth() }, async (req: FastifyRequest) => {
    const user = await prisma.user.findUnique({
      where: { id: req.session!.userId },
      select: { membershipTier: true, membershipExpiresAt: true },
    });
    const active = user?.membershipTier === 'premium' &&
      (!user.membershipExpiresAt || user.membershipExpiresAt > new Date());
    return {
      tier: user?.membershipTier ?? 'free',
      active,
      expiresAt: user?.membershipExpiresAt?.toISOString() ?? null,
    };
  });

  app.get('/api/courses', async () => {
    const rows = await prisma.course.findMany({
      where: { status: PUBLISHED },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    if (rows.length > 0) return { items: rows };
    return {
      items: [
        {
          id: 'course-ai-production',
          slug: 'ai-production',
          title: 'استقرار هوش مصنوعی در محصول',
          summary: 'دوره عملی طراحی، ارزیابی و انتشار قابلیت‌های AI برای تیم‌های فارسی‌زبان.',
          level: 'میانی تا پیشرفته',
          price: 0,
          status: PUBLISHED,
        },
        {
          id: 'course-security-engineering',
          slug: 'security-engineering',
          title: 'امنیت کاربردی برای تیم‌های نرم‌افزار',
          summary: 'از مدل تهدید تا امن‌سازی API، نشست‌ها، لاگ و واکنش به رخداد.',
          level: 'میانی',
          price: 0,
          status: PUBLISHED,
        },
      ],
    };
  });
}
