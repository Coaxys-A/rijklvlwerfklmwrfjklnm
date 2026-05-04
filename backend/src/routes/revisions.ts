import type { FastifyInstance, FastifyRequest } from 'fastify';
import { prisma } from '../db.js';
import { requireAuth } from '../plugins/session.js';

const EDITOR_ROLES = ['admin', 'editor'] as const;

function publicRevision(r: {
  id: string;
  articleId: string;
  savedById: string | null;
  title: string;
  summary: string;
  status: string;
  createdAt: Date;
  savedBy?: { name: string; username: string | null } | null;
}) {
  return {
    id: r.id,
    articleId: r.articleId,
    savedById: r.savedById,
    savedByName: r.savedBy?.name ?? null,
    title: r.title,
    summary: r.summary,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
  };
}

async function canAccessRevisions(req: FastifyRequest, articleId: string) {
  if (!req.session) return false;
  const { role, userId } = req.session;
  if (role === 'admin' || role === 'editor' || role === 'reviewer') return true;
  if (role === 'writer') {
    const article = await prisma.article.findUnique({ where: { id: articleId }, select: { createdById: true } });
    return article?.createdById === userId;
  }
  return false;
}

export default async function revisionRoutes(app: FastifyInstance) {
  app.get<{ Params: { id: string }; Querystring: { page?: string } }>('/api/admin/articles/:id/revisions', { preHandler: requireAuth(['admin', 'editor', 'reviewer', 'writer']) },
    async (req, reply) => {
      const { id } = req.params;
      if (!(await canAccessRevisions(req, id))) return reply.code(403).send({ error: 'forbidden' });
      const page = Math.max(1, parseInt(req.query.page ?? '1', 10));
      const limit = 20;
      const [total, rows] = await Promise.all([
        prisma.articleRevision.count({ where: { articleId: id } }),
        prisma.articleRevision.findMany({
          where: { articleId: id },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          include: { savedBy: { select: { name: true, username: true } } },
        }),
      ]);
      return { items: rows.map(publicRevision), total, page, pages: Math.ceil(total / limit) };
    },
  );

  app.get<{ Params: { id: string; revisionId: string } }>('/api/admin/articles/:id/revisions/:revisionId', { preHandler: requireAuth(['admin', 'editor', 'reviewer', 'writer']) },
    async (req, reply) => {
      const { id, revisionId } = req.params;
      if (!(await canAccessRevisions(req, id))) return reply.code(403).send({ error: 'forbidden' });
      const row = await prisma.articleRevision.findFirst({
        where: { id: revisionId, articleId: id },
        include: { savedBy: { select: { name: true, username: true } } },
      });
      if (!row) return reply.code(404).send({ error: 'not_found' });
      return { revision: { ...publicRevision(row), content: row.content } };
    },
  );

  app.post<{ Params: { id: string; revisionId: string } }>('/api/admin/articles/:id/revisions/:revisionId/restore', { preHandler: requireAuth(['admin', 'editor'] as const) },
    async (req, reply) => {
      const { id, revisionId } = req.params;
      const article = await prisma.article.findUnique({ where: { id } });
      if (!article) return reply.code(404).send({ error: 'not_found' });
      const revision = await prisma.articleRevision.findFirst({ where: { id: revisionId, articleId: id } });
      if (!revision) return reply.code(404).send({ error: 'revision_not_found' });

      // Snapshot current state before restoring
      await prisma.articleRevision.create({
        data: {
          articleId: id,
          savedById: req.session!.userId,
          title: article.title,
          content: article.content,
          summary: article.summary,
          status: article.status,
        },
      });

      await prisma.article.update({
        where: { id },
        data: { title: revision.title, content: revision.content, summary: revision.summary },
      });
      return { ok: true, restoredFrom: revisionId };
    },
  );
}
