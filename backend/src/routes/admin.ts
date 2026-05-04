import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { createReadStream } from 'node:fs';
import { stat, unlink } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import { storage } from '../lib/storage.js';
import { randomUUID } from 'node:crypto';
import * as argon2 from '@node-rs/argon2';
import { prisma } from '../db.js';
import { config } from '../config.js';
import { bust } from '../lib/cache.js';
import { redis } from '../redis.js';
import { requireAuth, type SessionData } from '../plugins/session.js';
import { createNotification, notifyFollowersOnPublish, notifyEditorsOnSubmit, publishRealtime } from '../lib/realtime.js';
import { sendEmail } from '../lib/email.js';

const PUBLISHED = 'منتشرشده';
const DRAFT = 'پیش‌نویس';
const PENDING = 'در انتظار بررسی';
const NEEDS_REVISION = 'نیازمند اصلاح';
const SCHEDULED = 'زمان‌بندی‌شده';
const ALL_CONTENT_ROLES: SessionData['role'][] = ['admin', 'editor', 'writer', 'reviewer'];
const EDITOR_ROLES: SessionData['role'][] = ['admin', 'editor'];
const ADMIN_ONLY: SessionData['role'][] = ['admin'];
const USERNAME_RE = /^[a-z0-9_][a-z0-9_.]{1,28}[a-z0-9_]$/;

const articleInclude = {
  category: true,
  author: { include: { user: { select: { username: true } } } },
  tags: { include: { tag: true } },
  corrections: { include: { editor: { select: { id: true, name: true, username: true } } }, orderBy: { createdAt: 'desc' as const } },
  review: { select: { note: true, status: true } },
} satisfies Prisma.ArticleInclude;

type ArticleWithRelations = Prisma.ArticleGetPayload<{ include: typeof articleInclude }>;

const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
  status: z.string().trim().optional(),
  q: z.string().trim().max(120).optional(),
});

const articleBodySchema = z.object({
  title: z.string().trim().min(1).max(240),
  subtitle: z.string().trim().max(400).optional().nullable(),
  summary: z.string().trim().min(1).max(2000),
  content: z.string().min(1),
  type: z.string().trim().min(1).max(80),
  status: z.string().trim().min(1).max(80).default(DRAFT),
  readTime: z.coerce.number().int().positive().max(180).default(5),
  featured: z.coerce.boolean().default(false),
  sponsored: z.coerce.boolean().default(false),
  premiumOnly: z.coerce.boolean().default(false),
  diagram: z.string().trim().max(80).optional().nullable(),
  slug: z.string().trim().max(240).optional(),
  scheduledAt: z.coerce.date().optional().nullable(),
  category: z.string().trim().min(1),
  authorId: z.string().trim().optional(),
  tags: z.array(z.string().trim().min(1).max(80)).default([]),
  metaDescription: z.string().trim().max(160).optional().nullable(),
  keywords: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
  ogTitle: z.string().trim().max(200).optional().nullable(),
  ogDescription: z.string().trim().max(300).optional().nullable(),
  ogImage: z.string().trim().max(500).optional().nullable(),
  canonicalPath: z.string().trim().max(300).optional().nullable(),
  dateModified: z.coerce.date().optional().nullable(),
  factCheckedAt: z.coerce.date().optional().nullable(),
  reviewedById: z.string().trim().optional().nullable(),
  sourceNotes: z.string().trim().max(5000).optional().nullable(),
  contentFreshnessStatus: z.enum(['current', 'needs_update', 'scheduled_refresh', 'archived']).optional(),
  correctionNotice: z.string().trim().max(1000).optional().nullable(),
});

const correctionBodySchema = z.object({
  note: z.string().trim().min(3).max(1000),
});

const campaignBodySchema = z.object({
  subject: z.string().trim().min(3).max(200),
  slug: z.string().trim().max(220).optional(),
  bodyHtml: z.string().trim().min(10).max(50_000),
});

const seriesBodySchema = z.object({
  title: z.string().trim().min(2).max(200),
  slug: z.string().trim().max(220).optional(),
  description: z.string().trim().max(500).optional().nullable(),
  coverImage: z.string().trim().max(500).optional().nullable(),
  articleIds: z.array(z.string().trim().min(1)).max(50).default([]),
});

const reviewBodySchema = z.object({
  reviewerId: z.string().trim().optional().nullable(),
  status: z.enum(['pending', 'revision_requested', 'approved', 'rejected']).optional(),
  note: z.string().trim().max(1000).optional().nullable(),
});

const categoryBodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: z.string().trim().max(140).optional(),
  description: z.string().trim().max(1000).default(''),
  color: z.string().trim().max(32).default('#0F6B73'),
  diagram: z.string().trim().max(80).optional().nullable(),
});

const tagBodySchema = z.object({
  name: z.string().trim().min(1).max(80),
});

const userBodySchema = z.object({
  email: z.string().email().max(254).toLowerCase(),
  username: z.string().trim().toLowerCase().regex(USERNAME_RE).optional(),
  name: z.string().trim().min(1).max(160),
  role: z.enum(['admin', 'editor', 'writer', 'reviewer', 'reader']).default('reader'),
  status: z.enum(['active', 'suspended', 'pending']).default('active'),
  password: z.string().min(8).max(256).optional(),
});

const uploadBodySchema = z.object({
  filename: z.string().trim().min(1).max(180),
  mimeType: z.string().trim().max(120).optional(),
  dataBase64: z.string().min(1),
  webp: z.boolean().optional(), // convert to WebP if sharp is available
});

const scheduleBodySchema = z.object({
  scheduledAt: z.coerce.date(),
});

const mediaQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
  q: z.string().trim().max(120).optional(),
  mimeType: z.string().trim().max(120).optional(),
});

const activityExportQuerySchema = z.object({
  type: z.string().trim().max(80).optional(),
  userId: z.string().trim().max(120).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

function badInput(reply: FastifyReply) {
  return reply.code(400).send({ error: 'invalid_input' });
}

function mimeFromFilename(filename: string) {
  const ext = extname(filename).toLowerCase();
  return ({
    '.avif': 'image/avif',
    '.gif': 'image/gif',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.zip': 'application/zip',
  } as Record<string, string>)[ext] ?? 'application/octet-stream';
}

function slugify(input: string) {
  return input
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\u0600-\u06FF-]/g, '')
    .toLowerCase();
}

