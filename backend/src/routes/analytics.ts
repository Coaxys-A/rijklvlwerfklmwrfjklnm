import type { FastifyInstance, FastifyRequest } from 'fastify';
import { prisma } from '../db.js';
import { requireAuth } from '../plugins/session.js';

function articleWhere(userId: string) {
  return {
    OR: [
      { createdById: userId },
      { author: { userId } },
    ],
  };
}

function since30() {
  const date = new Date();
  date.setDate(date.getDate() - 29);
  date.setHours(0, 0, 0, 0);
  return date;
}

export default async function analyticsRoutes(app: FastifyInstance) {
  app.get('/api/auth/analytics/overview', { preHandler: requireAuth(['admin', 'editor', 'writer']) }, async (req) => {
    const where = articleWhere(req.session!.userId);
    const [articles, sums, comments, saved, viewsByDay] = await Promise.all([
      prisma.article.count({ where }),
      prisma.article.aggregate({ where, _sum: { views: true, reactions: true } }),
      prisma.comment.count({ where: { article: where } }),
      prisma.savedArticle.count({ where: { article: where } }),
      prisma.articleViewLog.groupBy({
        by: ['date'],
        where: { date: { gte: since30() }, article: where },
        _sum: { views: true },
        orderBy: { date: 'asc' },
      }),
    ]);
    return {
      articles,
      views: sums._sum.views ?? 0,
      reactions: sums._sum.reactions ?? 0,
      comments,
      saved,
      viewsByDay: viewsByDay.map((row) => ({ date: row.date.toISOString().slice(0, 10), views: row._sum.views ?? 0 })),
    };
  });

  app.get('/api/auth/analytics/articles', { preHandler: requireAuth(['admin', 'editor', 'writer']) }, async (req) => {
    const rows = await prisma.article.findMany({
      where: articleWhere(req.session!.userId),
      select: { id: true, slug: true, title: true, status: true, views: true, reactions: true, updatedAt: true, _count: { select: { comments: true, savedBy: true } } },
      orderBy: [{ views: 'desc' }, { updatedAt: 'desc' }],
      take: 100,
    });
    return { items: rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      status: row.status,
      views: row.views,
      reactions: row.reactions,
      comments: row._count.comments,
      saved: row._count.savedBy,
      updatedAt: row.updatedAt.toISOString(),
    })) };
  });

  app.get<{ Params: { slug: string } }>('/api/auth/analytics/article/:slug', { preHandler: requireAuth(['admin', 'editor', 'writer']) }, async (req, reply) => {
    const article = await prisma.article.findFirst({
      where: { slug: req.params.slug, ...articleWhere(req.session!.userId) },
      select: { id: true, slug: true, title: true, status: true, views: true, reactions: true, _count: { select: { comments: true, savedBy: true } } },
    });
    if (!article) return reply.code(404).send({ error: 'not_found' });
    const viewsByDay = await prisma.articleViewLog.findMany({
      where: { articleId: article.id, date: { gte: since30() } },
      orderBy: { date: 'asc' },
    });
    return {
      article: {
        id: article.id,
        slug: article.slug,
        title: article.title,
        status: article.status,
        views: article.views,
        reactions: article.reactions,
        comments: article._count.comments,
        saved: article._count.savedBy,
      },
      viewsByDay: viewsByDay.map((row) => ({ date: row.date.toISOString().slice(0, 10), views: row.views })),
    };
  });
}
