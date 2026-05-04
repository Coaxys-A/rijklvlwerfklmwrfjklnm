import type { FastifyInstance, FastifyReply } from 'fastify';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAuth, type SessionData } from '../plugins/session.js';
import { createNotification, publishRealtime, recordCommentEvent } from '../lib/realtime.js';

const PUBLISHED = 'منتشرشده';
const COMMENT_FLAG_THRESHOLD = 5;
const EDITOR_ROLES: SessionData['role'][] = ['admin', 'editor'];
const CONTENT_ROLES: SessionData['role'][] = ['admin', 'editor', 'writer'];

const listSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(20),
  flagged: z.coerce.boolean().optional(),
});

const commentBodySchema = z.object({
  body: z.string().trim().min(1).max(1000),
  replyToId: z.string().trim().optional(),
});

const bulkSchema = z.object({
  ids: z.array(z.string().trim().min(1)).min(1).max(100),
  action: z.enum(['approve', 'reject', 'delete']),
});

function badInput(reply: FastifyReply) {
  return reply.code(400).send({ error: 'invalid_input' });
}

function stripHtml(input: string) {
  return input.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

function faDate(date: Date) {
  return date.toLocaleDateString('fa-IR', { hour: '2-digit', minute: '2-digit' });
}

function publicComment(row: Prisma.CommentGetPayload<{ include: { author: true; likes: true; upvotes: true; replies: { include: { author: true; likes: true; upvotes: true } } } }>, viewerId?: string) {
  return {
    id: row.id,
    body: row.body,
    likeCount: row.likeCount,
    likedByMe: viewerId ? row.likes.some((like) => like.userId === viewerId) : false,
    upvoteCount: row.upvoteCount,
    upvotedByMe: viewerId ? row.upvotes.some((uv) => uv.userId === viewerId) : false,
    flagCount: row.flagCount,
    flagged: row.flagged,
    replyToId: row.replyToId,
    createdAt: row.createdAt.toISOString(),
    time: faDate(row.createdAt),
    author: {
      id: row.author.id,
      name: row.author.name,
      username: row.author.username,
      avatarUrl: row.author.avatarUrl,
      role: row.author.role,
    },
    replies: row.replies.map((reply) => ({
      id: reply.id,
      body: reply.body,
      likeCount: reply.likeCount,
      likedByMe: viewerId ? reply.likes.some((like) => like.userId === viewerId) : false,
      upvoteCount: reply.upvoteCount,
      upvotedByMe: viewerId ? reply.upvotes.some((uv) => uv.userId === viewerId) : false,
      flagCount: reply.flagCount,
      flagged: reply.flagged,
      replyToId: reply.replyToId,
      createdAt: reply.createdAt.toISOString(),
      time: faDate(reply.createdAt),
      author: {
        id: reply.author.id,
        name: reply.author.name,
        username: reply.author.username,
        avatarUrl: reply.author.avatarUrl,
        role: reply.author.role,
      },
    })),
  };
}

async function canDeleteComment(session: SessionData, commentId: string) {
  if (session.role === 'admin' || session.role === 'editor') return true;
  if (session.role !== 'writer') return false;
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { article: { select: { createdById: true, author: { select: { userId: true } } } } },
  });
  return comment?.article.createdById === session.userId || comment?.article.author.userId === session.userId;
}

