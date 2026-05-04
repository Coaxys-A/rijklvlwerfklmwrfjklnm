import type { FastifyReply, FastifyRequest } from 'fastify';
import type { NotificationType, Prisma } from '@prisma/client';
import { redis } from '../redis.js';
import { prisma } from '../db.js';
import { sendPushToUser } from './push.js';

const REALTIME_CHANNEL = 'teknav:realtime';
const ACTIVE_GUESTS_KEY = 'visitors:guests';
const ACTIVE_USERS_KEY = 'visitors:users';
const COMMENTS_STATS_KEY = 'stats:comments';
const ACTIVE_WINDOW_MS = 5 * 60 * 1000;

export type RealtimeEvent =
  | { event: 'notification'; userId: string; data: unknown }
  | { event: 'activity'; data: unknown }
  | { event: 'visitor_update'; data: { count: number; guests: number; users: number; commentsPerMin: number } }
  | { event: 'view_update'; data: unknown };

export async function publishRealtime(event: RealtimeEvent) {
  await redis.publish(REALTIME_CHANNEL, JSON.stringify(event));
}

export async function createNotification(userId: string, type: NotificationType, payload: Prisma.InputJsonValue) {
  const row = await prisma.notification.create({ data: { userId, type, payload } });
  const data = publicNotification(row);
  await publishRealtime({ event: 'notification', userId, data });
  sendPushToUser(userId, type, payload as Record<string, unknown>).catch(() => {});
  return data;
}

export function publicNotification(row: {
  id: string;
  type: NotificationType;
  payload: Prisma.JsonValue;
  read: boolean;
  createdAt: Date;
}) {
  return {
    id: row.id,
    type: row.type,
    payload: row.payload,
    read: row.read,
    createdAt: row.createdAt.toISOString(),
  };
}

export function setupSse(reply: FastifyReply) {
  reply.hijack();
  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  reply.raw.write('retry: 5000\n\n');
}

export function writeSse(reply: FastifyReply, event: string, data: unknown) {
  reply.raw.write(`event: ${event}\n`);
  reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
}

export async function subscribeRealtime(
  reply: FastifyReply,
  filter: (event: RealtimeEvent) => boolean,
) {
  const subscriber = redis.duplicate();
  await subscriber.connect();
  await subscriber.subscribe(REALTIME_CHANNEL);
  const onMessage = (_channel: string, message: string) => {
    try {
      const event = JSON.parse(message) as RealtimeEvent;
      if (filter(event)) writeSse(reply, event.event, event.data);
    } catch {
      // Ignore malformed pub/sub payloads.
    }
  };
  subscriber.on('message', onMessage);
  const heartbeat = setInterval(() => {
    reply.raw.write(': heartbeat\n\n');
  }, 25_000);
  reply.raw.on('close', () => {
    clearInterval(heartbeat);
    subscriber.off('message', onMessage);
    subscriber.quit().catch(() => undefined);
  });
}

export async function recordActiveVisitor(req: FastifyRequest) {
  if (!req.url.startsWith('/api/') || req.url.includes('/stream')) return;
  const now = Date.now();
  if (req.session?.userId) {
    await redis.zadd(ACTIVE_USERS_KEY, now, req.session.userId.toString());
    await redis.pexpire(ACTIVE_USERS_KEY, ACTIVE_WINDOW_MS * 2);
  } else {
    const ip = req.ip || 'unknown';
    await redis.zadd(ACTIVE_GUESTS_KEY, now, ip);
    await redis.pexpire(ACTIVE_GUESTS_KEY, ACTIVE_WINDOW_MS * 2);
  }
}

export async function publishVisitorCount() {
  const now = Date.now();
  const cutoff = now - ACTIVE_WINDOW_MS;
  const commentCutoff = now - 60 * 1000;
  
  await redis.zremrangebyscore(ACTIVE_GUESTS_KEY, 0, cutoff);
  await redis.zremrangebyscore(ACTIVE_USERS_KEY, 0, cutoff);
  await redis.zremrangebyscore(COMMENTS_STATS_KEY, 0, commentCutoff);
  
  const guests = await redis.zcard(ACTIVE_GUESTS_KEY);
  const users = await redis.zcard(ACTIVE_USERS_KEY);
  const commentsPerMin = await redis.zcard(COMMENTS_STATS_KEY);
  const count = guests + users;
  
  await publishRealtime({ event: 'visitor_update', data: { count, guests, users, commentsPerMin } });
  return { count, guests, users, commentsPerMin };
}

export async function recordCommentEvent() {
  const now = Date.now();
  await redis.zadd(COMMENTS_STATS_KEY, now, `${now}-${Math.random()}`);
  await redis.pexpire(COMMENTS_STATS_KEY, 60 * 1000 * 2);
}

export async function notifyFollowersOnPublish(article: {
  id: string;
  slug: string;
  title: string;
  author: { userId: string | null; name: string };
  category?: { slug: string; name?: string } | null;
}) {
  const [writerFollows, topicFollows] = await Promise.all([
    article.author.userId
      ? prisma.writerFollow.findMany({
          where: { writerId: article.author.userId },
          select: { followerId: true },
        })
      : Promise.resolve([]),
    article.category?.slug
      ? prisma.topicFollow.findMany({
          where: { topic: article.category.slug },
          select: { userId: true },
        })
      : Promise.resolve([]),
  ]);
  const userIds = new Set([
    ...writerFollows.map((follow) => follow.followerId),
    ...topicFollows.map((follow) => follow.userId),
  ]);
  await Promise.all([...userIds].map((userId) => createNotification(userId, 'new_article', {
    articleId: article.id,
    articleSlug: article.slug,
    articleTitle: article.title,
    actorName: article.author.name,
    topic: article.category?.slug ?? null,
    topicName: article.category?.name ?? null,
  })));
}

export async function notifyEditorsOnSubmit(article: { slug: string, title: string, authorName: string }) {
  const editors = await prisma.user.findMany({
    where: { role: { in: ['admin', 'editor', 'reviewer'] } },
    select: { id: true }
  });
  await Promise.all(editors.map(e => createNotification(e.id.toString(), 'review_submitted', {
    articleSlug: article.slug,
    articleTitle: article.title,
    actorName: article.authorName,
  })));
}
