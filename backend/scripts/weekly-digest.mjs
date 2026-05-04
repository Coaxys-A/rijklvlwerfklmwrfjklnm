import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const SITE_URL = (process.env.TEKNAV_SITE_URL || 'https://www.teknav.ir').replace(/\/$/, '');

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function strip(value) {
  return String(value ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function weekSlug(date = new Date()) {
  const day = date.toISOString().slice(0, 10);
  return `weekly-digest-${day}`;
}

async function sendEmail({ to, subject, html }) {
  if (!process.env.SMTP_HOST) {
    console.info('[weekly-digest:stub] Would send to', to, '|', subject);
    return;
  }
  const nodemailer = await import('nodemailer');
  const port = Number(process.env.SMTP_PORT ?? 587);
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
  await transport.sendMail({
    from: process.env.SMTP_FROM ?? 'no-reply@teknav.ir',
    to,
    subject,
    html,
  });
}

function digestHtml(articles, unsubscribeToken = '') {
  const unsubscribe = `${SITE_URL}/api/newsletter/unsubscribe?token=${unsubscribeToken}`;
  const cards = articles.map((article) => {
    const url = `${SITE_URL}${article.canonicalPath || `/article/${article.slug}`}`;
    return `
      <article style="border-bottom:1px solid #E4DDD2;padding:18px 0">
        <div style="font-size:12px;color:#0F6B73;font-weight:700">${esc(article.category.name)}</div>
        <h2 style="font-size:20px;line-height:1.7;margin:6px 0 8px;color:#0F2A2E">${esc(article.title)}</h2>
        <p style="font-size:14px;line-height:1.9;color:#5F6B6D;margin:0 0 10px">${esc(strip(article.metaDescription || article.summary).slice(0, 180))}</p>
        <a href="${esc(url)}" style="color:#0F6B73;font-weight:800;text-decoration:none">خواندن مقاله</a>
      </article>`;
  }).join('');
  return `
    <main dir="rtl" style="font-family:Tahoma,Vazirmatn,sans-serif;background:#FAF7F0;padding:24px;color:#0F2A2E">
      <section style="max-width:680px;margin:0 auto;background:#fff;border:1px solid #E4DDD2;border-radius:12px;padding:28px">
        <div style="font-size:13px;color:#D49A2A;font-weight:800">گزیده هفتگی تکنّاو</div>
        <h1 style="font-size:26px;margin:8px 0 10px;line-height:1.6">مقاله‌های مهم هفته</h1>
        <p style="font-size:14px;line-height:1.9;color:#5F6B6D;margin:0 0 14px">منتخبی از تازه‌ترین تحلیل‌های فناوری، داده، امنیت، نرم‌افزار و سخت‌افزار.</p>
        ${cards}
        <p style="font-size:12px;line-height:1.9;color:#667;margin-top:22px">برای لغو عضویت از خبرنامه، روی این لینک بزنید: <a href="${esc(unsubscribe)}">${esc(unsubscribe)}</a></p>
      </section>
    </main>`;
}

try {
  const now = new Date();
  const since = new Date(now);
  since.setDate(since.getDate() - 7);
  const slug = process.env.TEKNAV_DIGEST_SLUG || weekSlug(now);
  const existing = await prisma.newsletterCampaign.findUnique({ where: { slug } });
  if (existing?.sentAt) {
    console.info(`[weekly-digest] ${slug} already sent`);
    process.exit(0);
  }

  const [articles, subscribers, creator] = await Promise.all([
    prisma.article.findMany({
      where: { publishedAt: { gte: since, lte: now } },
      include: { category: true, author: true },
      orderBy: [{ featured: 'desc' }, { publishedAt: 'desc' }],
      take: 12,
    }),
    prisma.newsletterSubscriber.findMany({ orderBy: { createdAt: 'asc' } }),
    prisma.user.findFirst({ where: { role: { in: ['admin', 'editor'] } }, orderBy: { createdAt: 'asc' } }),
  ]);

  if (!creator) throw new Error('No admin/editor user exists for newsletter campaign ownership.');
  if (articles.length === 0) {
    console.info('[weekly-digest] no articles published in the last 7 days');
    process.exit(0);
  }

  const subject = `گزیده هفتگی تکنّاو - ${now.toLocaleDateString('fa-IR')}`;
  const campaign = existing ?? await prisma.newsletterCampaign.create({
    data: {
      subject,
      slug,
      bodyHtml: digestHtml(articles),
      createdById: creator.id,
    },
  });

  let sent = 0;
  for (const subscriber of subscribers) {
    await sendEmail({
      to: subscriber.email,
      subject: campaign.subject,
      html: digestHtml(articles, subscriber.unsubscribeToken),
    });
    sent += 1;
  }

  await prisma.newsletterCampaign.update({
    where: { id: campaign.id },
    data: { sentAt: new Date(), recipientCount: sent, bodyHtml: digestHtml(articles) },
  });
  await prisma.activityLog.create({
    data: { action: 'خبرنامه هفتگی ارسال شد', target: campaign.subject, type: 'newsletter', userId: creator.id },
  }).catch(() => undefined);
  console.info(`[weekly-digest] sent ${sent} email(s) for ${slug}`);
} finally {
  await prisma.$disconnect();
}