export default async function commentRoutes(app: FastifyInstance) {
  app.get('/api/articles/:slug/comments', async (req, reply) => {
    const parsed = listSchema.safeParse(req.query);
    if (!parsed.success) return badInput(reply);
    const { slug } = req.params as { slug: string };
    const { page, limit } = parsed.data;
    const article = await prisma.article.findFirst({
      where: { slug, status: PUBLISHED, publishedAt: { not: null } },
      select: { id: true },
    });
    if (!article) return reply.code(404).send({ error: 'not_found' });
    const where = { articleId: article.id, replyToId: null } satisfies Prisma.CommentWhereInput;
    const [total, rows] = await Promise.all([
      prisma.comment.count({ where: { articleId: article.id } }),
      prisma.comment.findMany({
        where,
        include: {
          author: true,
          likes: true,
          upvotes: true,
          replies: {
            include: { author: true, likes: true, upvotes: true },
            orderBy: [{ upvoteCount: 'desc' }, { createdAt: 'asc' }],
          },
        },
        orderBy: [{ upvoteCount: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return { items: rows.map((row) => publicComment(row, req.session?.userId)), total, page, limit, pages: Math.ceil(total / limit) };
  });

  app.post('/api/articles/:slug/comments', { preHandler: requireAuth() }, async (req, reply) => {
    const parsed = commentBodySchema.safeParse(req.body);
    if (!parsed.success) return badInput(reply);
    const { slug } = req.params as { slug: string };
    const body = stripHtml(parsed.data.body);
    if (!body) return badInput(reply);
    const article = await prisma.article.findFirst({
      where: { slug, status: PUBLISHED, publishedAt: { not: null } },
      include: { author: { select: { userId: true, name: true } } },
    });
    if (!article) return reply.code(404).send({ error: 'not_found' });
    const parent = parsed.data.replyToId
      ? await prisma.comment.findFirst({ where: { id: parsed.data.replyToId, articleId: article.id }, include: { author: true } })
      : null;
    if (parsed.data.replyToId && !parent) return reply.code(404).send({ error: 'reply_not_found' });

    const row = await prisma.comment.create({
      data: { articleId: article.id, authorId: req.session!.userId, replyToId: parent?.id ?? null, body },
      include: {
        author: true,
        likes: true,
        upvotes: true,
        replies: { include: { author: true, likes: true, upvotes: true } },
      },
    });
    const actor = row.author;
    const payload = {
      articleId: article.id,
      articleSlug: article.slug,
      articleTitle: article.title,
      actorName: actor.name,
      actorUsername: actor.username,
      commentId: row.id,
    };
    if (parent && parent.authorId !== req.session!.userId) {
      await createNotification(parent.authorId, 'comment_reply', payload);
    } else if (article.author.userId && article.author.userId !== req.session!.userId) {
      await createNotification(article.author.userId, 'comment', payload);
    }
    await prisma.activityLog.create({
      data: { userId: req.session!.userId, action: 'نظر ثبت شد', target: article.title, type: 'comment' },
    });
    await publishRealtime({ event: 'activity', data: { type: 'comment', actor: actor.username ?? actor.name, target: article.slug, ts: new Date().toISOString() } });
    await recordCommentEvent();
    return { comment: publicComment(row, req.session!.userId) };
  });

  app.post('/api/comments/:id/like', { preHandler: requireAuth() }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const comment = await prisma.comment.findUnique({ where: { id }, select: { id: true } });
    if (!comment) return reply.code(404).send({ error: 'not_found' });
    const key = { commentId_userId: { commentId: id, userId: req.session!.userId } };
    const existing = await prisma.commentLike.findUnique({ where: key });
    if (existing) await prisma.commentLike.delete({ where: key });
    else await prisma.commentLike.create({ data: { commentId: id, userId: req.session!.userId } });
    const likeCount = await prisma.commentLike.count({ where: { commentId: id } });
    await prisma.comment.update({ where: { id }, data: { likeCount } });
    return { ok: true, liked: !existing, likeCount };
  });

  app.post('/api/comments/:id/upvote', { preHandler: requireAuth() }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const comment = await prisma.comment.findUnique({ where: { id }, select: { id: true } });
    if (!comment) return reply.code(404).send({ error: 'not_found' });
    const key = { commentId_userId: { commentId: id, userId: req.session!.userId } };
    const existing = await prisma.commentUpvote.findUnique({ where: key });
    if (existing) await prisma.commentUpvote.delete({ where: key });
    else await prisma.commentUpvote.create({ data: { commentId: id, userId: req.session!.userId } });
    const upvoteCount = await prisma.commentUpvote.count({ where: { commentId: id } });
    await prisma.comment.update({ where: { id }, data: { upvoteCount } });
    return { ok: true, upvoted: !existing, upvoteCount };
  });

  app.post('/api/comments/:id/flag', { preHandler: requireAuth() }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const comment = await prisma.comment.findUnique({ where: { id } });
    if (!comment) return reply.code(404).send({ error: 'not_found' });
    const created = await prisma.commentFlag.create({
      data: { commentId: comment.id, userId: req.session!.userId },
    }).then(() => true).catch((e: any) => {
      if (e?.code === 'P2002') return false;
      throw e;
    });
    if (!created) return { ok: true, alreadyFlagged: true, flagCount: comment.flagCount, flagged: comment.flagged };
    const flagCount = await prisma.commentFlag.count({ where: { commentId: comment.id } });
    const updated = await prisma.comment.update({
      where: { id: comment.id },
      data: { flagCount, flagged: flagCount >= COMMENT_FLAG_THRESHOLD },
    });
    return { ok: true, alreadyFlagged: false, flagCount: updated.flagCount, flagged: updated.flagged };
  });

  app.get('/api/admin/comments', { preHandler: requireAuth(CONTENT_ROLES) }, async (req, reply) => {
    const parsed = listSchema.safeParse(req.query);
    if (!parsed.success) return badInput(reply);
    const { page, limit, flagged } = parsed.data;
    const where: Prisma.CommentWhereInput = {
      ...(flagged !== undefined ? { flagged } : {}),
      ...(req.session!.role === 'writer' ? {
        article: { OR: [{ createdById: req.session!.userId }, { author: { userId: req.session!.userId } }] },
      } : {}),
    };
    const [total, rows] = await Promise.all([
      prisma.comment.count({ where }),
      prisma.comment.findMany({
        where,
        include: { author: true, article: { select: { title: true, slug: true } } },
        orderBy: [{ flagged: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return {
      items: rows.map((row) => ({
        id: row.id,
        body: row.body,
        flagCount: row.flagCount,
        flagged: row.flagged,
        createdAt: row.createdAt.toISOString(),
        time: faDate(row.createdAt),
        articleTitle: row.article.title,
        articleSlug: row.article.slug,
        authorName: row.author.name,
        authorUsername: row.author.username,
      })),
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  });

  app.delete('/api/admin/comments/:id', { preHandler: requireAuth(CONTENT_ROLES) }, async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!(await canDeleteComment(req.session!, id))) return reply.code(403).send({ error: 'forbidden' });
    const row = await prisma.comment.delete({ where: { id } }).catch(() => null);
    if (!row) return reply.code(404).send({ error: 'not_found' });
    return { ok: true };
  });

  app.post('/api/admin/comments/bulk', { preHandler: requireAuth(CONTENT_ROLES) }, async (req, reply) => {
    const parsed = bulkSchema.safeParse(req.body);
    if (!parsed.success) return badInput(reply);
    const ids = [...new Set(parsed.data.ids)];
    const allowed = [];
    for (const id of ids) {
      if (await canDeleteComment(req.session!, id)) allowed.push(id);
    }
    if (allowed.length === 0) return reply.code(403).send({ error: 'forbidden' });
    if (parsed.data.action === 'approve') {
      const result = await prisma.comment.updateMany({
        where: { id: { in: allowed } },
        data: { flagged: false, flagCount: 0 },
      });
      await prisma.commentFlag.deleteMany({ where: { commentId: { in: allowed } } });
      return { ok: true, updated: result.count, deleted: 0 };
    }
    const result = await prisma.comment.deleteMany({ where: { id: { in: allowed } } });
    return { ok: true, updated: 0, deleted: result.count };
  });

  app.put('/api/admin/comments/:id/unflag', { preHandler: requireAuth(EDITOR_ROLES) }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const row = await prisma.comment.update({
      where: { id },
      data: { flagged: false, flagCount: 0, flags: { deleteMany: {} } },
    }).catch(() => null);
    if (!row) return reply.code(404).send({ error: 'not_found' });
    return { ok: true };
  });

  app.delete('/api/admin/comments', { preHandler: requireAuth(EDITOR_ROLES) }, async (_req, _reply) => {
    const { count } = await prisma.comment.deleteMany({ where: { flagged: true } });
    return { ok: true, deleted: count };
  });
}
