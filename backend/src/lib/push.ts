import webpush from 'web-push';
import type { NotificationType } from '@prisma/client';
import { prisma } from '../db.js';

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? 'mailto:admin@teknav.ir',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
}

function buildPushPayload(type: NotificationType | string, payload: Record<string, unknown>) {
  const icon = '/icons/icon-192x192.png';
  const map: Record<string, { title: string; body: string; url: string }> = {
    new_article: {
      title: `مقاله جدید: ${payload.articleTitle ?? payload.title ?? ''}`,
      body: String(payload.excerpt ?? ''),
      url: `/article/${payload.articleSlug ?? payload.slug ?? ''}`,
    },
    comment: {
      title: 'نظر جدید روی مقاله شما',
      body: String(payload.content ?? '').slice(0, 80),
      url: `/article/${payload.articleSlug ?? ''}`,
    },
    comment_reply: {
      title: 'پاسخ به نظر شما',
      body: String(payload.content ?? '').slice(0, 80),
      url: `/article/${payload.articleSlug ?? ''}#comment-${payload.commentId ?? ''}`,
    },
    review_approved: {
      title: 'مقاله شما تأیید شد',
      body: String(payload.articleTitle ?? payload.title ?? ''),
      url: '/writer',
    },
    review_revision: {
      title: 'بازخورد ویراستار',
      body: String(payload.note ?? ''),
      url: '/writer',
    },
    review_rejected: {
      title: 'مقاله رد شد',
      body: String(payload.articleTitle ?? payload.title ?? ''),
      url: '/writer',
    },
    review_submitted: {
      title: 'مقاله جدید برای بررسی',
      body: String(payload.articleTitle ?? payload.title ?? ''),
      url: '/admin',
    },
    system: {
      title: 'تکناو',
      body: String(payload.message ?? ''),
      url: '/',
    },
  };
  const base = map[type] ?? { title: 'تکناو', body: '', url: '/' };
  return { ...base, icon };
}

async function deliverPush(
  subs: { endpoint: string; auth: string; p256dh: string }[],
  data: string,
) {
  await Promise.allSettled(
    subs.map((sub) =>
      webpush
        .sendNotification({ endpoint: sub.endpoint, keys: { auth: sub.auth, p256dh: sub.p256dh } }, data)
        .catch(async (err: { statusCode?: number }) => {
          if (err.statusCode === 410) {
            await prisma.pushSubscription.delete({ where: { endpoint: sub.endpoint } }).catch(() => {});
          }
        }),
    ),
  );
}

export async function sendPushToUser(
  userId: string,
  type: NotificationType,
  payload: Record<string, unknown>,
) {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return;

  // Check notification preference — if user has explicitly disabled push for this event, skip.
  const pref = await prisma.notificationPreference.findUnique({
    where: { userId_eventType_channel: { userId, eventType: type, channel: 'push' } },
  }).catch(() => null);
  if (pref && !pref.enabled) return;

  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  if (!subs.length) return;
  const data = JSON.stringify(buildPushPayload(type, payload));
  await deliverPush(subs, data);
}

export async function sendGuestPushByTopic(
  topic: string,
  payload: Record<string, unknown>,
) {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return;
  const subs = await prisma.pushSubscription.findMany({
    where: { userId: null, topics: { has: topic } },
  });
  if (!subs.length) return;
  const data = JSON.stringify(buildPushPayload('new_article', payload));
  await deliverPush(subs, data);
}
