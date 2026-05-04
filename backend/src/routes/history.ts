import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAuth } from '../plugins/session.js';
const bodySchema = z.object({
  articleId: z.string().trim().min(1),
  progress: z.number().min(0).max(1).optional(),
});

const listSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(20),
});

function badInput(reply: FastifyReply) {
  return reply.code(400).send({ error: 'invalid_input' });
}

export default async function historyRoutes(app: FastifyInstance) {
  app.post('/api/auth/history', { preHandler: requireAuth() }, async (req, reply) => {
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) return badInput(reply);
    const userId = req.session!.userId;
    const { articleId, progress = 0 } = parsed.data;
    const article = await prisma.article.findUnique({ where: { id: articleId }, select: { id: true } });
    if (!article) return reply.code(404).send({ error: 'not_found' });

    await prisma.readHistory.upsert({
      where: { userId_articleId: { userId, articleId } },
      update: { readAt: new Date(), progress: Math.max(progress, 0) },
      create: { userId, articleId, progress },
    });

    // Streak logic
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { streakCount: true, lastReadAt: true } });
    if (user) {
      const now = new Date();
      const last = user.lastReadAt;
      let newStreak = user.streakCount;

      if (!last) {
        newStreak = 1;
      } else {
        const lastDate = new Date(last);
        lastDate.setHours(0, 0, 0, 0);
        const today = new Date(now);
        today.setHours(0, 0, 0, 0);

        const diffDays = Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays === 1) {
          newStreak += 1;
        } else if (diffDays > 1) {
          newStreak = 1;
        }
      }

      if (newStreak !== user.streakCount || !user.lastReadAt || 
          new Date(user.lastReadAt).toDateString() !== now.toDateString()) {
        await prisma.user.update({
          where: { id: userId },
          data: { streakCount: newStreak, lastReadAt: now },
        });
      }
    }

    return { ok: true };
  });

  app.get('/api/auth/streaks', { preHandler: requireAuth() }, async (req) => {
    const userId = req.session!.userId;
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { streakCount: true, lastReadAt: true } });

    // Check if streak was broken today (if last read was more than 1 day ago)
    let currentStreak = user?.streakCount ?? 0;
    if (user?.lastReadAt) {
      const lastDate = new Date(user.lastReadAt);
      lastDate.setHours(0, 0, 0, 0);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const diffDays = Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays > 1) currentStreak = 0;
    }

    const unfinished = await prisma.readHistory.findMany({
      where: { userId, progress: { lt: 0.9, gt: 0.05 } },
      include: { article: { select: { id: true, slug: true, title: true, summary: true } } },
      orderBy: { readAt: 'desc' },
      take: 5,
    });

    return {
      streak: currentStreak,
      lastReadAt: user?.lastReadAt,
      continueReading: unfinished.map(h => ({
        id: h.article.id,
        slug: h.article.slug,
        title: h.article.title,
        progress: h.progress,
      })),
    };
  });

  app.get('/api/auth/history', { preHandler: requireAuth() }, async (req, reply) => {
    const parsed = listSchema.safeParse(req.query);
    if (!parsed.success) return badInput(reply);
    const { page, limit } = parsed.data;
    const userId = req.session!.userId;
    const [total, rows] = await Promise.all([
      prisma.readHistory.count({ where: { userId } }),
      prisma.readHistory.findMany({
        where: { userId },
        include: { article: { include: { category: true, author: true } } },
        orderBy: { readAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return {
      items: rows.map((row) => ({
        id: row.id,
        readAt: row.readAt.toISOString(),
        time: row.readAt.toLocaleDateString('fa-IR'),
        article: {
          id: row.article.id,
          slug: row.article.slug,
          title: row.article.title,
          summary: row.article.summary,
          categoryName: row.article.category.name,
          authorName: row.article.author.name,
          readTime: row.article.readTime,
        },
      })),
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  });

  app.delete('/api/auth/history', { preHandler: requireAuth() }, async (req) => {
    await prisma.readHistory.deleteMany({ where: { userId: req.session!.userId } });
    return { ok: true };
  });
}
