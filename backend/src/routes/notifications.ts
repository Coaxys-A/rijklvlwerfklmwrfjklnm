import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAuth } from '../plugins/session.js';
import { publicNotification, setupSse, subscribeRealtime } from '../lib/realtime.js';

const pushSubscribeSchema = z.object({
  endpoint: z.string().url(),
  auth: z.string().min(1),
  p256dh: z.string().min(1),
  userAgent: z.string().optional(),
});

const guestSubscribeSchema = z.object({
  endpoint: z.string().url(),
  auth: z.string().min(1),
  p256dh: z.string().min(1),
  topics: z.array(z.string().max(50)).min(1).max(10),
  userAgent: z.string().optional(),
});

const pushUnsubscribeSchema = z.object({
  endpoint: z.string().url(),
});

const preferencesUpdateSchema = z.array(
  z.object({
    eventType: z.string().min(1),
    channel: z.enum(['push', 'email', 'sms']),
    enabled: z.boolean(),
  }),
).max(50);

const listSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(20),
});

const ALL_EVENT_TYPES = [
  'comment', 'comment_reply', 'new_article',
  'review_approved', 'review_revision', 'review_rejected', 'review_submitted', 'system',
];
const ALL_CHANNELS = ['push', 'email', 'sms'];

function badInput(reply: FastifyReply) {
  return reply.code(400).send({ error: 'invalid_input' });
}

export default async function notificationRoutes(app: FastifyInstance) {
  app.get('/api/auth/notifications', { preHandler: requireAuth() }, async (req, reply) => {
    const parsed = listSchema.safeParse(req.query);
    if (!parsed.success) return badInput(reply);
    const { page, limit } = parsed.data;
    const [total, unread, rows] = await Promise.all([
      prisma.notification.count({ where: { userId: req.session!.userId } }),
      prisma.notification.count({ where: { userId: req.session!.userId, read: false } }),
      prisma.notification.findMany({
        where: { userId: req.session!.userId },
        orderBy: [{ read: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return { items: rows.map(publicNotification), unread, total, page, limit, pages: Math.ceil(total / limit) };
  });

  app.post('/api/auth/notifications/read-all', { preHandler: requireAuth() }, async (req) => {
    await prisma.notification.updateMany({ where: { userId: req.session!.userId, read: false }, data: { read: true } });
    return { ok: true };
  });

  app.patch('/api/auth/notifications/:id/read', { preHandler: requireAuth() }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const existing = await prisma.notification.findFirst({ where: { id, userId: req.session!.userId } });
    if (!existing) return reply.code(404).send({ error: 'not_found' });
    const row = await prisma.notification.update({ where: { id: existing.id }, data: { read: true } });
    return { notification: publicNotification(row) };
  });

  app.delete('/api/auth/notifications/:id', { preHandler: requireAuth() }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const existing = await prisma.notification.findFirst({ where: { id, userId: req.session!.userId } });
    if (!existing) return reply.code(404).send({ error: 'not_found' });
    await prisma.notification.delete({ where: { id: existing.id } });
    return { ok: true };
  });

  app.get('/api/auth/notifications/stream', { preHandler: requireAuth() }, async (req, reply) => {
    setupSse(reply);
    await subscribeRealtime(reply, (event) => event.event === 'notification' && event.userId === req.session!.userId);
    return reply;
  });

  // ── Notification Preferences ────────────────────────────────────────────────

  app.get('/api/auth/notifications/preferences', { preHandler: requireAuth() }, async (req) => {
    const userId = req.session!.userId;
    const rows = await prisma.notificationPreference.findMany({ where: { userId } });
    // Build full matrix: for each eventType+channel not in DB, default is enabled=true
    const map = new Map(rows.map((r) => [`${r.eventType}:${r.channel}`, r.enabled]));
    const preferences = ALL_EVENT_TYPES.flatMap((eventType) =>
      ALL_CHANNELS.map((channel) => ({
        eventType,
        channel,
        enabled: map.get(`${eventType}:${channel}`) ?? true,
      })),
    );
    return { preferences };
  });

  app.put('/api/auth/notifications/preferences', { preHandler: requireAuth() }, async (req, reply) => {
    const parsed = preferencesUpdateSchema.safeParse(req.body);
    if (!parsed.success) return badInput(reply);
    const userId = req.session!.userId;
    await Promise.all(
      parsed.data.map(({ eventType, channel, enabled }) =>
        prisma.notificationPreference.upsert({
          where: { userId_eventType_channel: { userId, eventType, channel } },
          create: { userId, eventType, channel, enabled },
          update: { enabled },
        }),
      ),
    );
    return { ok: true };
  });

  // ── Web Push (authenticated) ────────────────────────────────────────────────

  app.get('/api/auth/push/vapid-key', { preHandler: requireAuth() }, async (_req, reply) => {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    if (!publicKey) return reply.code(503).send({ error: 'push_not_configured' });
    return { publicKey };
  });

  app.post('/api/auth/push/subscribe', { preHandler: requireAuth() }, async (req, reply) => {
    const parsed = pushSubscribeSchema.safeParse(req.body);
    if (!parsed.success) return badInput(reply);
    const { endpoint, auth, p256dh, userAgent } = parsed.data;
    const userId = req.session!.userId;
    await prisma.pushSubscription.upsert({
      where: { endpoint },
      create: { userId, endpoint, auth, p256dh, userAgent },
      update: { auth, p256dh, userId },
    });
    return reply.code(204).send();
  });

  app.delete('/api/auth/push/unsubscribe', { preHandler: requireAuth() }, async (req, reply) => {
    const parsed = pushUnsubscribeSchema.safeParse(req.body);
    if (!parsed.success) return badInput(reply);
    await prisma.pushSubscription.deleteMany({
      where: { userId: req.session!.userId, endpoint: parsed.data.endpoint },
    });
    return reply.code(204).send();
  });

  // ── Web Push (guest / unauthenticated) ──────────────────────────────────────

  app.get('/api/push/vapid-key', async (_req, reply) => {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    if (!publicKey) return reply.code(503).send({ error: 'push_not_configured' });
    return { publicKey };
  });

  app.post('/api/push/guest-subscribe', {
    config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
  }, async (req, reply) => {
    const parsed = guestSubscribeSchema.safeParse(req.body);
    if (!parsed.success) return badInput(reply);
    const { endpoint, auth, p256dh, topics, userAgent } = parsed.data;
    // If session exists, wire to user instead
    const userId = req.session?.userId ?? null;
    await prisma.pushSubscription.upsert({
      where: { endpoint },
      create: { userId, endpoint, auth, p256dh, topics, userAgent },
      update: { auth, p256dh, topics, ...(userId ? { userId } : {}) },
    });
    return reply.code(204).send();
  });

  app.delete('/api/push/guest-unsubscribe', async (req, reply) => {
    const parsed = pushUnsubscribeSchema.safeParse(req.body);
    if (!parsed.success) return badInput(reply);
    // Delete guest subscription by endpoint; don't require auth
    await prisma.pushSubscription.deleteMany({
      where: { endpoint: parsed.data.endpoint, userId: null },
    });
    return reply.code(204).send();
  });
}