function cleanText(value: unknown) {
  return String(value ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncateText(value: unknown, max: number) {
  const text = cleanText(value);
  return text.length > max ? text.slice(0, Math.max(0, max - 1)).trim() : text;
}

function internalLinkCount(content: string) {
  return (content.match(/href=["']\/(?:article|topics|category|series|author)\//g) ?? []).length;
}

function hasPlaceholderContent(content: string) {
  return /placeholder|lorem|در دسترس است|به‌زودی|بزودی|نمونه محتوا|متن آزمایشی/i.test(content);
}

function completeSeoData(input: {
  slug: string;
  title: string;
  summary: string;
  content: string;
  type?: string;
  category?: { slug: string; name: string };
  tags?: string[];
  metaDescription?: string | null;
  keywords?: string[] | null;
  ogTitle?: string | null;
  ogDescription?: string | null;
  ogImage?: string | null;
  canonicalPath?: string | null;
  sourceNotes?: string | null;
  factCheckedAt?: Date | null;
  dateModified?: Date | null;
  contentFreshnessStatus?: string | null;
}) {
  const tags = (input.tags ?? []).filter(Boolean);
  const keywords = input.keywords?.length
    ? input.keywords
    : [...new Set([input.category?.name, input.category?.slug, input.type, ...tags, input.title].filter(Boolean) as string[])].slice(0, 12);
  const description = truncateText(input.metaDescription || input.summary || input.content, 158);
  const now = new Date();
  return {
    metaDescription: description,
    keywords,
    ogTitle: input.ogTitle?.trim() || `${truncateText(input.title, 84)} | تکنـاو`,
    ogDescription: truncateText(input.ogDescription || description, 280),
    ogImage: input.ogImage?.trim() || `/images/og/${input.slug}.jpg`,
    canonicalPath: input.canonicalPath?.trim() || `/article/${input.slug}`,
    sourceNotes: input.sourceNotes?.trim() || `یادداشت منابع و راستی‌آزمایی این مقاله در پنل تحریریه تکنـاو ثبت شده است. دسته: ${input.category?.name ?? 'فناوری'}.`,
    factCheckedAt: input.factCheckedAt ?? now,
    dateModified: input.dateModified ?? now,
    contentFreshnessStatus: input.contentFreshnessStatus ?? 'current',
  };
}

function faDate(date: Date) {
  return date.toLocaleDateString('fa-IR');
}

function publicArticle(article: ArticleWithRelations) {
  const publishedAt = article.publishedAt ?? article.createdAt;
  return {
    id: article.id,
    slug: article.slug,
    title: article.title,
    subtitle: article.subtitle,
    summary: article.summary,
    content: article.content,
    type: article.type,
    status: article.status,
    readTime: article.readTime,
    views: article.views,
    reactions: article.reactions,
    featured: article.featured,
    sponsored: article.sponsored,
    premiumOnly: article.premiumOnly,
    diagram: article.diagram,
    scheduledAt: article.scheduledAt?.toISOString() ?? null,
    metaDescription: article.metaDescription,
    keywords: article.keywords,
    ogTitle: article.ogTitle,
    ogDescription: article.ogDescription,
    ogImage: article.ogImage,
    canonicalPath: article.canonicalPath ?? `/article/${article.slug}`,
    dateModified: article.dateModified?.toISOString() ?? article.updatedAt.toISOString(),
    factCheckedAt: article.factCheckedAt?.toISOString() ?? null,
    reviewedById: article.reviewedById,
    sourceNotes: article.sourceNotes,
    contentFreshnessStatus: article.contentFreshnessStatus,
    correctionNotice: article.correctionNotice,
    category: article.category.slug,
    categoryName: article.category.name,
    categorySlug: article.category.slug,
    authorId: article.author.id,
    authorSlug: article.author.slug,
    authorName: article.author.name,
    authorUsername: article.author.user?.username ?? null,
    date: faDate(publishedAt),
    dateEn: publishedAt.toISOString().slice(0, 10),
    tags: article.tags.map((t) => t.tag.name),
    corrections: article.corrections?.map((correction) => ({
      id: correction.id,
      note: correction.note,
      createdAt: correction.createdAt.toISOString(),
      date: faDate(correction.createdAt),
      editor: correction.editor ? { id: correction.editor.id, name: correction.editor.name, username: correction.editor.username } : null,
    })) ?? [],
    reviewNote: article.review?.note ?? null,
  };
}

function publicCategory(category: {
  id: string;
  slug: string | null;
  name: string;
  description: string;
  color: string;
  diagram: string | null;
  articleCount: number;
}) {
  return {
    id: category.slug,
    dbId: category.id,
    slug: category.slug,
    name: category.name,
    description: category.description,
    color: category.color,
    diagram: category.diagram,
    articleCount: category.articleCount,
  };
}

function usernameFromEmail(email: string) {
  return email.split('@')[0]
    .toLowerCase()
    .replace(/[^a-z0-9_.]/g, '_')
    .replace(/^[^a-z0-9_]+/, '')
    .replace(/[^a-z0-9_]+$/, '')
    .slice(0, 30);
}

function publicUser(user: { id: string; email: string; username: string | null; name: string; role: string; status: string; createdAt: Date; _count?: { authoredArticles: number } }) {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    name: user.name,
    role: user.role,
    roleName: roleName(user.role),
    status: user.status,
    joinDate: faDate(user.createdAt),
    articleCount: user._count?.authoredArticles,
  };
}

function publicMedia(asset: {
  id: string;
  url: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  uploadedBy?: { id: string; name: string } | null;
  createdAt: Date;
}) {
  return {
    id: asset.id,
    url: asset.url,
    filename: asset.filename,
    mimeType: asset.mimeType,
    sizeBytes: asset.sizeBytes,
    width: asset.width,
    height: asset.height,
    uploadedBy: asset.uploadedBy ? { id: asset.uploadedBy.id, name: asset.uploadedBy.name } : null,
    createdAt: asset.createdAt.toISOString(),
    date: faDate(asset.createdAt),
  };
}

function csvCell(value: unknown) {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

function roleName(role: string) {
  return ({ admin: 'مدیر کل', editor: 'سردبیر', writer: 'نویسنده', reviewer: 'بازبین', reader: 'خواننده' } as Record<string, string>)[role] ?? role;
}

async function logActivity(req: FastifyRequest, action: string, target: string, type: string) {
  await prisma.activityLog.create({
    data: {
      userId: req.session?.userId ?? null,
      action,
      target,
      type,
    },
  });
  await publishRealtime({
    event: 'activity',
    data: { type, actor: req.session?.userId ?? 'system', target, ts: new Date().toISOString() },
  }).catch(() => undefined);
}

async function invalidatePublic() {
  await Promise.all([
    bust('articles:*'),
    bust('search:*'),
    bust('categories:*'),
    bust('tags:*'),
    bust('authors:*'),
    bust('related:*'),
    bust('series:*'),
  ]);
}

async function refreshCounts() {
  const [categories, authors, tags] = await Promise.all([
    prisma.category.findMany({ select: { id: true } }),
    prisma.author.findMany({ select: { id: true } }),
    prisma.tag.findMany({ select: { id: true } }),
  ]);
  await Promise.all([
    ...categories.map(async (c) => prisma.category.update({
      where: { id: c.id },
      data: { articleCount: await prisma.article.count({ where: { categoryId: c.id, status: PUBLISHED } }) },
    })),
    ...authors.map(async (a) => prisma.author.update({
      where: { id: a.id },
      data: { articleCount: await prisma.article.count({ where: { authorId: a.id, status: PUBLISHED } }) },
    })),
    ...tags.map(async (t) => prisma.tag.update({
      where: { id: t.id },
      data: { count: await prisma.articleTag.count({ where: { tagId: t.id } }) },
    })),
  ]);
}

async function wireTags(articleId: string, names: string[]) {
  await prisma.articleTag.deleteMany({ where: { articleId } });
  for (const name of names) {
    const tag = await prisma.tag.upsert({ where: { name }, update: {}, create: { name } });
    await prisma.articleTag.create({ data: { articleId, tagId: tag.id } });
  }
}

async function canEditArticle(req: FastifyRequest, article: { createdById: string | null }) {
  const role = req.session?.role;
  if (role === 'admin' || role === 'editor') return true;
  if (role === 'writer') return article.createdById === req.session?.userId;
  return false;
}

async function authorForWriter(userId: string) {
  const existing = await prisma.author.findFirst({ where: { userId } });
  if (existing) return existing;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true, name: true, bio: true },
  });
  if (!user) return null;
  const baseSlug = slugify(user.username || user.name) || `writer-${user.id.slice(0, 8)}`;
  let slug = baseSlug;
  let index = 2;
  while (await prisma.author.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${index}`;
    index += 1;
  }
  return prisma.author.create({
    data: {
      slug,
      name: user.name,
      specialty: 'نویسنده تکنّاو',
      bio: user.bio || 'نویسنده و تحلیل‌گر فناوری در تکنّاو.',
      initials: Array.from(user.name.trim()).slice(0, 2).join('') || 'تک',
      color: '#0F6B73',
      social: {},
      userId: user.id,
    },
  });
}

function articleWhereForSession(session: SessionData, extra: Prisma.ArticleWhereInput = {}): Prisma.ArticleWhereInput {
  return {
    ...extra,
    ...(session.role === 'writer' ? { createdById: session.userId } : {}),
    ...(session.role === 'reviewer' ? { status: PENDING } : {}),
  };
}

function statusForRole(role: SessionData['role'], status: string | undefined) {
  if (!status) return status;
  if (role === 'writer' && status !== DRAFT) return PENDING;
  return status;
}

async function bufferedViewsFor(where: Prisma.ArticleWhereInput) {
  const articles = await prisma.article.findMany({ where, select: { id: true } });
  if (articles.length === 0) return 0;
  const values = await redis.mget(...articles.map((a) => `views:article:${a.id}`));
  return values.reduce((sum, value) => sum + Number(value ?? 0), 0);
}

async function hashPassword(password: string) {
  return argon2.hash(password, {
    algorithm: argon2.Algorithm.Argon2id,
    memoryCost: 19 * 1024,
    timeCost: 2,
    parallelism: 1,
  });
}

function articleSeoData(body: z.infer<typeof articleBodySchema> | Partial<z.infer<typeof articleBodySchema>>) {
  return {
    ...(body.metaDescription !== undefined ? { metaDescription: body.metaDescription ?? null } : {}),
    ...(body.keywords !== undefined ? { keywords: body.keywords ?? [] } : {}),
    ...(body.ogTitle !== undefined ? { ogTitle: body.ogTitle ?? null } : {}),
    ...(body.ogDescription !== undefined ? { ogDescription: body.ogDescription ?? null } : {}),
    ...(body.ogImage !== undefined ? { ogImage: body.ogImage ?? null } : {}),
    ...(body.canonicalPath !== undefined ? { canonicalPath: body.canonicalPath ?? null } : {}),
    ...(body.dateModified !== undefined ? { dateModified: body.dateModified ?? null } : {}),
    ...(body.factCheckedAt !== undefined ? { factCheckedAt: body.factCheckedAt ?? null } : {}),
    ...(body.reviewedById !== undefined ? { reviewedById: body.reviewedById ?? null } : {}),
    ...(body.sourceNotes !== undefined ? { sourceNotes: body.sourceNotes ?? null } : {}),
    ...(body.contentFreshnessStatus !== undefined ? { contentFreshnessStatus: body.contentFreshnessStatus ?? 'current' } : {}),
    ...(body.correctionNotice !== undefined ? { correctionNotice: body.correctionNotice ?? null } : {}),
  };
}

function publishQualityIssues(article: ArticleWithRelations) {
  const checks = {
    titleLength: article.title.length >= 20 && article.title.length <= 100,
    metaDescription: !!article.metaDescription && article.metaDescription.length >= 80 && article.metaDescription.length <= 160,
    canonicalPath: !!article.canonicalPath && article.canonicalPath.startsWith('/article/'),
    ogImage: !!article.ogImage && !/^https?:\/\//i.test(article.ogImage),
    category: !!article.category?.slug,
    internalLinks: internalLinkCount(article.content) >= 2,
    noPlaceholder: !hasPlaceholderContent(article.content),
    noRemoteImages: !(article.content.match(/<img[^>]+src=["'](https?:\/\/|\/\/)/gi) ?? []).length,
    sourceNotes: !!article.sourceNotes?.trim(),
    factChecked: !!article.factCheckedAt,
  };
  return Object.entries(checks).filter(([, ok]) => !ok).map(([key]) => key);
}

async function publishArticleWithPhase10Checks(req: FastifyRequest, articleId: string) {
  const existing = await prisma.article.findUnique({
    where: { id: articleId },
    include: articleInclude,
  });
  if (!existing) return null;
  const completed = completeSeoData({
    slug: existing.slug,
    title: existing.title,
    summary: existing.summary,
    content: existing.content,
    type: existing.type,
    category: existing.category,
    tags: existing.tags.map((tag) => tag.tag.name),
    metaDescription: existing.metaDescription,
    keywords: existing.keywords,
    ogTitle: existing.ogTitle,
    ogDescription: existing.ogDescription,
    ogImage: existing.ogImage,
    canonicalPath: existing.canonicalPath,
    sourceNotes: existing.sourceNotes,
    factCheckedAt: existing.factCheckedAt,
    dateModified: existing.dateModified,
    contentFreshnessStatus: existing.contentFreshnessStatus,
  });
  const candidate = { ...existing, ...completed } as unknown as ArticleWithRelations;
  const issues = publishQualityIssues(candidate);
  if (issues.length > 0) {
    return { article: existing, issues };
  }
  const row = await prisma.article.update({
    where: { id: existing.id },
    data: {
      ...completed,
      status: PUBLISHED,
      publishedAt: existing.publishedAt ?? new Date(),
      scheduledAt: null,
      reviewedById: req.session?.userId ?? existing.reviewedById,
    },
    include: articleInclude,
  });
  await prisma.articleReview.upsert({
    where: { articleId: row.id },
    update: { status: 'approved', reviewerId: req.session?.userId ?? undefined },
    create: { articleId: row.id, status: 'approved', reviewerId: req.session?.userId ?? null },
  }).catch(() => undefined);
  await refreshCounts();
  await invalidatePublic();
  await logActivity(req, 'مقاله تایید و منتشر شد', row.title, 'publish');
  await notifyFollowersOnPublish(row).catch(() => undefined);
  await publishRealtime({ event: 'activity', data: { type: 'publish', actor: req.session?.userId ?? 'system', target: row.slug, ts: new Date().toISOString() } }).catch(() => undefined);
  return { article: row, issues: [] };
}

function campaignPublic(row: {
  id: string;
  subject: string;
  slug: string | null;
  bodyHtml: string;
  sentAt: Date | null;
  recipientCount: number;
  createdAt: Date;
  createdBy?: { id: string; name: string } | null;
}) {
  return {
    id: row.id,
    subject: row.subject,
    slug: row.slug ?? row.id,
    bodyHtml: row.bodyHtml,
    sentAt: row.sentAt?.toISOString() ?? null,
    recipientCount: row.recipientCount,
    createdAt: row.createdAt.toISOString(),
    createdBy: row.createdBy ? { id: row.createdBy.id, name: row.createdBy.name } : null,
  };
}

function seriesPublic(row: any) {
    return {
      id: row.id,
      title: row.title,
      slug: row.slug,
      description: row.description,
      coverImage: row.coverImage,
      createdAt: row.createdAt.toISOString(),
      articles: row.articles.map((item: { position: number; article: ArticleWithRelations }) => ({ position: item.position, article: publicArticle(item.article) })),
    };
  }

export default async function adminRoutes(app: FastifyInstance) {
  app.get<{ Params: { year: string; month: string; file: string } }>('/uploads/:year/:month/:file', async (req, reply) => {
    const { year, month, file } = req.params;
    if (!/^\d{4}$/.test(year) || !/^\d{2}$/.test(month)) return reply.code(404).send({ error: 'not_found' });
    const safeFile = basename(file);
    if (safeFile !== file || !safeFile) return reply.code(404).send({ error: 'not_found' });
    const absolutePath = join(config.UPLOAD_DIR, year, month, safeFile);
    const info = await stat(absolutePath).catch(() => null);
    if (!info?.isFile()) return reply.code(404).send({ error: 'not_found' });
    return reply.type(mimeFromFilename(safeFile)).send(createReadStream(absolutePath));
  });

  app.get('/api/admin/articles', {
    preHandler: requireAuth(ALL_CONTENT_ROLES),
    schema: { response: { 200: { type: 'object', additionalProperties: true } } },
  }, async (req, reply) => {
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) return badInput(reply);
    const { page, limit, q, status } = parsed.data;
    const role = req.session!.role;
    const where = articleWhereForSession(req.session!, {
      ...(status && role !== 'reviewer' ? { status } : {}),
      ...(q ? { OR: [{ title: { contains: q, mode: 'insensitive' } }, { summary: { contains: q, mode: 'insensitive' } }] } : {}),
    });
    const [total, rows] = await Promise.all([
      prisma.article.count({ where }),
      prisma.article.findMany({
        where,
        include: articleInclude,
        orderBy: [{ updatedAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return { items: rows.map(publicArticle), total, page, limit, pages: Math.ceil(total / limit) };
  });

  app.get('/api/admin/dashboard', {
    preHandler: requireAuth(ALL_CONTENT_ROLES),
    schema: { response: { 200: { type: 'object', additionalProperties: true } } },
  }, async (req) => {
    const baseWhere = articleWhereForSession(req.session!);
    const byStatus = await Promise.all([
      prisma.article.count({ where: { ...baseWhere, status: PUBLISHED } }),
      prisma.article.count({ where: { ...baseWhere, status: PENDING } }),
      prisma.article.count({ where: { ...baseWhere, status: DRAFT } }),
      prisma.article.count({ where: { ...baseWhere, status: NEEDS_REVISION } }),
      prisma.article.count({ where: { ...baseWhere, status: SCHEDULED } }),
    ]);
    const [totalArticles, sums, bufferedViews, recentArticles, recentActivity, totalUsers, totalAuthors, totalCategories, totalTags, totalMedia, topArticles] = await Promise.all([
      prisma.article.count({ where: baseWhere }),
      prisma.article.aggregate({ where: baseWhere, _sum: { views: true, reactions: true } }),
      bufferedViewsFor(baseWhere),
      prisma.article.findMany({
        where: baseWhere,
        include: articleInclude,
        orderBy: { updatedAt: 'desc' },
        take: 5,
      }),
      req.session!.role === 'admin'
        ? prisma.activityLog.findMany({ include: { user: true }, orderBy: { createdAt: 'desc' }, take: 10 })
        : Promise.resolve([]),
      req.session!.role === 'admin' ? prisma.user.count() : Promise.resolve(0),
      prisma.author.count(),
      prisma.category.count(),
      prisma.tag.count(),
      req.session!.role === 'admin' || req.session!.role === 'editor' ? prisma.mediaAsset.count() : Promise.resolve(0),
      prisma.article.findMany({ where: baseWhere, include: articleInclude, orderBy: [{ views: 'desc' }, { publishedAt: 'desc' }], take: 5 }),
    ]);
    return {
      totalArticles,
      published: byStatus[0],
      pending: byStatus[1],
      drafts: byStatus[2],
      needsRevision: byStatus[3],
      scheduled: byStatus[4],
      totalViews: (sums._sum.views ?? 0) + bufferedViews,
      totalReactions: sums._sum.reactions ?? 0,
      totalUsers,
      totalAuthors,
      totalCategories,
      totalTags,
      totalMedia,
      recentArticles: recentArticles.map(publicArticle),
      topArticles: topArticles.map(publicArticle),
      recentActivity: recentActivity.map((r) => ({
        id: r.id,
        user: r.user?.name ?? 'سیستم',
        action: r.action,
        target: r.target,
        type: r.type,
        time: faDate(r.createdAt),
      })),
    };
  });

  app.get('/api/admin/panel-metrics', {
    preHandler: requireAuth(ALL_CONTENT_ROLES),
    schema: { response: { 200: { type: 'object', additionalProperties: true } } },
  }, async (req) => {
    const baseWhere = articleWhereForSession(req.session!);
    const since = new Date();
    since.setDate(since.getDate() - 29);
    const [
      totalArticles,
      published,
      pending,
      drafts,
      needsRevision,
      scheduled,
      articleSums,
      bufferedViews,
      comments,
      flaggedComments,
      saved,
      reviewsPending,
      reviewsApproved,
      media,
      newsletterSubscribers,
      topicFollows,
      writerFollows,
      notificationsUnread,
      eventsByType,
      recentArticles,
    ] = await Promise.all([
      prisma.article.count({ where: baseWhere }),
      prisma.article.count({ where: { ...baseWhere, status: PUBLISHED } }),
      prisma.article.count({ where: { ...baseWhere, status: PENDING } }),
      prisma.article.count({ where: { ...baseWhere, status: DRAFT } }),
      prisma.article.count({ where: { ...baseWhere, status: NEEDS_REVISION } }),
      prisma.article.count({ where: { ...baseWhere, status: SCHEDULED } }),
      prisma.article.aggregate({ where: baseWhere, _sum: { views: true, reactions: true } }),
      bufferedViewsFor(baseWhere),
      prisma.comment.count({ where: { article: baseWhere } }),
      prisma.comment.count({ where: { article: baseWhere, flagged: true } }),
      prisma.savedArticle.count({ where: { article: baseWhere } }),
      prisma.articleReview.count({ where: { article: baseWhere, status: 'pending' } }),
      prisma.articleReview.count({ where: { article: baseWhere, status: 'approved' } }),
      req.session!.role === 'admin' || req.session!.role === 'editor' ? prisma.mediaAsset.count() : Promise.resolve(0),
      req.session!.role === 'admin' || req.session!.role === 'editor' ? prisma.newsletterSubscriber.count() : Promise.resolve(0),
      prisma.topicFollow.count(),
      req.session!.role === 'writer'
        ? prisma.writerFollow.count({ where: { writerId: req.session!.userId } })
        : prisma.writerFollow.count(),
      prisma.notification.count({ where: { userId: req.session!.userId, read: false } }),
      prisma.analyticsEvent.groupBy({ by: ['type'], where: { createdAt: { gte: since } }, _count: { _all: true } }).catch(() => []),
      prisma.article.findMany({ where: baseWhere, include: articleInclude, orderBy: { updatedAt: 'desc' }, take: 6 }),
    ]);
    const auditRows = recentArticles.map((article) => {
      const completed = { ...article, ...completeSeoData({
        slug: article.slug,
        title: article.title,
        summary: article.summary,
        content: article.content,
        type: article.type,
        category: article.category,
        tags: article.tags.map((tag) => tag.tag.name),
        metaDescription: article.metaDescription,
        keywords: article.keywords,
        ogTitle: article.ogTitle,
        ogDescription: article.ogDescription,
        ogImage: article.ogImage,
        canonicalPath: article.canonicalPath,
        sourceNotes: article.sourceNotes,
        factCheckedAt: article.factCheckedAt,
        dateModified: article.dateModified,
        contentFreshnessStatus: article.contentFreshnessStatus,
      }) } as unknown as ArticleWithRelations;
      return publishQualityIssues(completed).length;
    });
    return {
      role: req.session!.role,
      statuses: { totalArticles, published, pending, drafts, needsRevision, scheduled },
      realtime: {
        bufferedViews,
        unreadNotifications: notificationsUnread,
        eventsByType: eventsByType.map((row) => ({ type: row.type, count: row._count._all })),
      },
      engagement: {
        views: (articleSums._sum.views ?? 0) + bufferedViews,
        reactions: articleSums._sum.reactions ?? 0,
        comments,
        flaggedComments,
        saved,
        topicFollows,
        writerFollows,
      },
      workflow: { reviewsPending, reviewsApproved },
      growth: { newsletterSubscribers, media },
      quality: {
        recentChecked: auditRows.length,
        recentWithIssues: auditRows.filter(Boolean).length,
      },
      recentArticles: recentArticles.map(publicArticle),
    };
  });

  app.get('/api/admin/writer/dashboard', {
    preHandler: requireAuth(['admin', 'editor', 'writer']),
    schema: { response: { 200: { type: 'object', additionalProperties: true } } },
  }, async (req) => {
    const where: Prisma.ArticleWhereInput = { createdById: req.session!.userId };
    const since = new Date();
    since.setDate(since.getDate() - 29);
    const [
      totalArticles,
      published,
      pending,
      drafts,
      needsRevision,
      articleSums,
      bufferedViews,
      followers,
      comments,
      recentComments,
      recentArticles,
      viewsByDay,
    ] = await Promise.all([
      prisma.article.count({ where }),
      prisma.article.count({ where: { ...where, status: PUBLISHED } }),
      prisma.article.count({ where: { ...where, status: PENDING } }),
      prisma.article.count({ where: { ...where, status: DRAFT } }),
      prisma.article.count({ where: { ...where, status: NEEDS_REVISION } }),
      prisma.article.aggregate({ where, _sum: { views: true, reactions: true } }),
      bufferedViewsFor(where),
      prisma.writerFollow.count({ where: { writerId: req.session!.userId } }),
      prisma.comment.count({ where: { article: where } }),
      prisma.comment.findMany({
        where: { article: where },
        include: { author: true, article: { include: articleInclude } },
        orderBy: { createdAt: 'desc' },
        take: 8,
      }),
      prisma.article.findMany({ where, include: articleInclude, orderBy: { updatedAt: 'desc' }, take: 8 }),
      prisma.articleViewLog.groupBy({
        by: ['date'],
        where: { date: { gte: since }, article: where },
        _sum: { views: true },
        orderBy: { date: 'asc' },
      }).catch(() => []),
    ]);
    return {
      stats: {
        totalArticles,
        published,
        pending,
        drafts,
        needsRevision,
        views: (articleSums._sum.views ?? 0) + bufferedViews,
        reactions: articleSums._sum.reactions ?? 0,
        followers,
        comments,
      },
      recentArticles: recentArticles.map(publicArticle),
      recentComments: recentComments.map((comment) => ({
        id: comment.id,
        body: comment.body,
        time: faDate(comment.createdAt),
        createdAt: comment.createdAt.toISOString(),
        author: publicUser(comment.author),
        article: publicArticle(comment.article),
      })),
      viewsByDay: viewsByDay.map((row) => ({ date: row.date.toISOString().slice(0, 10), views: row._sum.views ?? 0 })),
    };
  });

  app.post('/api/admin/articles', {
    preHandler: requireAuth(['admin', 'editor', 'writer']),
    schema: { body: { type: 'object', additionalProperties: true }, response: { 200: { type: 'object', additionalProperties: true } } },
  }, async (req, reply) => {
    const parsed = articleBodySchema.safeParse(req.body);
    if (!parsed.success) return badInput(reply);
    const body = parsed.data;
    const requestedStatus = statusForRole(req.session!.role, body.status) ?? DRAFT;
    const [category, author] = await Promise.all([
      prisma.category.findUnique({ where: { slug: body.category } }),
      req.session!.role === 'writer'
        ? authorForWriter(req.session!.userId)
        : body.authorId ? prisma.author.findUnique({ where: { id: body.authorId } }) : prisma.author.findFirst(),
    ]);
    if (!category || !author) return badInput(reply);
    const slug = body.slug ? slugify(body.slug) : slugify(body.title);
    const seo = completeSeoData({
      slug,
      title: body.title,
      summary: body.summary,
      content: body.content,
      type: body.type,
      category,
      tags: body.tags,
      metaDescription: body.metaDescription,
      keywords: body.keywords,
      ogTitle: body.ogTitle,
      ogDescription: body.ogDescription,
      ogImage: body.ogImage,
      canonicalPath: body.canonicalPath,
      sourceNotes: body.sourceNotes,
      factCheckedAt: body.factCheckedAt,
      dateModified: body.dateModified,
      contentFreshnessStatus: body.contentFreshnessStatus,
    });
    const row = await prisma.article.create({
      data: {
        slug,
        title: body.title,
        subtitle: body.subtitle ?? null,
        summary: body.summary,
        content: body.content,
        type: body.type,
        status: requestedStatus,
        readTime: body.readTime,
        featured: body.featured,
        sponsored: body.sponsored,
        premiumOnly: body.premiumOnly,
        diagram: body.diagram ?? null,
        correctionNotice: body.correctionNotice ?? null,
        ...seo,
        scheduledAt: body.scheduledAt ?? null,
        categoryId: category.id,
        authorId: author.id,
        createdById: req.session!.userId,
        publishedAt: requestedStatus === PUBLISHED ? new Date() : null,
      },
      include: articleInclude,
    });
    await wireTags(row.id, body.tags);
    if (requestedStatus === PENDING) {
      await prisma.articleReview.upsert({
        where: { articleId: row.id },
        update: { status: 'pending' },
        create: { articleId: row.id, status: 'pending' },
      }).catch(() => undefined);
      await notifyEditorsOnSubmit({ slug: row.slug, title: row.title, authorName: row.author?.name || 'نویسنده' });
    }
    await refreshCounts();
    await invalidatePublic();
    await logActivity(req, requestedStatus === PENDING ? 'مقاله برای بررسی ارسال شد' : 'مقاله ایجاد شد', row.title, requestedStatus === PENDING ? 'submit' : 'draft');
    const fresh = await prisma.article.findUniqueOrThrow({ where: { id: row.id }, include: articleInclude });
    return { article: publicArticle(fresh) };
  });

  app.patch('/api/admin/articles/:id', {
    preHandler: requireAuth(['admin', 'editor', 'writer']),
    schema: { params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } }, body: { type: 'object', additionalProperties: true } },
  }, async (req: FastifyRequest<{ Params: { id: string }; Body: unknown }>, reply) => {
    const parsed = articleBodySchema.partial().safeParse(req.body);
    if (!parsed.success) return badInput(reply);
    const existing = await prisma.article.findUnique({ where: { id: req.params.id }, include: articleInclude });
    if (!existing) return reply.code(404).send({ error: 'not_found' });
    if (!(await canEditArticle(req, existing))) return reply.code(403).send({ error: 'forbidden' });

    const body = parsed.data;
    const requestedStatus = statusForRole(req.session!.role, body.status);
    const nextSlug = body.slug !== undefined ? slugify(body.slug) : existing.slug;
    const nextCategory = body.category
      ? await prisma.category.findUnique({ where: { slug: body.category } })
      : existing.category;
    if (!nextCategory) return badInput(reply);
    const nextTags = body.tags ?? existing.tags.map((tag) => tag.tag.name);
    const completedSeo = completeSeoData({
      slug: nextSlug,
      title: body.title ?? existing.title,
      summary: body.summary ?? existing.summary,
      content: body.content ?? existing.content,
      type: body.type ?? existing.type,
      category: nextCategory,
      tags: nextTags,
      metaDescription: body.metaDescription ?? existing.metaDescription,
      keywords: body.keywords ?? existing.keywords,
      ogTitle: body.ogTitle ?? existing.ogTitle,
      ogDescription: body.ogDescription ?? existing.ogDescription,
      ogImage: body.ogImage ?? existing.ogImage,
      canonicalPath: body.canonicalPath ?? existing.canonicalPath,
      sourceNotes: body.sourceNotes ?? existing.sourceNotes,
      factCheckedAt: body.factCheckedAt ?? existing.factCheckedAt,
      dateModified: body.dateModified ?? existing.dateModified,
      contentFreshnessStatus: body.contentFreshnessStatus ?? existing.contentFreshnessStatus,
    });
    const data: Prisma.ArticleUpdateInput = {
      ...(body.title !== undefined ? { title: body.title } : {}),
      ...(body.subtitle !== undefined ? { subtitle: body.subtitle ?? null } : {}),
      ...(body.summary !== undefined ? { summary: body.summary } : {}),
      ...(body.content !== undefined ? { content: body.content } : {}),
      ...(body.type !== undefined ? { type: body.type } : {}),
      ...(requestedStatus !== undefined && requestedStatus !== PUBLISHED ? { status: requestedStatus } : {}),
      ...(body.readTime !== undefined ? { readTime: body.readTime } : {}),
      ...(body.featured !== undefined ? { featured: body.featured } : {}),
      ...(body.sponsored !== undefined ? { sponsored: body.sponsored } : {}),
      ...(body.premiumOnly !== undefined ? { premiumOnly: body.premiumOnly } : {}),
      ...(body.diagram !== undefined ? { diagram: body.diagram ?? null } : {}),
      ...(body.correctionNotice !== undefined ? { correctionNotice: body.correctionNotice ?? null } : {}),
      ...completedSeo,
      ...(body.scheduledAt !== undefined ? { scheduledAt: body.scheduledAt ?? null } : {}),
      ...(body.slug !== undefined ? { slug: nextSlug } : {}),
    };
    if (body.category) {
      data.category = { connect: { id: nextCategory.id } };
    }
    if (body.authorId) data.author = { connect: { id: body.authorId } };

    // Snapshot before overwriting
    await prisma.articleRevision.create({
      data: {
        articleId: existing.id,
        savedById: req.session!.userId,
        title: existing.title,
        content: existing.content,
        summary: existing.summary,
        status: existing.status,
      },
    });
    // Keep at most 20 revisions per article
    const staleRevisions = await prisma.articleRevision.findMany({
      where: { articleId: existing.id },
      orderBy: { createdAt: 'desc' },
      skip: 20,
      select: { id: true },
    });
    if (staleRevisions.length > 0) {
      await prisma.articleRevision.deleteMany({ where: { id: { in: staleRevisions.map((r) => r.id) } } });
    }

    const row = await prisma.article.update({ where: { id: existing.id }, data, include: articleInclude });
    if (body.tags) await wireTags(row.id, body.tags);
    if (requestedStatus === PENDING) {
      await prisma.articleReview.upsert({
        where: { articleId: row.id },
        update: { status: 'pending' },
        create: { articleId: row.id, status: 'pending' },
      }).catch(() => undefined);
      await notifyEditorsOnSubmit({ slug: row.slug, title: row.title, authorName: row.author?.name || 'نویسنده' });
    }
    await refreshCounts();
    await invalidatePublic();
    await logActivity(req, 'مقاله ویرایش شد', row.title, 'edit');
    if (requestedStatus === PUBLISHED && (req.session!.role === 'admin' || req.session!.role === 'editor')) {
      const published = await publishArticleWithPhase10Checks(req, row.id);
      if (published?.issues.length) return reply.code(409).send({ error: 'quality_check_failed', issues: published.issues, article: publicArticle(published.article) });
      if (published?.article) return { article: publicArticle(published.article) };
    }
    const fresh = await prisma.article.findUniqueOrThrow({ where: { id: row.id }, include: articleInclude });
    return { article: publicArticle(fresh) };
  });

  app.post('/api/admin/articles/:id/publish', {
    preHandler: requireAuth(EDITOR_ROLES),
    schema: { params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } } },
  }, async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const result = await publishArticleWithPhase10Checks(req, req.params.id);
    if (!result) return reply.code(404).send({ error: 'not_found' });
    if (result.issues.length) return reply.code(409).send({ error: 'quality_check_failed', issues: result.issues, article: publicArticle(result.article) });
    return { article: publicArticle(result.article) };
  });

  app.post('/api/admin/articles/:id/schedule', {
    preHandler: requireAuth(EDITOR_ROLES),
    schema: { params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } }, body: { type: 'object', additionalProperties: true } },
  }, async (req: FastifyRequest<{ Params: { id: string }; Body: unknown }>, reply) => {
    const parsed = scheduleBodySchema.safeParse(req.body);
    if (!parsed.success) return badInput(reply);
    const row = await prisma.article.update({
      where: { id: req.params.id },
      data: { status: SCHEDULED, scheduledAt: parsed.data.scheduledAt, publishedAt: null },
      include: articleInclude,
    }).catch(() => null);
    if (!row) return reply.code(404).send({ error: 'not_found' });
    await invalidatePublic();
    await logActivity(req, 'مقاله زمان‌بندی شد', row.title, 'schedule');
    return { article: publicArticle(row) };
  });

  app.post<{ Params: { id: string }; Body: unknown }>('/api/admin/articles/:id/corrections', {
    preHandler: requireAuth(EDITOR_ROLES),
    schema: { params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } }, body: { type: 'object', additionalProperties: true } },
  }, async (req, reply) => {
    const parsed = correctionBodySchema.safeParse(req.body);
    if (!parsed.success) return badInput(reply);
    const article = await prisma.article.findUnique({ where: { id: req.params.id } });
    if (!article) return reply.code(404).send({ error: 'not_found' });
    await prisma.articleCorrection.create({
      data: { articleId: article.id, note: parsed.data.note, editorId: req.session!.userId },
    });
    const notice = `${faDate(new Date())}: ${parsed.data.note}`;
    const row = await prisma.article.update({
      where: { id: article.id },
      data: { correctionNotice: notice, dateModified: new Date() },
      include: articleInclude,
    });
    await invalidatePublic();
    await logActivity(req, 'اصلاحیه مقاله ثبت شد', article.title, 'correction');
    return { article: publicArticle(row) };
  });

  app.delete('/api/admin/articles/:id', {
    preHandler: requireAuth(ADMIN_ONLY),
    schema: { params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } } },
  }, async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const row = await prisma.article.delete({ where: { id: req.params.id } }).catch(() => null);
    if (!row) return reply.code(404).send({ error: 'not_found' });
    await refreshCounts();
    await invalidatePublic();
    await logActivity(req, 'مقاله حذف شد', row.title, 'delete');
    return { ok: true };
  });

  app.get('/api/admin/categories', { preHandler: requireAuth(ALL_CONTENT_ROLES) }, async () => ({
    items: (await prisma.category.findMany({ orderBy: { name: 'asc' } })).map(publicCategory),
  }));

  app.post('/api/admin/categories', { preHandler: requireAuth(EDITOR_ROLES), schema: { body: { type: 'object', additionalProperties: true } } }, async (req, reply) => {
    const parsed = categoryBodySchema.safeParse(req.body);
    if (!parsed.success) return badInput(reply);
    const body = parsed.data;
    const row = await prisma.category.create({
      data: { name: body.name, slug: body.slug ? slugify(body.slug) : slugify(body.name), description: body.description, color: body.color, diagram: body.diagram ?? null },
    });
    await invalidatePublic();
    await logActivity(req, 'دسته‌بندی ایجاد شد', row.name, 'category');
    return { category: publicCategory(row) };
  });

  app.patch('/api/admin/categories/:id', { preHandler: requireAuth(EDITOR_ROLES), schema: { body: { type: 'object', additionalProperties: true } } }, async (req: FastifyRequest<{ Params: { id: string }; Body: unknown }>, reply) => {
    const parsed = categoryBodySchema.partial().safeParse(req.body);
    if (!parsed.success) return badInput(reply);
    const body = parsed.data;
    const row = await prisma.category.update({
      where: { id: req.params.id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.slug !== undefined ? { slug: slugify(body.slug) } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.color !== undefined ? { color: body.color } : {}),
        ...(body.diagram !== undefined ? { diagram: body.diagram ?? null } : {}),
      },
    }).catch(() => null);
    if (!row) return reply.code(404).send({ error: 'not_found' });
    await invalidatePublic();
    await logActivity(req, 'دسته‌بندی ویرایش شد', row.name, 'category');
    return { category: publicCategory(row) };
  });

  app.delete<{ Params: { id: string } }>('/api/admin/categories/:id', { preHandler: requireAuth(ADMIN_ONLY) }, async (req, reply) => {
    const row = await prisma.category.delete({ where: { id: req.params.id } }).catch(() => null);
    if (!row) return reply.code(404).send({ error: 'not_found' });
    await invalidatePublic();
    await logActivity(req, 'دسته‌بندی حذف شد', row.name, 'category');
    return { ok: true };
  });

  app.get('/api/admin/tags', { preHandler: requireAuth(ALL_CONTENT_ROLES) }, async () => ({
    items: await prisma.tag.findMany({ orderBy: [{ count: 'desc' }, { name: 'asc' }] }),
  }));

  app.post('/api/admin/tags', { preHandler: requireAuth(EDITOR_ROLES), schema: { body: { type: 'object', additionalProperties: true } } }, async (req, reply) => {
    const parsed = tagBodySchema.safeParse(req.body);
    if (!parsed.success) return badInput(reply);
    const tag = await prisma.tag.upsert({ where: { name: parsed.data.name }, update: {}, create: { name: parsed.data.name } });
    await invalidatePublic();
    await logActivity(req, 'برچسب ایجاد شد', tag.name, 'tag');
    return { tag };
  });

  app.delete<{ Params: { id: string } }>('/api/admin/tags/:id', { preHandler: requireAuth(ADMIN_ONLY) }, async (req, reply) => {
    const tag = await prisma.tag.delete({ where: { id: req.params.id } }).catch(() => null);
    if (!tag) return reply.code(404).send({ error: 'not_found' });
    await invalidatePublic();
    await logActivity(req, 'برچسب حذف شد', tag.name, 'tag');
    return { ok: true };
  });

  // ── Authors CRUD ────────────────────────────────────────────────────────────
  app.get('/api/admin/authors', { preHandler: requireAuth(ALL_CONTENT_ROLES) }, async () => ({
    items: await prisma.author.findMany({ orderBy: { name: 'asc' } }),
  }));

  app.post('/api/admin/authors', { preHandler: requireAuth(EDITOR_ROLES), schema: { body: { type: 'object', additionalProperties: true } } }, async (req, reply) => {
    const body = req.body as any;
    if (!body.name || !body.slug || !body.specialty) return badInput(reply);
    const author = await prisma.author.create({
      data: {
        name: body.name.trim(),
        slug: body.slug.trim(),
        specialty: body.specialty.trim(),
        bio: body.bio?.trim() || '',
        initials: body.initials?.trim() || body.name.trim().slice(0, 2),
        color: body.color?.trim() || '#0F6B73',
        verifiedExpert: body.verifiedExpert === true,
        verificationNote: body.verificationNote?.trim() || null,
        social: body.social || {},
      },
    });
    await invalidatePublic();
    await logActivity(req, 'نویسنده ایجاد شد', author.name, 'author');
    return author;
  });

  app.put<{ Params: { id: string } }>('/api/admin/authors/:id', { preHandler: requireAuth(EDITOR_ROLES), schema: { body: { type: 'object', additionalProperties: true } } }, async (req, reply) => {
    const body = req.body as any;
    const author = await prisma.author.update({
      where: { id: req.params.id },
      data: {
        ...(body.name ? { name: body.name.trim() } : {}),
        ...(body.slug ? { slug: body.slug.trim() } : {}),
        ...(body.specialty ? { specialty: body.specialty.trim() } : {}),
        ...(body.bio !== undefined ? { bio: body.bio.trim() } : {}),
        ...(body.initials ? { initials: body.initials.trim() } : {}),
        ...(body.color ? { color: body.color.trim() } : {}),
        ...(body.verifiedExpert !== undefined ? { verifiedExpert: body.verifiedExpert === true } : {}),
        ...(body.verificationNote !== undefined ? { verificationNote: body.verificationNote?.trim() || null } : {}),
        ...(body.social ? { social: body.social } : {}),
      },
    }).catch(() => null);
    if (!author) return reply.code(404).send({ error: 'not_found' });
    await invalidatePublic();
    await logActivity(req, 'نویسنده ویرایش شد', author.name, 'author');
    return author;
  });

  app.delete<{ Params: { id: string } }>('/api/admin/authors/:id', { preHandler: requireAuth(ADMIN_ONLY) }, async (req, reply) => {
    const author = await prisma.author.delete({ where: { id: req.params.id } }).catch(() => null);
    if (!author) return reply.code(404).send({ error: 'not_found' });
    await invalidatePublic();
    await logActivity(req, 'نویسنده حذف شد', author.name, 'author');
    return { ok: true };
  });

  app.get('/api/admin/users', { preHandler: requireAuth(ADMIN_ONLY) }, async () => ({
    items: (await prisma.user.findMany({
      include: { _count: { select: { authoredArticles: true } } },
      orderBy: { createdAt: 'desc' },
    })).map(publicUser),
  }));

  app.post('/api/admin/users', { preHandler: requireAuth(ADMIN_ONLY), schema: { body: { type: 'object', additionalProperties: true } } }, async (req, reply) => {
    const parsed = userBodySchema.safeParse(req.body);
    if (!parsed.success) return badInput(reply);
    const body = parsed.data;
    const user = await prisma.user.create({
      data: {
        email: body.email,
        username: body.username ?? usernameFromEmail(body.email),
        name: body.name,
        role: body.role,
        status: body.status,
        passwordHash: await hashPassword(body.password ?? `reset-me-${body.email}`),
      },
    });
    await logActivity(req, 'کاربر ایجاد شد', user.name, 'user');
    return { user: publicUser(user) };
  });

  app.patch('/api/admin/users/:id', { preHandler: requireAuth(ADMIN_ONLY), schema: { body: { type: 'object', additionalProperties: true } } }, async (req: FastifyRequest<{ Params: { id: string }; Body: unknown }>, reply) => {
    const parsed = userBodySchema.partial().safeParse(req.body);
    if (!parsed.success) return badInput(reply);
    const body = parsed.data;
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: {
        ...(body.email !== undefined ? { email: body.email } : {}),
        ...(body.username !== undefined ? { username: body.username } : {}),
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.role !== undefined ? { role: body.role } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.password !== undefined ? { passwordHash: await hashPassword(body.password) } : {}),
      },
    }).catch(() => null);
    if (!user) return reply.code(404).send({ error: 'not_found' });
    await logActivity(req, 'کاربر ویرایش شد', user.name, 'user');
    return { user: publicUser(user) };
  });

  app.get('/api/admin/activity', { preHandler: requireAuth(ADMIN_ONLY) }, async (req, reply) => {
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) return badInput(reply);
    const { page, limit } = parsed.data;
    const [total, rows] = await Promise.all([
      prisma.activityLog.count(),
      prisma.activityLog.findMany({ include: { user: true }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
    ]);
    return {
      items: rows.map((r) => ({
        id: r.id,
        user: r.user?.name ?? 'سیستم',
        action: r.action,
        target: r.target,
        type: r.type,
        time: faDate(r.createdAt),
      })),
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  });

  app.get('/api/admin/activity/export.csv', { preHandler: requireAuth(ADMIN_ONLY) }, async (req, reply) => {
    const parsed = activityExportQuerySchema.safeParse(req.query);
    if (!parsed.success) return badInput(reply);
    const { type, userId, from, to } = parsed.data;
    const where: Prisma.ActivityLogWhereInput = {
      ...(type ? { type } : {}),
      ...(userId ? { userId } : {}),
      ...((from || to) ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
    };
    const rows = await prisma.activityLog.findMany({
      where,
      include: { user: true },
      orderBy: { createdAt: 'desc' },
      take: 5000,
    });
    const csv = [
      ['id', 'user', 'action', 'target', 'type', 'createdAt'].map(csvCell).join(','),
      ...rows.map((r) => [r.id, r.user?.name ?? 'سیستم', r.action, r.target, r.type, r.createdAt.toISOString()].map(csvCell).join(',')),
    ].join('\n');
    return reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', 'attachment; filename="teknav-activity.csv"')
      .send('\uFEFF' + csv);
  });

  app.get('/api/admin/media', { preHandler: requireAuth(EDITOR_ROLES) }, async (req, reply) => {
    const parsed = mediaQuerySchema.safeParse(req.query);
    if (!parsed.success) return badInput(reply);
    const { page, limit, q, mimeType } = parsed.data;
    const where: Prisma.MediaAssetWhereInput = {
      ...(mimeType ? { mimeType: { contains: mimeType, mode: 'insensitive' } } : {}),
      ...(q ? { OR: [{ filename: { contains: q, mode: 'insensitive' } }, { url: { contains: q, mode: 'insensitive' } }] } : {}),
    };
    const [total, rows] = await Promise.all([
      prisma.mediaAsset.count({ where }),
      prisma.mediaAsset.findMany({
        where,
        include: { uploadedBy: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return { items: rows.map(publicMedia), total, page, limit, pages: Math.ceil(total / limit) };
  });

  app.delete<{ Params: { id: string } }>('/api/admin/media/:id', { preHandler: requireAuth(ADMIN_ONLY) }, async (req, reply) => {
    const asset = await prisma.mediaAsset.findUnique({ where: { id: req.params.id } });
    if (!asset) return reply.code(404).send({ error: 'not_found' });
    const [articleRefs, avatarRefs] = await Promise.all([
      prisma.article.count({ where: { content: { contains: asset.url } } }),
      prisma.user.count({ where: { avatarUrl: asset.url } }),
    ]);
    if (articleRefs > 0 || avatarRefs > 0) return reply.code(409).send({ error: 'media_in_use' });
    await prisma.mediaAsset.delete({ where: { id: asset.id } });
    await unlink(asset.path).catch(() => undefined);
    await logActivity(req, 'رسانه حذف شد', asset.filename, 'media');
    return { ok: true };
  });

  app.post('/api/admin/uploads', {
    preHandler: requireAuth(['admin', 'editor', 'writer']),
    bodyLimit: 25 * 1024 * 1024,
    schema: { body: { type: 'object', additionalProperties: true }, response: { 200: { type: 'object', additionalProperties: true } } },
  }, async (req, reply) => {
    const parsed = uploadBodySchema.safeParse(req.body);
    if (!parsed.success) return badInput(reply);
    const now = new Date();
    const yyyy = String(now.getFullYear());
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    let ext = extname(parsed.data.filename).slice(0, 12) || '.bin';

    let fileBuf: Buffer<ArrayBufferLike> = Buffer.from(parsed.data.dataBase64, 'base64');
    const isImage = ['image/jpeg','image/png','image/gif'].includes(parsed.data.mimeType ?? '');

    if (parsed.data.webp && isImage) {
      try {
        const sharp = (await import('sharp')).default;
        fileBuf = await sharp(fileBuf).webp({ quality: 82 }).toBuffer();
        ext = '.webp';
      } catch { /* sharp not installed — proceed with original */ }
    }

    let width: number | undefined;
    let height: number | undefined;
    if (isImage || ext === '.webp') {
      try {
        const sharp = (await import('sharp')).default;
        const meta = await sharp(fileBuf).metadata();
        width = meta.width;
        height = meta.height;
      } catch { /* metadata is optional */ }
    }

    const filename = `${randomUUID()}${ext}`;
    const key = `${yyyy}/${mm}/${filename}`;
    const url = await storage.upload(fileBuf, key, parsed.data.mimeType);
    const absolutePath = join(config.UPLOAD_DIR, key);
    await prisma.mediaAsset.create({
      data: {
        url,
        path: absolutePath,
        filename,
        mimeType: ext === '.webp' ? 'image/webp' : (parsed.data.mimeType ?? 'application/octet-stream'),
        sizeBytes: fileBuf.length,
        width,
        height,
        uploadedById: req.session!.userId,
      },
    }).catch(() => undefined);
    await logActivity(req, 'فایل بارگذاری شد', parsed.data.filename, 'upload');
    return { ok: true, url, path: absolutePath, mimeType: ext === '.webp' ? 'image/webp' : (parsed.data.mimeType ?? 'application/octet-stream') };
  });
  app.get('/api/admin/analytics', { preHandler: requireAuth(ALL_CONTENT_ROLES) }, async (req) => {
    const baseWhere = articleWhereForSession(req.session!);
    const since = new Date();
    since.setDate(since.getDate() - 29);
    const [articles, viewsByDay, comments, saved, subscribers] = await Promise.all([
      prisma.article.findMany({ where: baseWhere, include: articleInclude, orderBy: [{ views: 'desc' }, { updatedAt: 'desc' }], take: 10 }),
      prisma.articleViewLog.groupBy({
        by: ['date'],
        where: { date: { gte: since }, article: baseWhere },
        _sum: { views: true },
        orderBy: { date: 'asc' },
      }),
      prisma.comment.count({ where: { article: baseWhere } }),
      prisma.savedArticle.count({ where: { article: baseWhere } }),
      req.session!.role === 'admin' || req.session!.role === 'editor' ? prisma.newsletterSubscriber.count() : Promise.resolve(0),
    ]);
    return {
      topArticles: articles.map(publicArticle),
      viewsByDay: viewsByDay.map((row) => ({ date: row.date.toISOString().slice(0, 10), views: row._sum.views ?? 0 })),
      comments,
      saved,
      subscribers,
    };
  });

  app.get('/api/admin/seo/audit', { preHandler: requireAuth(ALL_CONTENT_ROLES) }, async (req) => {
    const where = articleWhereForSession(req.session!);
    const articles = await prisma.article.findMany({
      where,
      include: articleInclude,
      orderBy: [{ updatedAt: 'desc' }],
      take: 500,
    });
    const now = Date.now();
    const rows = articles.map((article) => {
      const internalLinks = (article.content.match(/href=["']\/(?:article|topics|category|series|author)\//g) ?? []).length;
      const checks = {
        titleLength: article.title.length >= 35 && article.title.length <= 90,
        metaDescriptionLength: !!article.metaDescription && article.metaDescription.length >= 110 && article.metaDescription.length <= 160,
        canonicalPath: !!article.canonicalPath && article.canonicalPath.startsWith('/article/'),
        ogImage: !!article.ogImage && !/^https?:\/\//i.test(article.ogImage),
        topic: !!article.category?.slug,
        internalLinks: internalLinks >= 2,
        noPlaceholder: !/placeholder|lorem|در دسترس است|به‌زودی|بزودی/i.test(article.content),
        noBrokenImageUrls: !(article.content.match(/<img[^>]+src=["'](https?:\/\/|\/\/)/gi) ?? []).length,
        sourceNotes: !!article.sourceNotes?.trim(),
        factChecked: !!article.factCheckedAt,
      };
      const needsRefresh = article.contentFreshnessStatus === 'needs_update'
        || (!!article.publishedAt && now - article.publishedAt.getTime() > 90 * 24 * 60 * 60 * 1000);
      return {
        article: publicArticle(article),
        checks,
        internalLinks,
        needsRefresh,
        missing: Object.entries(checks).filter(([, ok]) => !ok).map(([key]) => key),
      };
    });
    return {
      totals: {
        articles: rows.length,
        valid: rows.filter((row) => row.missing.length === 0 && !row.needsRefresh).length,
        missingSeo: rows.filter((row) => !row.checks.metaDescriptionLength || !row.checks.canonicalPath || !row.checks.ogImage).length,
        needsRefresh: rows.filter((row) => row.needsRefresh).length,
        missingSourceNotes: rows.filter((row) => !row.checks.sourceNotes).length,
      },
      items: rows,
    };
  });

  app.get('/api/admin/analytics/content', { preHandler: requireAuth(ALL_CONTENT_ROLES) }, async (req) => {
    const where = articleWhereForSession(req.session!);
    const [topViewed, topSaved, topCommented] = await Promise.all([
      prisma.article.findMany({ where, include: articleInclude, orderBy: [{ views: 'desc' }, { updatedAt: 'desc' }], take: 10 }),
      prisma.article.findMany({ where, include: { ...articleInclude, _count: { select: { savedBy: true } } }, orderBy: [{ savedBy: { _count: 'desc' } }, { updatedAt: 'desc' }], take: 10 }),
      prisma.article.findMany({ where, include: { ...articleInclude, _count: { select: { comments: true } } }, orderBy: [{ comments: { _count: 'desc' } }, { updatedAt: 'desc' }], take: 10 }),
    ]);
    return {
      topViewed: topViewed.map(publicArticle),
      topSaved: topSaved.map((article) => ({ article: publicArticle(article), saved: article._count.savedBy })),
      topCommented: topCommented.map((article) => ({ article: publicArticle(article), comments: article._count.comments })),
    };
  });

  app.get('/api/admin/analytics/newsletter', { preHandler: requireAuth(EDITOR_ROLES) }, async () => {
    const since = new Date();
    since.setDate(since.getDate() - 29);
    const [subscribers, confirmed, campaigns, newByDay] = await Promise.all([
      prisma.newsletterSubscriber.count(),
      prisma.newsletterSubscriber.count({ where: { confirmedAt: { not: null } } }),
      prisma.newsletterCampaign.findMany({ include: { createdBy: true }, orderBy: { createdAt: 'desc' }, take: 10 }),
      prisma.newsletterSubscriber.groupBy({
        by: ['createdAt'],
        where: { createdAt: { gte: since } },
        _count: { _all: true },
        orderBy: { createdAt: 'asc' },
      }).catch(() => []),
    ]);
    return {
      subscribers,
      confirmed,
      campaigns: campaigns.map(campaignPublic),
      newByDay: newByDay.map((row) => ({ date: row.createdAt.toISOString().slice(0, 10), subscribers: row._count._all })),
    };
  });

  app.get('/api/admin/analytics/engagement', { preHandler: requireAuth(ALL_CONTENT_ROLES) }, async () => {
    const since = new Date();
    since.setDate(since.getDate() - 29);
    const [events, byType] = await Promise.all([
      prisma.analyticsEvent.findMany({ orderBy: { createdAt: 'desc' }, take: 100 }),
      prisma.analyticsEvent.groupBy({ by: ['type'], where: { createdAt: { gte: since } }, _count: { _all: true }, orderBy: { type: 'asc' } }),
    ]);
    return {
      byType: byType.map((row) => ({ type: row.type, count: row._count._all })),
      recent: events.map((event) => ({
        id: event.id,
        type: event.type,
        userId: event.userId,
        articleId: event.articleId,
        topic: event.topic,
        metadata: event.metadata,
        createdAt: event.createdAt.toISOString(),
      })),
    };
  });

  app.get('/api/admin/reviews', { preHandler: requireAuth(ALL_CONTENT_ROLES) }, async (req) => {
    const where: Prisma.ArticleReviewWhereInput = req.session!.role === 'reviewer' ? { reviewerId: req.session!.userId } : {};
    const rows = await prisma.articleReview.findMany({
      where,
      include: { reviewer: true, article: { include: articleInclude } },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });
    return { items: rows.map((row) => ({
      id: row.id,
      status: row.status,
      note: row.note,
      reviewer: row.reviewer ? publicUser(row.reviewer) : null,
      article: publicArticle(row.article),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    })) };
  });

  app.put<{ Params: { id: string }; Body: unknown }>('/api/admin/articles/:id/review', { preHandler: requireAuth(['admin', 'editor', 'reviewer']), schema: { body: { type: 'object', additionalProperties: true } } }, async (req, reply) => {
    const parsed = reviewBodySchema.safeParse(req.body);
    if (!parsed.success) return badInput(reply);
    const article = await prisma.article.findUnique({ where: { id: req.params.id } });
    if (!article) return reply.code(404).send({ error: 'not_found' });
    const row = await prisma.articleReview.upsert({
      where: { articleId: article.id },
      update: {
        ...(parsed.data.reviewerId !== undefined ? { reviewerId: parsed.data.reviewerId ?? null } : {}),
        ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
        ...(parsed.data.note !== undefined ? { note: parsed.data.note ?? null } : {}),
      },
      create: {
        articleId: article.id,
        reviewerId: parsed.data.reviewerId ?? null,
        status: parsed.data.status ?? 'pending',
        note: parsed.data.note ?? null,
      },
      include: { reviewer: true, article: { include: articleInclude } },
    });
    if (parsed.data.status === 'approved') {
      const published = await publishArticleWithPhase10Checks(req, article.id);
      if (published?.issues.length) return reply.code(409).send({ error: 'quality_check_failed', issues: published.issues, article: publicArticle(published.article) });
      await createNotification(article.authorId.toString(), 'review_approved', { articleSlug: article.slug, articleTitle: article.title, note: parsed.data.note });
    } else if (parsed.data.status === 'revision_requested' || parsed.data.status === 'rejected') {
      await prisma.article.update({ where: { id: article.id }, data: { status: NEEDS_REVISION } }).catch(() => undefined);
      await createNotification(article.authorId.toString(), parsed.data.status === 'revision_requested' ? 'review_revision' : 'review_rejected', { articleSlug: article.slug, articleTitle: article.title, note: parsed.data.note });
    }
    await logActivity(req, 'بررسی مقاله به‌روز شد', article.title, 'review');
    return { review: {
      id: row.id,
      status: row.status,
      note: row.note,
      reviewer: row.reviewer ? publicUser(row.reviewer) : null,
      article: publicArticle(row.article),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    } };
  });

  app.get('/api/admin/newsletter/subscribers', { preHandler: requireAuth(EDITOR_ROLES) }, async () => ({
    items: await prisma.newsletterSubscriber.findMany({ orderBy: { createdAt: 'desc' }, take: 1000 }),
  }));

  app.get('/api/admin/newsletter/campaigns', { preHandler: requireAuth(EDITOR_ROLES) }, async () => ({
    items: (await prisma.newsletterCampaign.findMany({ include: { createdBy: true }, orderBy: { createdAt: 'desc' }, take: 100 })).map(campaignPublic),
  }));

  app.post('/api/admin/newsletter/campaigns', { preHandler: requireAuth(EDITOR_ROLES), schema: { body: { type: 'object', additionalProperties: true } } }, async (req, reply) => {
    const parsed = campaignBodySchema.safeParse(req.body);
    if (!parsed.success) return badInput(reply);
    const slug = parsed.data.slug ? slugify(parsed.data.slug) : slugify(parsed.data.subject);
    const row = await prisma.newsletterCampaign.create({
      data: { subject: parsed.data.subject, slug, bodyHtml: parsed.data.bodyHtml, createdById: req.session!.userId },
      include: { createdBy: true },
    });
    await logActivity(req, 'کمپین خبرنامه ایجاد شد', row.subject, 'newsletter');
    return { campaign: campaignPublic(row) };
  });

  app.post<{ Params: { id: string } }>('/api/admin/newsletter/campaigns/:id/send', { preHandler: requireAuth(EDITOR_ROLES) }, async (req, reply) => {
    const campaign = await prisma.newsletterCampaign.findUnique({ where: { id: req.params.id } });
    if (!campaign) return reply.code(404).send({ error: 'not_found' });
    if (campaign.sentAt) return reply.code(409).send({ error: 'campaign_already_sent' });
    const subscribers = await prisma.newsletterSubscriber.findMany({ orderBy: { createdAt: 'asc' } });
    for (const subscriber of subscribers) {
      const unsubscribe = `https://www.teknav.ir/api/newsletter/unsubscribe?token=${subscriber.unsubscribeToken}`;
      await sendEmail({
        to: subscriber.email,
        subject: campaign.subject,
        html: `${campaign.bodyHtml}<hr><p dir="rtl" style="font-size:12px;color:#667">برای لغو عضویت: <a href="${unsubscribe}">${unsubscribe}</a></p>`,
      });
    }
    const row = await prisma.newsletterCampaign.update({
      where: { id: campaign.id },
      data: { sentAt: new Date(), recipientCount: subscribers.length },
      include: { createdBy: true },
    });
    await logActivity(req, 'کمپین خبرنامه ارسال شد', row.subject, 'newsletter');
    return { campaign: campaignPublic(row) };
  });

  app.get('/api/admin/series', { preHandler: requireAuth(ALL_CONTENT_ROLES) }, async () => ({
    items: (await prisma.articleSeries.findMany({
      include: { articles: { include: { article: { include: articleInclude } }, orderBy: { position: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    })).map(seriesPublic),
  }));

  app.post('/api/admin/series', { preHandler: requireAuth(EDITOR_ROLES), schema: { body: { type: 'object', additionalProperties: true } } }, async (req, reply) => {
    const parsed = seriesBodySchema.safeParse(req.body);
    if (!parsed.success) return badInput(reply);
    const body = parsed.data;
    const row = await prisma.articleSeries.create({
      data: {
        title: body.title,
        slug: body.slug ? slugify(body.slug) : slugify(body.title),
        description: body.description ?? null,
        coverImage: body.coverImage ?? null,
        articles: { create: body.articleIds.map((articleId, index) => ({ articleId, position: index + 1 })) },
      },
      include: { articles: { include: { article: { include: articleInclude } }, orderBy: { position: 'asc' } } },
    });
    await invalidatePublic();
    await logActivity(req, 'سری مقاله ایجاد شد', row.title, 'series');
    return { series: seriesPublic(row) };
  });

  app.patch<{ Params: { id: string }; Body: unknown }>('/api/admin/series/:id', { preHandler: requireAuth(EDITOR_ROLES), schema: { body: { type: 'object', additionalProperties: true } } }, async (req, reply) => {
    const parsed = seriesBodySchema.partial().safeParse(req.body);
    if (!parsed.success) return badInput(reply);
    const body = parsed.data;
    const existing = await prisma.articleSeries.findUnique({ where: { id: req.params.id } });
    if (!existing) return reply.code(404).send({ error: 'not_found' });
    await prisma.articleSeries.update({
      where: { id: existing.id },
      data: {
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.slug !== undefined ? { slug: slugify(body.slug) } : {}),
        ...(body.description !== undefined ? { description: body.description ?? null } : {}),
        ...(body.coverImage !== undefined ? { coverImage: body.coverImage ?? null } : {}),
      },
    });
    if (body.articleIds) {
      await prisma.seriesArticle.deleteMany({ where: { seriesId: existing.id } });
      await prisma.seriesArticle.createMany({ data: body.articleIds.map((articleId, index) => ({ seriesId: existing.id, articleId, position: index + 1 })) });
    }
    const row = await prisma.articleSeries.findUniqueOrThrow({
      where: { id: existing.id },
      include: { articles: { include: { article: { include: articleInclude } }, orderBy: { position: 'asc' } } },
    });
    await invalidatePublic();
    await logActivity(req, 'سری مقاله ویرایش شد', row.title, 'series');
    return { series: seriesPublic(row) };
  });

  app.delete<{ Params: { id: string } }>('/api/admin/series/:id', { preHandler: requireAuth(EDITOR_ROLES) }, async (req, reply) => {
    const row = await prisma.articleSeries.delete({ where: { id: req.params.id } }).catch(() => null);
    if (!row) return reply.code(404).send({ error: 'not_found' });
    await invalidatePublic();
    await logActivity(req, 'سری مقاله حذف شد', row.title, 'series');
    return { ok: true };
  });

  // ── Collaborative Editing Presence ──────────────────────────────────────────

  app.post<{ Params: { id: string } }>('/api/admin/articles/:id/heartbeat', { preHandler: requireAuth(['admin', 'editor', 'writer']) },
    async (req, _reply) => {
      const { id } = req.params;
      const userId = req.session!.userId;
      const key = `presence:article:${id}:user:${userId}`;
      const meta = JSON.stringify({ userId, role: req.session!.role, ts: Date.now() });
      await redis.set(key, meta, 'EX', 45);
      return { ok: true };
    },
  );

  app.get<{ Params: { id: string } }>('/api/admin/articles/:id/presence', { preHandler: requireAuth(['admin', 'editor', 'writer']) },
    async (req, _reply) => {
      const { id } = req.params;
      const pattern = `presence:article:${id}:user:*`;
      const keys: string[] = [];
      let cursor = '0';
      do {
        const [next, batch] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 50) as [string, string[]];
        cursor = next;
        keys.push(...batch);
      } while (cursor !== '0');
      if (!keys.length) return { editors: [] };
      const values = await redis.mget(...keys);
      const raw = values
        .filter((v): v is string => !!v)
        .map((v) => { try { return JSON.parse(v); } catch { return null; } })
        .filter((v): v is { userId: string; role: string; ts: number } => !!v);
      if (!raw.length) return { editors: [] };
      const userIds = [...new Set(raw.map((r) => r.userId))];
      const users = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, avatarUrl: true } });
      const userMap = new Map(users.map((u) => [u.id, u]));
      const editors = raw.map((r) => ({ ...r, name: userMap.get(r.userId)?.name ?? '', avatarUrl: userMap.get(r.userId)?.avatarUrl ?? null }));
      return { editors };
    },
  );

  // ── User Badges ──────────────────────────────────────────────────────────────

  app.get('/api/auth/badges', { preHandler: requireAuth() }, async (req) => {
    const rows = await prisma.userBadge.findMany({
      where: { userId: req.session!.userId },
      orderBy: { earnedAt: 'desc' },
    });
    return { badges: rows.map((r) => ({ id: r.id, badgeType: r.badgeType, earnedAt: r.earnedAt.toISOString(), metadata: r.metadata })) };
  });

  app.get<{ Params: { id: string } }>('/api/admin/users/:id/badges', { preHandler: requireAuth(EDITOR_ROLES) },
    async (req, reply) => {
      const user = await prisma.user.findUnique({ where: { id: req.params.id } });
      if (!user) return reply.code(404).send({ error: 'not_found' });
      const rows = await prisma.userBadge.findMany({ where: { userId: user.id }, orderBy: { earnedAt: 'desc' } });
      return { badges: rows.map((r) => ({ id: r.id, badgeType: r.badgeType, earnedAt: r.earnedAt.toISOString(), metadata: r.metadata })) };
    },
  );

}
