import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../db.js';
import { redis } from '../redis.js';
import { cached, bust } from '../lib/cache.js';
import { requireAuth } from '../plugins/session.js';
import { verifyCaptcha } from '../lib/captcha.js';
import { publishRealtime } from '../lib/realtime.js';

const PUBLISHED = 'منتشرشده';
const ARTICLE_CACHE_TTL = 30;
const LOOKUP_CACHE_TTL = 300;
const SEARCH_CACHE_TTL = 30;
const MAX_LIMIT = 50;
const LEGACY_ARTICLE_SLUGS: Record<string, string> = {
  'ai-agents-2026': 'agentic-ai-production',
  'quantum-computing-2024': 'quantum-computing',
};

const articleQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(MAX_LIMIT).default(12),
  category: z.string().trim().optional(),
  author: z.string().trim().optional(),
  tag: z.string().trim().optional(),
  type: z.string().trim().optional(),
  q: z.string().trim().max(120).optional(),
  sort: z.enum(['latest', 'popular', 'readtime', 'personalized']).default('latest'),
  featured: z.coerce.boolean().optional(),
});

const searchQuerySchema = z.object({
  q: z.string().trim().min(1).max(120),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(MAX_LIMIT).default(12),
});

const newsletterSchema = z.object({
  email: z.string().email().max(254).toLowerCase(),
  captchaId: z.string().trim().min(1).max(64),
  userSolution: z.string().trim().min(1).max(20),
  source: z.string().trim().max(120).optional(),
});

const analyticsEventSchema = z.object({
  type: z.enum(['share_clicked']),
  articleId: z.string().trim().optional(),
  slug: z.string().trim().max(240).optional(),
  topic: z.string().trim().max(120).optional(),
  metadata: z.record(z.any()).optional(),
});

const reactionSchema = z.object({
  type: z.string().trim().min(1).max(32),
});

const listResponseSchema = {
  type: 'object',
  additionalProperties: true,
  properties: {
    items: { type: 'array', items: { type: 'object', additionalProperties: true } },
    page: { type: 'number' },
    limit: { type: 'number' },
    total: { type: 'number' },
    pages: { type: 'number' },
  },
};

const simpleListResponseSchema = {
  type: 'object',
  additionalProperties: true,
  properties: {
    items: { type: 'array', items: { type: 'object', additionalProperties: true } },
  },
};

type ArticleWithRelations = Prisma.ArticleGetPayload<{
  include: {
    category: true;
    author: { include: { user: { select: { username: true } } } };
    tags: { include: { tag: true } };
    corrections: { include: { editor: { select: { id: true; name: true; username: true } } } };
  };
}>;

type AuthorWithArticles = Prisma.AuthorGetPayload<{
  include: {
    articles: {
      where: { status: string; publishedAt: { not: null } };
      orderBy: { publishedAt: 'desc' };
      take: 1;
    };
  };
}>;

