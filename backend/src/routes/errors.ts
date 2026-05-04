import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAuth } from '../plugins/session.js';

const errorSchema = z.object({
  message: z.string().trim().min(1).max(1000),
  source: z.string().trim().max(500).optional(),
  stack: z.string().trim().max(5000).optional(),
  path: z.string().trim().max(500).optional(),
  userAgent: z.string().trim().max(500).optional(),
});

function badInput(reply: FastifyReply) {
  return reply.code(400).send({ error: 'invalid_input' });
}

export default async function errorRoutes(app: FastifyInstance) {
  app.post('/api/errors', async (req, reply) => {
    const parsed = errorSchema.safeParse(req.body);
    if (!parsed.success) return badInput(reply);
    const body = parsed.data;
    req.log.error({ clientError: body }, 'client_error_reported');
    await prisma.clientError.create({
      data: {
        message: body.message,
        stack: body.stack ?? null,
        url: body.path ?? body.source ?? null,
        userAgent: body.userAgent ?? null,
        ...(req.session?.userId ? { userId: req.session.userId } : {}),
      },
    }).catch(() => undefined);
    return reply.code(202).send({ ok: true });
  });

  app.get('/api/admin/errors', { preHandler: requireAuth(['admin']) }, async (_req, _reply) => {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [topErrors, recent, dailyCounts] = await Promise.all([
      prisma.$queryRaw<Array<{ message: string; count: bigint; lastSeen: Date }>>`
        SELECT message, COUNT(*) AS count, MAX("createdAt") AS "lastSeen"
        FROM "ClientError"
        WHERE "createdAt" >= ${since}
        GROUP BY message
        ORDER BY count DESC
        LIMIT 10
      `,
      prisma.clientError.findMany({
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { id: true, message: true, url: true, userAgent: true, userId: true, createdAt: true },
      }),
      prisma.$queryRaw<Array<{ day: string; count: bigint }>>`
        SELECT DATE("createdAt") AS day, COUNT(*) AS count
        FROM "ClientError"
        WHERE "createdAt" >= ${since}
        GROUP BY day
        ORDER BY day ASC
      `,
    ]);

    return {
      topErrors: topErrors.map((r) => ({ message: r.message, count: Number(r.count), lastSeen: r.lastSeen })),
      recent,
      dailyCounts: dailyCounts.map((r) => ({ day: r.day, count: Number(r.count) })),
    };
  });
}
