import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../plugins/session.js';
import { publishVisitorCount, setupSse, subscribeRealtime, writeSse } from '../lib/realtime.js';

export default async function adminStreamRoutes(app: FastifyInstance) {
  app.get('/api/admin/stream', { preHandler: requireAuth(['admin', 'editor']) }, async (_req, reply) => {
    setupSse(reply);
    const data = await publishVisitorCount();
    writeSse(reply, 'visitor_update', data);
    await subscribeRealtime(reply, (event) => ['visitor_update', 'activity', 'view_update'].includes(event.event));
    return reply;
  });
}