function normalizeFa(input: string) {
  return input
    .replace(/[\u200c\u0640]/g, '')
    .replace(/[\u064b-\u0652]/g, '')
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function articleOrder(sort: z.infer<typeof articleQuerySchema>['sort']) {
  if (sort === 'popular') return [{ views: 'desc' as const }, { publishedAt: 'desc' as const }];
  if (sort === 'readtime') return [{ readTime: 'desc' as const }, { publishedAt: 'desc' as const }];
  return [{ publishedAt: 'desc' as const }, { createdAt: 'desc' as const }];
}

function publicArticle(article: ArticleWithRelations, options: { premium?: boolean } = {}) {
  const publishedAt = article.publishedAt ?? article.createdAt;
  const locked = article.premiumOnly && !options.premium;
  return {
    id: article.id,
    slug: article.slug,
    title: article.title,
    subtitle: article.subtitle,
    summary: article.summary,
    content: locked ? `<p>${article.summary}</p><div class="premium-lock">این مقاله برای اعضای پریمیوم تکناو است.</div>` : article.content,
    type: article.type,
    status: article.status,
    readTime: article.readTime,
    views: article.views,
    reactions: article.reactions,
    featured: article.featured,
    sponsored: article.sponsored,
    premiumOnly: article.premiumOnly,
    premiumLocked: locked,
    diagram: article.diagram,
    metaDescription: article.metaDescription,
    keywords: article.keywords,
    ogTitle: article.ogTitle,
    ogDescription: article.ogDescription,
    ogImage: article.ogImage,
    canonicalPath: article.canonicalPath ?? `/article/${article.slug}`,
    correctionNotice: article.correctionNotice,
    dateModified: article.dateModified?.toISOString().slice(0, 10) ?? article.updatedAt.toISOString().slice(0, 10),
    category: article.category.slug,
    categoryName: article.category.name,
    categorySlug: article.category.slug,
    categoryColor: article.category.color,
    authorId: article.author.id,
    authorSlug: article.author.slug,
    authorName: article.author.name,
    authorUsername: article.author.user?.username ?? null,
    date: publishedAt.toLocaleDateString('fa-IR'),
    dateEn: publishedAt.toISOString().slice(0, 10),
    tags: article.tags.map((t) => t.tag.name),
    author: publicAuthor(article.author),
    categoryInfo: publicCategory(article.category),
    factCheckedAt: article.factCheckedAt?.toISOString() ?? null,
    reviewedById: article.reviewedById,
    sourceNotes: article.sourceNotes,
    contentFreshnessStatus: article.contentFreshnessStatus,
    corrections: article.corrections?.map((correction) => ({
      id: correction.id,
      note: correction.note,
      createdAt: correction.createdAt.toISOString(),
      date: correction.createdAt.toLocaleDateString('fa-IR'),
      editor: correction.editor ? { id: correction.editor.id, name: correction.editor.name, username: correction.editor.username } : null,
    })) ?? [],
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

function publicAuthor(author: {
  id: string;
  slug: string;
  name: string;
  specialty: string;
  bio: string;
  initials: string;
  color: string;
  social: Prisma.JsonValue;
  articleCount: number;
  verifiedExpert?: boolean;
  verificationNote?: string | null;
  user?: { username: string | null } | null;
}) {
  return {
    id: author.id,
    slug: author.slug,
    name: author.name,
    specialty: author.specialty,
    bio: author.bio,
    initials: author.initials,
    color: author.color,
    social: author.social,
    articleCount: author.articleCount,
    verifiedExpert: !!author.verifiedExpert,
    verificationNote: author.verificationNote ?? null,
    username: author.user?.username ?? null,
  };
}

function publicNewsletterCampaign(row: {
  id: string;
  subject: string;
  slug: string | null;
  bodyHtml: string;
  sentAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: row.id,
    subject: row.subject,
    slug: row.slug ?? row.id,
    bodyHtml: row.bodyHtml,
    sentAt: row.sentAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

async function articleInclude() {
  return {
    category: true,
    author: { include: { user: { select: { username: true } } } },
    tags: { include: { tag: true } },
    corrections: { include: { editor: { select: { id: true, name: true, username: true } } }, orderBy: { createdAt: 'desc' as const } },
  } satisfies Prisma.ArticleInclude;
}

function badInput(reply: FastifyReply) {
  return reply.code(400).send({ error: 'invalid_input' });
}

async function flushViewCounters() {
  let cursor = '0';
  do {
    const [next, keys] = await redis.scan(cursor, 'MATCH', 'views:article:*', 'COUNT', 100);
    cursor = next;
    for (const key of keys) {
      const articleId = key.slice('views:article:'.length);
      const raw = await redis.getset(key, '0');
      const amount = Number(raw ?? 0);
      if (amount > 0) {
        const updated = await prisma.article.update({
          where: { id: articleId },
          data: { views: { increment: amount } },
          select: { id: true, slug: true, views: true },
        }).catch(() => undefined);
        if (updated) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          await prisma.articleViewLog.upsert({
            where: { articleId_date: { articleId, date: today } },
            update: { views: { increment: amount } },
            create: { articleId, date: today, views: amount },
          }).catch(() => undefined);
          await publishRealtime({ event: 'view_update', data: { articleId: updated.id, slug: updated.slug, views: updated.views } }).catch(() => undefined);
        }
      }
      await redis.del(key);
    }
  } while (cursor !== '0');
}

export default async function publicRoutes(app: FastifyInstance) {
  const include = await articleInclude();

  const interval = setInterval(() => {
    flushViewCounters().catch((err) => app.log.warn({ err }, 'failed to flush article view counters'));
  }, 60_000);
  app.addHook('onClose', async () => {
    clearInterval(interval);
    await flushViewCounters();
  });

  app.get('/api/articles', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number' },
          limit: { type: 'number' },
          category: { type: 'string' },
          author: { type: 'string' },
          tag: { type: 'string' },
          type: { type: 'string' },
          q: { type: 'string' },
          sort: { type: 'string', enum: ['latest', 'popular', 'readtime', 'personalized'] },
          featured: { type: 'boolean' },
        },
      },
      response: { 200: listResponseSchema },
    },
  }, async (req, reply) => {
    const parsed = articleQuerySchema.safeParse(req.query);
    if (!parsed.success) return badInput(reply);
    const query = parsed.data;
    const userId = req.session?.userId;
    const cacheKey = `articles:${normalizeFa(JSON.stringify(query))}:${userId ?? 'anon'}`;

    return cached(cacheKey, ARTICLE_CACHE_TTL, async () => {
      let where: Prisma.ArticleWhereInput = {
        status: PUBLISHED,
        publishedAt: { not: null },
        ...(query.featured !== undefined ? { featured: query.featured } : {}),
        ...(query.type ? { type: query.type } : {}),
        ...(query.category ? { category: { slug: query.category } } : {}),
        ...(query.author ? { author: { slug: query.author } } : {}),
        ...(query.tag ? { tags: { some: { tag: { name: { equals: query.tag, mode: 'insensitive' } } } } } : {}),
      };

      if (query.q) {
        where.OR = [
          { title: { contains: query.q, mode: 'insensitive' } },
          { summary: { contains: query.q, mode: 'insensitive' } },
          { subtitle: { contains: query.q, mode: 'insensitive' } },
          { author: { name: { contains: query.q, mode: 'insensitive' } } },
          { category: { name: { contains: query.q, mode: 'insensitive' } } },
          { tags: { some: { tag: { name: { contains: query.q, mode: 'insensitive' } } } } },
        ];
      }

      // Personalization logic
      if (query.sort === 'personalized' && userId) {
        const [followedTopics, followedWriters, readHistory] = await Promise.all([
          prisma.topicFollow.findMany({ where: { userId }, select: { topic: true } }),
          prisma.writerFollow.findMany({ where: { followerId: userId }, select: { writerId: true } }),
          prisma.readHistory.findMany({ where: { userId }, select: { articleId: true } }),
        ]);

        const topicSlugs = followedTopics.map(t => t.topic);
        const writerIds = followedWriters.map(w => w.writerId);
        const readIds = readHistory.map(h => h.articleId);

        where = {
          ...where,
          id: { notIn: readIds },
          OR: [
            ...(topicSlugs.length ? [{ category: { slug: { in: topicSlugs } } }] : []),
            ...(writerIds.length ? [{ author: { user: { id: { in: writerIds } } } }] : []),
            ...(topicSlugs.length === 0 && writerIds.length === 0 ? [{ featured: true }] : []),
          ],
        };
      }

      const [total, rows] = await Promise.all([
        prisma.article.count({ where }),
        prisma.article.findMany({
          where,
          include,
          orderBy: query.sort === 'personalized' ? [{ publishedAt: 'desc' }] : articleOrder(query.sort),
          skip: (query.page - 1) * query.limit,
          take: query.limit,
        }),
      ]);

      let items = rows.map((article) => publicArticle(article));
      if (query.sort === 'personalized' && items.length < query.limit) {
        const readIds = userId ? (await prisma.readHistory.findMany({ where: { userId }, select: { articleId: true } })).map(h => h.articleId) : [];
        const fill = await prisma.article.findMany({
          where: {
            status: PUBLISHED,
            publishedAt: { not: null },
            id: { notIn: [...items.map(i => i.id), ...readIds] }
          },
          include,
          orderBy: { publishedAt: 'desc' },
          take: query.limit - items.length,
        });
        items = [...items, ...fill.map((article) => publicArticle(article))];
      }

      return {
        items,
        page: query.page,
        limit: query.limit,
        total: query.sort === 'personalized' ? items.length : total,
        pages: Math.ceil(total / query.limit),
      };
    });
  });

  app.get('/api/articles/:slug', {
    schema: {
      params: { type: 'object', required: ['slug'], properties: { slug: { type: 'string' } } },
      response: {
        200: { type: 'object', additionalProperties: true },
        404: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (req: FastifyRequest<{ Params: { slug: string } }>, reply) => {
    const canonicalSlug = LEGACY_ARTICLE_SLUGS[req.params.slug] ?? req.params.slug;
    const article = await prisma.article.findFirst({
      where: { slug: canonicalSlug, status: PUBLISHED, publishedAt: { not: null } },
      include,
    });
    if (!article) return reply.code(404).send({ error: 'not_found' });

    await redis.incr(`views:article:${article.id}`);
    await prisma.analyticsEvent.create({
      data: {
        type: 'article_viewed',
        userId: req.session?.userId ?? null,
        articleId: article.id,
        topic: article.category.slug,
        metadata: { slug: article.slug },
      },
    }).catch(() => undefined);

      const [related, saved, reactions, viewer, seriesLink] = await Promise.all([
      prisma.article.findMany({
        where: {
          status: PUBLISHED,
          publishedAt: { not: null },
          categoryId: article.categoryId,
          id: { not: article.id },
        },
        include,
        orderBy: [{ publishedAt: 'desc' }],
        take: 3,
      }),
      req.session
        ? prisma.savedArticle.findUnique({ where: { userId_articleId: { userId: req.session.userId, articleId: article.id } } })
        : Promise.resolve(null),
      req.session
        ? prisma.reaction.findMany({ where: { userId: req.session.userId, articleId: article.id }, select: { type: true } })
        : Promise.resolve([]),
      req.session
        ? prisma.user.findUnique({ where: { id: req.session.userId }, select: { membershipTier: true, membershipExpiresAt: true } })
        : Promise.resolve(null),
      prisma.seriesArticle.findFirst({
        where: { articleId: article.id },
        include: {
          series: {
            include: {
              articles: {
                include: { article: { select: { id: true, slug: true, title: true } } },
                orderBy: { position: 'asc' },
              },
            },
          },
        },
      }),
    ]);
    const premium = viewer?.membershipTier === 'premium' && (!viewer.membershipExpiresAt || viewer.membershipExpiresAt > new Date());
    const series = seriesLink ? {
      id: seriesLink.series.id,
      title: seriesLink.series.title,
      slug: seriesLink.series.slug,
      position: seriesLink.position,
      articles: seriesLink.series.articles.map((sa) => ({
        position: sa.position,
        slug: sa.article.slug,
        title: sa.article.title,
      })),
    } : null;

    return {
      article: { ...publicArticle(article, { premium }), series },
      related: related.map((item) => publicArticle(item)),
      saved: !!saved,
      reactions: Object.fromEntries(reactions.map((r) => [r.type, true])),
    };
  });

  app.get('/api/articles/:slug/related', async (req: FastifyRequest<{ Params: { slug: string } }>, reply) => {
    const canonicalSlug = LEGACY_ARTICLE_SLUGS[req.params.slug] ?? req.params.slug;
    const article = await prisma.article.findFirst({
      where: { slug: canonicalSlug, status: PUBLISHED, publishedAt: { not: null } },
      include: { tags: true },
    });
    if (!article) return reply.code(404).send({ error: 'not_found' });
    const cacheKey = `related:${article.id}`;
    const cachedRelated = await redis.get(cacheKey).catch(() => null);
    if (cachedRelated) return JSON.parse(cachedRelated);
    const tagIds = article.tags.map((t) => t.tagId);
    const candidates = tagIds.length
      ? await prisma.article.findMany({
          where: {
            id: { not: article.id },
            status: PUBLISHED,
            publishedAt: { not: null },
            tags: { some: { tagId: { in: tagIds } } },
          },
          include,
          take: 12,
        })
      : [];
    const scored = candidates
      .map((row) => ({ row, overlap: row.tags.filter((t) => tagIds.includes(t.tagId)).length }))
      .sort((a, b) => b.overlap - a.overlap || b.row.views - a.row.views)
      .slice(0, 3)
      .map(({ row }) => publicArticle(row));
    const payload = { items: scored };
    await redis.set(cacheKey, JSON.stringify(payload), 'EX', 60 * 60).catch(() => undefined);
    return payload;
  });

  app.get('/api/categories', {
    schema: { response: { 200: simpleListResponseSchema } },
  }, async () => cached('categories:all', LOOKUP_CACHE_TTL, async () => ({
    items: (await prisma.category.findMany({ orderBy: { name: 'asc' } })).map(publicCategory),
  })));

  app.get('/api/categories/:slug', {
    schema: {
      params: { type: 'object', required: ['slug'], properties: { slug: { type: 'string' } } },
      response: { 200: { type: 'object', additionalProperties: true }, 404: { type: 'object', properties: { error: { type: 'string' } } } },
    },
  }, async (req: FastifyRequest<{ Params: { slug: string } }>, reply) => {
    const category = await prisma.category.findUnique({ where: { slug: req.params.slug } });
    if (!category) return reply.code(404).send({ error: 'not_found' });
    return { category: publicCategory(category) };
  });

  app.get('/api/tags', {
    schema: { response: { 200: simpleListResponseSchema } },
  }, async () => cached('tags:all', LOOKUP_CACHE_TTL, async () => ({
    items: await prisma.tag.findMany({ orderBy: [{ count: 'desc' }, { name: 'asc' }] }),
  })));

  app.get('/api/authors', {
    schema: { response: { 200: simpleListResponseSchema } },
  }, async () => cached('authors:all', LOOKUP_CACHE_TTL, async () => {
    const authors = await prisma.author.findMany({
      include: {
        articles: {
          where: { status: PUBLISHED, publishedAt: { not: null } },
          orderBy: { publishedAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { name: 'asc' },
    });
    return { items: authors.map((a: AuthorWithArticles) => ({ ...publicAuthor(a), latestArticle: a.articles[0]?.title ?? null })) };
  }));

  app.get('/api/authors/:slug', {
    schema: {
      params: { type: 'object', required: ['slug'], properties: { slug: { type: 'string' } } },
      response: { 200: { type: 'object', additionalProperties: true }, 404: { type: 'object', properties: { error: { type: 'string' } } } },
    },
  }, async (req: FastifyRequest<{ Params: { slug: string } }>, reply) => {
    const author = await prisma.author.findUnique({ where: { slug: req.params.slug } });
    if (!author) return reply.code(404).send({ error: 'not_found' });
    return { author: publicAuthor(author) };
  });

  app.get('/api/series', async () => {
    const rows = await prisma.articleSeries.findMany({
      include: { articles: { include: { article: { include } }, orderBy: { position: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
    return {
      items: rows.map((series) => ({
        id: series.id,
        title: series.title,
        slug: series.slug,
        description: series.description,
        coverImage: series.coverImage,
        articleCount: series.articles.length,
        articles: series.articles.map((item) => ({ position: item.position, article: publicArticle(item.article) })),
      })),
    };
  });

  app.get('/api/series/:slug', async (req: FastifyRequest<{ Params: { slug: string } }>, reply) => {
    const series = await prisma.articleSeries.findUnique({
      where: { slug: req.params.slug },
      include: { articles: { include: { article: { include } }, orderBy: { position: 'asc' } } },
    });
    if (!series) return reply.code(404).send({ error: 'not_found' });
    return {
      series: {
        id: series.id,
        title: series.title,
        slug: series.slug,
        description: series.description,
        coverImage: series.coverImage,
        articles: series.articles.map((item) => ({ position: item.position, article: publicArticle(item.article) })),
      },
    };
  });

  app.get('/api/newsletter/archive', async () => {
    const rows = await prisma.newsletterCampaign.findMany({
      where: { sentAt: { not: null } },
      orderBy: { sentAt: 'desc' },
      take: 100,
    });
    return { items: rows.map(publicNewsletterCampaign) };
  });

  app.get('/api/newsletter/archive/:slug', async (req: FastifyRequest<{ Params: { slug: string } }>, reply) => {
    const row = await prisma.newsletterCampaign.findFirst({
      where: { OR: [{ slug: req.params.slug }, { id: req.params.slug }], sentAt: { not: null } },
    });
    if (!row) return reply.code(404).send({ error: 'not_found' });
    return { campaign: publicNewsletterCampaign(row) };
  });

  app.get('/api/search', {
    schema: {
      querystring: { type: 'object', required: ['q'], properties: { q: { type: 'string' }, page: { type: 'number' }, limit: { type: 'number' } } },
      response: { 200: listResponseSchema },
    },
  }, async (req, reply) => {
    const parsed = searchQuerySchema.safeParse(req.query);
    if (!parsed.success) return badInput(reply);
    const { q, page, limit } = parsed.data;
    const normalized = normalizeFa(q);
    return cached(`search:${normalized}:${page}:${limit}`, SEARCH_CACHE_TTL, async () => {
      const offset = (page - 1) * limit;
      const ids = await prisma.$queryRaw<{ id: string }[]>`
        SELECT id
        FROM "Article"
        WHERE status = ${PUBLISHED}
          AND "publishedAt" IS NOT NULL
          AND search_tsv @@ plainto_tsquery('simple', teknav_norm_fa(${q}))
        ORDER BY ts_rank(search_tsv, plainto_tsquery('simple', teknav_norm_fa(${q}))) DESC,
                 "publishedAt" DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      const count = await prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*)::bigint AS count
        FROM "Article"
        WHERE status = ${PUBLISHED}
          AND "publishedAt" IS NOT NULL
          AND search_tsv @@ plainto_tsquery('simple', teknav_norm_fa(${q}))
      `;
      const order = new Map(ids.map((row, index) => [row.id, index]));
      const rows = ids.length
        ? await prisma.article.findMany({ where: { id: { in: ids.map((i) => i.id) } }, include })
        : [];
      rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
      const total = Number(count[0]?.count ?? 0);
      return { items: rows.map((article) => publicArticle(article)), page, limit, total, pages: Math.ceil(total / limit) };
    });
  });

  app.post('/api/newsletter', {
    schema: {
      body: { type: 'object', required: ['email', 'captchaId', 'userSolution'], properties: { email: { type: 'string' }, captchaId: { type: 'string' }, userSolution: { type: 'string' } } },
      response: {
        200: { type: 'object', properties: { ok: { type: 'boolean' }, alreadySubscribed: { type: 'boolean' } } },
        400: { type: 'object', properties: { error: { type: 'string' } } },
        429: { type: 'object', properties: { error: { type: 'string' }, retryAfter: { type: 'number' } } },
      },
    },
  }, async (req, reply) => {
    const parsed = newsletterSchema.safeParse(req.body);
    if (!parsed.success) return badInput(reply);
    
    // Verify captcha first
    const captchaValid = verifyCaptcha(parsed.data.captchaId, parsed.data.userSolution);
    if (!captchaValid) {
      return reply.code(400).send({ error: 'invalid_captcha' });
    }
    
    const key = `newsletter:${req.ip}`;
    const hits = await redis.incr(key);
    if (hits === 1) await redis.expire(key, 60 * 60);
    if (hits > 3) {
      const ttl = await redis.ttl(key);
      reply.header('Retry-After', String(Math.max(ttl, 1)));
      return reply.code(429).send({ error: 'too_many_requests', retryAfter: ttl });
    }
    const existing = await prisma.newsletterSubscriber.findUnique({ where: { email: parsed.data.email } });
    if (existing) return { ok: true, alreadySubscribed: true };
    await prisma.newsletterSubscriber.create({ data: { email: parsed.data.email, source: parsed.data.source ?? 'site' } });
    await prisma.analyticsEvent.create({
      data: { type: 'newsletter_subscribed', topic: parsed.data.source ?? null, metadata: { source: parsed.data.source ?? 'site' } },
    }).catch(() => undefined);
    return { ok: true, alreadySubscribed: false };
  });

  app.post('/api/analytics/events', {
    schema: { body: { type: 'object', additionalProperties: true } },
  }, async (req, reply) => {
    const parsed = analyticsEventSchema.safeParse(req.body);
    if (!parsed.success) return badInput(reply);
    const article = parsed.data.articleId
      ? await prisma.article.findUnique({ where: { id: parsed.data.articleId }, select: { id: true, slug: true, category: { select: { slug: true } } } })
      : parsed.data.slug
        ? await prisma.article.findUnique({ where: { slug: parsed.data.slug }, select: { id: true, slug: true, category: { select: { slug: true } } } })
        : null;
    await prisma.analyticsEvent.create({
      data: {
        type: parsed.data.type,
        userId: req.session?.userId ?? null,
        articleId: article?.id ?? null,
        topic: parsed.data.topic ?? article?.category.slug ?? null,
        metadata: { ...(parsed.data.metadata ?? {}), slug: article?.slug ?? parsed.data.slug ?? null },
      },
    }).catch(() => undefined);
    return { ok: true };
  });

  app.get('/api/newsletter/unsubscribe', async (req, reply) => {
    const token = String((req.query as any)?.token ?? '');
    if (!token) return reply.code(400).type('text/plain; charset=utf-8').send('invalid token');
    await prisma.newsletterSubscriber.delete({ where: { unsubscribeToken: token } }).catch(() => null);
    return reply.type('text/plain; charset=utf-8').send('اشتراک خبرنامه حذف شد.');
  });

  app.post('/api/articles/:id/reactions', {
    preHandler: requireAuth(),
    schema: {
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      body: { type: 'object', required: ['type'], properties: { type: { type: 'string' } } },
      response: { 200: { type: 'object', additionalProperties: true } },
    },
  }, async (req: FastifyRequest<{ Params: { id: string }; Body: unknown }>, reply) => {
    const parsed = reactionSchema.safeParse(req.body);
    if (!parsed.success) return badInput(reply);
    const article = await prisma.article.findUnique({ where: { id: req.params.id } });
    if (!article) return reply.code(404).send({ error: 'not_found' });
    const key = { userId_articleId_type: { userId: req.session!.userId, articleId: article.id, type: parsed.data.type } };
    const existing = await prisma.reaction.findUnique({ where: key });
    if (existing) {
      await prisma.reaction.delete({ where: key });
    } else {
      await prisma.reaction.create({ data: { userId: req.session!.userId, articleId: article.id, type: parsed.data.type } });
    }
    const total = await prisma.reaction.count({ where: { articleId: article.id } });
    await prisma.article.update({ where: { id: article.id }, data: { reactions: total } });
    const actor = await prisma.user.findUnique({ where: { id: req.session!.userId }, select: { username: true, name: true } });
    await prisma.activityLog.create({
      data: { userId: req.session!.userId, action: existing ? 'واکنش حذف شد' : 'واکنش ثبت شد', target: article.title, type: 'reaction' },
    });
    await publishRealtime({
      event: 'activity',
      data: { type: 'reaction', actor: actor?.username ?? actor?.name ?? 'user', target: article.slug, ts: new Date().toISOString() },
    });
    await bust('articles:*');
    return { ok: true, active: !existing, reactions: total };
  });

  app.post('/api/articles/:id/save', {
    preHandler: requireAuth(),
    schema: {
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      response: { 200: { type: 'object', properties: { ok: { type: 'boolean' }, saved: { type: 'boolean' } } } },
    },
  }, async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const article = await prisma.article.findUnique({ where: { id: req.params.id } });
    if (!article) return reply.code(404).send({ error: 'not_found' });
    const key = { userId_articleId: { userId: req.session!.userId, articleId: article.id } };
    const existing = await prisma.savedArticle.findUnique({ where: key });
    if (existing) {
      await prisma.savedArticle.delete({ where: key });
      const list = await prisma.readingList.findFirst({ where: { userId: req.session!.userId, isDefault: true } });
      if (list) await prisma.readingListItem.deleteMany({ where: { listId: list.id, articleId: article.id } });
      return { ok: true, saved: false };
    }
    await prisma.savedArticle.create({ data: { userId: req.session!.userId, articleId: article.id } });
    await prisma.analyticsEvent.create({
      data: { type: 'article_saved', userId: req.session!.userId, articleId: article.id, metadata: { slug: article.slug } },
    }).catch(() => undefined);
    const list = await prisma.readingList.upsert({
      where: { userId_name: { userId: req.session!.userId, name: 'بعداً بخوانم' } },
      update: { isDefault: true },
      create: { userId: req.session!.userId, name: 'بعداً بخوانم', isDefault: true },
    });
    const nextPosition = await prisma.readingListItem.count({ where: { listId: list.id } });
    await prisma.readingListItem.upsert({
      where: { listId_articleId: { listId: list.id, articleId: article.id } },
      update: {},
      create: { listId: list.id, articleId: article.id, position: nextPosition + 1 },
    });
    return { ok: true, saved: true };
  });
}
