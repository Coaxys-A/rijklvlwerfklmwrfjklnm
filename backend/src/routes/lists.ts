import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAuth } from '../plugins/session.js';

const listBodySchema = z.object({
  name: z.string().trim().min(2).max(80),
});

const itemBodySchema = z.object({
  articleId: z.string().trim().min(1),
});

const reorderBodySchema = z.object({
  itemIds: z.array(z.string().trim().min(1)).max(200),
});

function faDate(date: Date) {
  return date.toLocaleDateString('fa-IR');
}

function publicArticle(article: any) {
  const publishedAt = article.publishedAt ?? article.createdAt;
  return {
    id: article.id,
    slug: article.slug,
    title: article.title,
    summary: article.summary,
    type: article.type,
    status: article.status,
    readTime: article.readTime,
    views: article.views,
    category: article.category?.slug,
    categoryName: article.category?.name,
    authorId: article.author?.id,
    authorSlug: article.author?.slug,
    authorName: article.author?.name,
    authorUsername: article.author?.user?.username ?? null,
    date: faDate(publishedAt),
    dateEn: publishedAt.toISOString().slice(0, 10),
    tags: article.tags?.map((t: any) => t.tag.name) ?? [],
  };
}

function publicList(row: any) {
  return {
    id: row.id,
    name: row.name,
    isDefault: row.isDefault,
    createdAt: row.createdAt.toISOString(),
    items: (row.items ?? []).map((item: any) => ({
      id: item.id,
      position: item.position,
      addedAt: item.addedAt.toISOString(),
      article: publicArticle(item.article),
    })),
  };
}

async function loadList(id: string, userId: string) {
  return prisma.readingList.findFirst({
    where: { id, userId },
    include: {
      items: {
        include: {
          article: {
            include: {
              category: true,
              author: { include: { user: { select: { username: true } } } },
              tags: { include: { tag: true } },
            },
          },
        },
        orderBy: [{ position: 'asc' }, { addedAt: 'asc' }],
      },
    },
  });
}

export default async function listRoutes(app: FastifyInstance) {
  app.get('/api/auth/lists', { preHandler: requireAuth() }, async (req) => {
    const rows = await prisma.readingList.findMany({
      where: { userId: req.session!.userId },
      include: {
        items: {
          include: {
            article: {
              include: {
                category: true,
                author: { include: { user: { select: { username: true } } } },
                tags: { include: { tag: true } },
              },
            },
          },
          orderBy: [{ position: 'asc' }, { addedAt: 'asc' }],
        },
      },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
    return { items: rows.map(publicList) };
  });

  app.post('/api/auth/lists', { preHandler: requireAuth(), schema: { body: { type: 'object', additionalProperties: true } } }, async (req, reply) => {
    const parsed = listBodySchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_input' });
    const row = await prisma.readingList.create({
      data: { userId: req.session!.userId, name: parsed.data.name },
    }).catch(() => null);
    if (!row) return reply.code(409).send({ error: 'list_exists' });
    return { list: publicList({ ...row, items: [] }) };
  });

  app.delete<{ Params: { id: string } }>('/api/auth/lists/:id', { preHandler: requireAuth() }, async (req, reply) => {
    const row = await prisma.readingList.findFirst({ where: { id: req.params.id, userId: req.session!.userId } });
    if (!row) return reply.code(404).send({ error: 'not_found' });
    if (row.isDefault) return reply.code(409).send({ error: 'default_list_locked' });
    await prisma.readingList.delete({ where: { id: row.id } });
    return { ok: true };
  });

  app.post<{ Params: { id: string }; Body: unknown }>('/api/auth/lists/:id/items', { preHandler: requireAuth(), schema: { body: { type: 'object', additionalProperties: true } } }, async (req, reply) => {
    const parsed = itemBodySchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_input' });
    const list = await prisma.readingList.findFirst({ where: { id: req.params.id, userId: req.session!.userId } });
    if (!list) return reply.code(404).send({ error: 'not_found' });
    const article = await prisma.article.findUnique({ where: { id: parsed.data.articleId } });
    if (!article) return reply.code(404).send({ error: 'article_not_found' });
    const nextPosition = await prisma.readingListItem.count({ where: { listId: list.id } });
    await prisma.readingListItem.upsert({
      where: { listId_articleId: { listId: list.id, articleId: article.id } },
      update: {},
      create: { listId: list.id, articleId: article.id, position: nextPosition + 1 },
    });
    const fresh = await loadList(list.id, req.session!.userId);
    return { list: publicList(fresh) };
  });

  app.delete<{ Params: { id: string; itemId: string } }>('/api/auth/lists/:id/items/:itemId', { preHandler: requireAuth() }, async (req, reply) => {
    const list = await prisma.readingList.findFirst({ where: { id: req.params.id, userId: req.session!.userId } });
    if (!list) return reply.code(404).send({ error: 'not_found' });
    await prisma.readingListItem.deleteMany({ where: { id: req.params.itemId, listId: list.id } });
    return { ok: true };
  });

  app.put<{ Params: { id: string }; Body: unknown }>('/api/auth/lists/:id/reorder', { preHandler: requireAuth(), schema: { body: { type: 'object', additionalProperties: true } } }, async (req, reply) => {
    const parsed = reorderBodySchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_input' });
    const list = await prisma.readingList.findFirst({ where: { id: req.params.id, userId: req.session!.userId } });
    if (!list) return reply.code(404).send({ error: 'not_found' });
    await prisma.$transaction(parsed.data.itemIds.map((id, index) => (
      prisma.readingListItem.updateMany({ where: { id, listId: list.id }, data: { position: index + 1 } })
    )));
    const fresh = await loadList(list.id, req.session!.userId);
    return { list: publicList(fresh) };
  });
}
