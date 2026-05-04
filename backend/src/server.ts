// Fastify entry. Phase 3 wires session + CSRF + auth routes.
// Public/admin API land in Phase 4-5.

import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import { config } from './config.js';
import { prisma } from './db.js';
import { redis, connectRedis } from './redis.js';
import sessionPlugin from './plugins/session.js';
import csrfPlugin from './plugins/csrf.js';
import authRoutes from './routes/auth.js';
import signupRoutes from './routes/signup.js';
import oauthRoutes from './routes/oauth.js';
import passwordResetRoutes from './routes/password-reset.js';
import profileRoutes from './routes/profile.js';
import publicRoutes from './routes/public.js';
import adminRoutes from './routes/admin.js';
import captchaRoutes from './routes/captcha.js';
import commentRoutes from './routes/comments.js';
import historyRoutes from './routes/history.js';
import notificationRoutes from './routes/notifications.js';
import followRoutes from './routes/follows.js';
import listRoutes from './routes/lists.js';
import analyticsRoutes from './routes/analytics.js';
import adminStreamRoutes from './routes/admin-stream.js';
import qaRoutes from './routes/qa.js';
import monetizationRoutes from './routes/monetization.js';
import errorRoutes from './routes/errors.js';
import revisionRoutes from './routes/revisions.js';
import { publishVisitorCount, recordActiveVisitor } from './lib/realtime.js';

const app = Fastify({
  logger: { level: config.LOG_LEVEL },
  trustProxy: true,
  bodyLimit: 1 * 1024 * 1024, // 1 MB; uploads use a separate route in Phase 5
});

await connectRedis();

await app.register(cors, {
  origin: config.corsOrigins,
  credentials: true,
});

await app.register(cookie, {
  secret: config.SESSION_SECRET,
  hook: 'onRequest',
});

await app.register(sessionPlugin);
await app.register(csrfPlugin);
await app.register(rateLimit, {
  global: true,
  max: 600,
  timeWindow: '1 minute',
  redis,
  nameSpace: 'teknav-rate-limit:',
  allowList: ['127.0.0.1', '::1'],
  skipOnError: true,
  keyGenerator: (req) => `${req.ip}:${req.headers['user-agent'] ?? 'unknown'}`,
  errorResponseBuilder: (_req, context) => ({
    error: 'rate_limited',
    message: `Too many requests, retry in ${context.after}`,
    retryAfter: context.ttl,
  }),
});

app.addHook('onRequest', async (req) => {
  await recordActiveVisitor(req).catch((err) => req.log.warn({ err }, 'failed to record active visitor'));
});

await app.register(authRoutes);
await app.register(signupRoutes);
await app.register(oauthRoutes);
await app.register(passwordResetRoutes);
await app.register(profileRoutes);
await app.register(publicRoutes);
await app.register(commentRoutes);
await app.register(historyRoutes);
await app.register(notificationRoutes);
await app.register(followRoutes);
await app.register(listRoutes);
await app.register(analyticsRoutes);
await app.register(adminRoutes);
await app.register(adminStreamRoutes);
await app.register(captchaRoutes);
await app.register(qaRoutes);
await app.register(monetizationRoutes);
await app.register(errorRoutes);
await app.register(revisionRoutes);

app.setErrorHandler((err, req, reply) => {
  req.log.error({ err }, 'unhandled_request_error');
  reply.code(err.statusCode && err.statusCode >= 400 ? err.statusCode : 500).send({
    error: err.statusCode && err.statusCode < 500 ? err.code ?? 'request_error' : 'internal_error',
  });
});

const visitorInterval = setInterval(() => {
  publishVisitorCount().catch((err) => app.log.warn({ err }, 'failed to publish visitor count'));
}, 10_000);
app.addHook('onClose', async () => clearInterval(visitorInterval));

app.get('/api/health', async () => {
  const [pgOk, redisOk] = await Promise.all([
    prisma.$queryRaw`SELECT 1 AS ok`.then(() => true).catch(() => false),
    redis.ping().then((r: string) => r === 'PONG').catch(() => false),
  ]);
  return { ok: pgOk && redisOk, postgres: pgOk, redis: redisOk };
});

const close = async () => {
  app.log.info('shutting down');
  await app.close();
  await redis.quit();
  await prisma.$disconnect();
  process.exit(0);
};
process.on('SIGINT', close);
process.on('SIGTERM', close);

await app.listen({ host: '0.0.0.0', port: config.PORT });
