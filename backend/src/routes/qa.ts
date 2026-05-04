import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAuth } from '../plugins/session.js';

const PUBLISHED = 'منتشرشده';

const qaSchema = z.object({
  body: z.string().trim().min(1).max(1000),
});

function badInput(reply: FastifyReply) {
  return reply.code(400).send({ error: 'invalid_input' });
}

function faDate(date: Date) {
  return date.toLocaleDateString('fa-IR', { hour: '2-digit', minute: '2-digit' });
}

export default async function qaRoutes(app: FastifyInstance) {
  app.get('/api/articles/:slug/qa', async (req, reply) => {
    const { slug } = req.params as { slug: string };
    const article = await prisma.article.findFirst({
      where: { slug, status: PUBLISHED, publishedAt: { not: null } },
      select: { id: true },
    });
    if (!article) return reply.code(404).send({ error: 'not_found' });

    const rows = await prisma.question.findMany({
      where: { articleId: article.id },
      include: {
        author: { select: { id: true, name: true, username: true, avatarUrl: true } },
        answers: { include: { author: { select: { id: true, name: true, username: true, avatarUrl: true } } }, orderBy: { createdAt: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      items: rows.map(q => ({
        id: q.id,
        body: q.body,
        createdAt: q.createdAt.toISOString(),
        time: faDate(q.createdAt),
        author: q.author,
        answers: q.answers.map(a => ({
          id: a.id,
          body: a.body,
          createdAt: a.createdAt.toISOString(),
          time: faDate(a.createdAt),
          author: a.author,
        })),
      })),
    };
  });

  app.post('/api/articles/:slug/qa', { preHandler: requireAuth() }, async (req, reply) => {
    const parsed = qaSchema.safeParse(req.body);
    if (!parsed.success) return badInput(reply);
    const { slug } = req.params as { slug: string };
    const article = await prisma.article.findFirst({
      where: { slug, status: PUBLISHED, publishedAt: { not: null } },
      select: { id: true },
    });
    if (!article) return reply.code(404).send({ error: 'not_found' });

    const row = await prisma.question.create({
      data: { articleId: article.id, authorId: req.session!.userId, body: parsed.data.body },
      include: { author: { select: { id: true, name: true, username: true, avatarUrl: true } } },
    });

    return {
      id: row.id,
      body: row.body,
      createdAt: row.createdAt.toISOString(),
      time: faDate(row.createdAt),
      author: row.author,
      answers: [],
    };
  });

  app.post('/api/qa/questions/:id/answers', { preHandler: requireAuth() }, async (req, reply) => {
    const parsed = qaSchema.safeParse(req.body);
    if (!parsed.success) return badInput(reply);
    const { id } = req.params as { id: string };
    
    const question = await prisma.question.findUnique({ where: { id } });
    if (!question) return reply.code(404).send({ error: 'not_found' });

    const row = await prisma.answer.create({
      data: { questionId: id, authorId: req.session!.userId, body: parsed.data.body },
      include: { author: { select: { id: true, name: true, username: true, avatarUrl: true } } },
    });

    return {
      id: row.id,
      body: row.body,
      createdAt: row.createdAt.toISOString(),
      time: faDate(row.createdAt),
      author: row.author,
    };
  });
}
