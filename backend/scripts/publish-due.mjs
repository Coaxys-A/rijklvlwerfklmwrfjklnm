import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import webpush from 'web-push';

const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 2 });
const PUBLISHED = 'منتشرشده';
const SCHEDULED = 'زمان‌بندی‌شده';

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? 'mailto:admin@teknav.ir',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
}

async function bust(pattern) {
  let cursor = '0';
  do {
    const [next, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
    cursor = next;
    if (keys.length > 0) await redis.del(...keys);
  } while (cursor !== '0');
}

async function sendGuestPush(topic, payload) {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return;
  const subs = await prisma.pushSubscription.findMany({
    where: { userId: null, topics: { has: topic } },
  });
  if (!subs.length) return;
  const data = JSON.stringify({
    title: `مقاله جدید: ${payload.articleTitle}`,
    body: '',
    url: `/article/${payload.articleSlug}`,
    icon: '/icons/icon-192x192.png',
  });
  await Promise.allSettled(
    subs.map((sub) =>
      webpush
        .sendNotification({ endpoint: sub.endpoint, keys: { auth: sub.auth, p256dh: sub.p256dh } }, data)
        .catch(async (err) => {
          if (err.statusCode === 410) {
            await prisma.pushSubscription.delete({ where: { endpoint: sub.endpoint } }).catch(() => {});
          }
        }),
    ),
  );
}

// Badge types: awarded based on cumulative reading in a topic
const BADGE_RULES = [
  { badgeType: 'ai_enthusiast', topic: 'ai', minArticles: 10 },
  { badgeType: 'security_expert', topic: 'security', minArticles: 10 },
  { badgeType: 'data_scientist', topic: 'data', minArticles: 10 },
  { badgeType: 'hardware_geek', topic: 'hardware', minArticles: 10 },
  { badgeType: 'software_craftsman', topic: 'software', minArticles: 10 },
  { badgeType: 'startup_explorer', topic: 'startups', minArticles: 10 },
  { badgeType: 'streak_7', topic: null, minStreak: 7 },
  { badgeType: 'streak_30', topic: null, minStreak: 30 },
];

async function evaluateBadges() {
  // Topic-based badges: count unique articles read per category slug
  for (const rule of BADGE_RULES) {
    if (rule.topic) {
      // Find users who have read >= minArticles articles in this topic
      const category = await prisma.category.findUnique({ where: { slug: rule.topic }, select: { id: true } });
      if (!category) continue;
      const eligible = await prisma.readHistory.groupBy({
        by: ['userId'],
        where: { article: { categoryId: category.id } },
        _count: { articleId: true },
        having: { articleId: { _count: { gte: rule.minArticles } } },
      });
      for (const row of eligible) {
        await prisma.userBadge.upsert({
          where: { userId_badgeType: { userId: row.userId, badgeType: rule.badgeType } },
          create: { userId: row.userId, badgeType: rule.badgeType, metadata: { topic: rule.topic, count: row._count.articleId } },
          update: { metadata: { topic: rule.topic, count: row._count.articleId } },
        }).catch(() => {});
      }
    } else if (rule.minStreak) {
      // Streak-based badges
      const eligible = await prisma.user.findMany({
        where: { streakCount: { gte: rule.minStreak } },
        select: { id: true, streakCount: true },
      });
      for (const user of eligible) {
        await prisma.userBadge.upsert({
          where: { userId_badgeType: { userId: user.id, badgeType: rule.badgeType } },
          create: { userId: user.id, badgeType: rule.badgeType, metadata: { streak: user.streakCount } },
          update: { metadata: { streak: user.streakCount } },
        }).catch(() => {});
      }
    }
  }
}

try {
  await redis.connect();
  const now = new Date();
  const due = await prisma.article.findMany({
    where: { status: SCHEDULED, scheduledAt: { lte: now } },
    include: {
      author: { select: { userId: true, name: true } },
      category: { select: { slug: true } },
    },
  });

  if (due.length > 0) {
    await prisma.article.updateMany({
      where: { id: { in: due.map((article) => article.id) } },
      data: { status: PUBLISHED, publishedAt: now },
    });
    await prisma.activityLog.createMany({
      data: due.map((article) => ({
        action: 'مقاله زمان‌بندی‌شده منتشر شد',
        target: article.title,
        type: 'publish',
      })),
    });
    for (const article of due) {
      await redis.publish('teknav:realtime', JSON.stringify({
        event: 'activity',
        data: { type: 'publish', actor: 'system', target: article.title, ts: now.toISOString() },
      }));

      const notifyUser = async (userId) => {
        const notification = await prisma.notification.create({
          data: {
            userId,
            type: 'new_article',
            payload: {
              articleId: article.id,
              articleSlug: article.slug,
              articleTitle: article.title,
              actorName: article.author.name,
            },
          },
        });
        await redis.publish('teknav:realtime', JSON.stringify({
          event: 'notification',
          userId,
          data: {
            id: notification.id,
            type: notification.type,
            payload: notification.payload,
            read: notification.read,
            createdAt: notification.createdAt.toISOString(),
          },
        }));
      };

      const notifiedUserIds = new Set();

      // Notify writer followers
      if (article.author.userId) {
        const writerFollows = await prisma.writerFollow.findMany({
          where: { writerId: article.author.userId },
          select: { followerId: true },
        });
        for (const follow of writerFollows) {
          await notifyUser(follow.followerId);
          notifiedUserIds.add(follow.followerId);
        }
      }

      // Notify topic followers (skip users already notified as writer followers)
      if (article.category?.slug) {
        const topicFollows = await prisma.topicFollow.findMany({
          where: { topic: article.category.slug },
          select: { userId: true },
        });
        for (const follow of topicFollows) {
          if (notifiedUserIds.has(follow.userId)) continue;
          await notifyUser(follow.userId);
        }

        // Fan out to guest push subscriptions for this topic
        await sendGuestPush(article.category.slug, {
          articleId: article.id,
          articleSlug: article.slug,
          articleTitle: article.title,
        });
      }
    }
    await Promise.all(['articles:*', 'search:*', 'categories:*', 'tags:*', 'authors:*'].map(bust));
  }

  // Run badge evaluation on every publish-due tick
  await evaluateBadges();

  console.info(`[publish-due] published ${due.length} article(s)`);
} finally {
  await redis.quit().catch(() => undefined);
  await prisma.$disconnect();
}
