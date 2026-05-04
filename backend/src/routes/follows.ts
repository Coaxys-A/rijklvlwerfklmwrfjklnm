import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAuth } from '../plugins/session.js';

const WRITER_ROLES = ['writer', 'editor', 'admin'];
const TOPIC_SLUGS = new Set(['ai', 'security', 'software', 'hardware', 'startups', 'data']);
const listSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(20),
});

function badInput(reply: FastifyReply) {
  return reply.code(400).send({ error: 'invalid_input' });
}

async function findWriter(username: string) {
  return prisma.user.findFirst({
    where: { username: username.toLowerCase().replace(/^@/, ''), role: { in: WRITER_ROLES as any }, status: 'active' },
    select: { id: true, username: true, name: true, avatarUrl: true, role: true },
  });
}

export default async function followRoutes(app: FastifyInstance) {
  app.get('/api/topics/:slug/followers', async (req, reply) => {
    const parsed = listSchema.safeParse(req.query);
    if (!parsed.success) return badInput(reply);
    const { slug } = req.params as { slug: string };
    if (!TOPIC_SLUGS.has(slug)) return reply.code(404).send({ error: 'not_found' });
    const { page, limit } = parsed.data;
    const [count, current] = await Promise.all([
      prisma.topicFollow.count({ where: { topic: slug } }),
      req.session
        ? prisma.topicFollow.findUnique({ where: { userId_topic: { userId: req.session.userId, topic: slug } } })
        : Promise.resolve(null),
    ]);
    return { count, following: !!current, page, limit, pages: Math.ceil(count / limit) };
  });

  app.post('/api/topics/:slug/follow', { preHandler: requireAuth() }, async (req, reply) => {
    const { slug } = req.params as { slug: string };
    if (!TOPIC_SLUGS.has(slug)) return reply.code(404).send({ error: 'not_found' });
    await prisma.topicFollow.upsert({
      where: { userId_topic: { userId: req.session!.userId, topic: slug } },
      update: {},
      create: { userId: req.session!.userId, topic: slug },
    });
    await prisma.analyticsEvent.create({
      data: { type: 'topic_followed', userId: req.session!.userId, topic: slug, metadata: { topic: slug } },
    }).catch(() => undefined);
    const count = await prisma.topicFollow.count({ where: { topic: slug } });
    return { ok: true, following: true, count };
  });

  app.delete('/api/topics/:slug/follow', { preHandler: requireAuth() }, async (req, reply) => {
    const { slug } = req.params as { slug: string };
    if (!TOPIC_SLUGS.has(slug)) return reply.code(404).send({ error: 'not_found' });
    await prisma.topicFollow.delete({
      where: { userId_topic: { userId: req.session!.userId, topic: slug } },
    }).catch(() => undefined);
    const count = await prisma.topicFollow.count({ where: { topic: slug } });
    return { ok: true, following: false, count };
  });

  app.post('/api/writers/:username/follow', { preHandler: requireAuth() }, async (req, reply) => {
    const { username } = req.params as { username: string };
    const writer = await findWriter(username);
    if (!writer) return reply.code(404).send({ error: 'not_found' });
    if (writer.id === req.session!.userId) return reply.code(400).send({ error: 'cannot_follow_self' });
    await prisma.writerFollow.upsert({
      where: { followerId_writerId: { followerId: req.session!.userId, writerId: writer.id } },
      update: {},
      create: { followerId: req.session!.userId, writerId: writer.id },
    });
    await prisma.analyticsEvent.create({
      data: { type: 'writer_followed', userId: req.session!.userId, metadata: { writerId: writer.id, username: writer.username } },
    }).catch(() => undefined);
    const count = await prisma.writerFollow.count({ where: { writerId: writer.id } });
    return { ok: true, following: true, count };
  });

  app.delete('/api/writers/:username/follow', { preHandler: requireAuth() }, async (req, reply) => {
    const { username } = req.params as { username: string };
    const writer = await findWriter(username);
    if (!writer) return reply.code(404).send({ error: 'not_found' });
    await prisma.writerFollow.delete({
      where: { followerId_writerId: { followerId: req.session!.userId, writerId: writer.id } },
    }).catch(() => undefined);
    const count = await prisma.writerFollow.count({ where: { writerId: writer.id } });
    return { ok: true, following: false, count };
  });

  app.get('/api/writers/:username/followers', async (req, reply) => {
    const parsed = listSchema.safeParse(req.query);
    if (!parsed.success) return badInput(reply);
    const { username } = req.params as { username: string };
    const writer = await findWriter(username);
    if (!writer) return reply.code(404).send({ error: 'not_found' });
    const { page, limit } = parsed.data;
    const [count, rows, current] = await Promise.all([
      prisma.writerFollow.count({ where: { writerId: writer.id } }),
      prisma.writerFollow.findMany({
        where: { writerId: writer.id },
        include: { follower: { select: { id: true, username: true, name: true, avatarUrl: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      req.session
        ? prisma.writerFollow.findUnique({ where: { followerId_writerId: { followerId: req.session.userId, writerId: writer.id } } })
        : Promise.resolve(null),
    ]);
    return {
      count,
      following: !!current,
      items: rows.map((row) => row.follower),
      page,
      limit,
      pages: Math.ceil(count / limit),
    };
  });

  app.get('/api/auth/following', { preHandler: requireAuth() }, async (req) => {
    const [writers, topics] = await Promise.all([
      prisma.writerFollow.findMany({
        where: { followerId: req.session!.userId },
        include: { writer: { select: { id: true, username: true, name: true, avatarUrl: true, role: true, bio: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.topicFollow.findMany({
        where: { userId: req.session!.userId },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    return {
      items: writers.map((row) => ({ ...row.writer, followedAt: row.createdAt.toISOString() })),
      topics: topics.map((row) => ({ topic: row.topic, followedAt: row.createdAt.toISOString() })),
    };
  });
}
