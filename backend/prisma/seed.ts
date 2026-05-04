// Seed Postgres with the legacy frontend's hardcoded content.
// Source of truth is the existing browser module `teknav-data.js`; we import it
// directly so this stays in lockstep until the admin UI replaces it as the
// content origin (Phase 5).
//
// Idempotent: uses `upsert` keyed on natural identifiers (slug / email / name).

import { PrismaClient } from '@prisma/client';
import * as argon2 from '@node-rs/argon2';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
// @ts-expect-error - plain JS module, no types
import { TeknavData } from '../../teknav-data.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const credentials = JSON.parse(
  await readFile(resolve(__dirname, 'credentials.json'), 'utf-8')
) as { staff: Array<{ email: string; password: string; role: string; name: string; username?: string; resetPasswordOnSeed?: boolean }> };

const prisma = new PrismaClient();

async function applyPersianFts() {
  // Each statement is sent separately so the $$…$$ function body — which
  // contains semicolons — is treated as a single unit.
  const statements: string[] = [
    // Persian normalization fn (idempotent via OR REPLACE).
    `CREATE OR REPLACE FUNCTION teknav_norm_fa(t text)
     RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
       SELECT regexp_replace(
         translate(
           coalesce(t, ''),
           E'يكأإآٱ‌ـًٌٍَُِّْ،؛؟',
           E'یکاااا                ,;?'
         ),
         '\\s+', ' ', 'g'
       );
     $$`,
    `CREATE EXTENSION IF NOT EXISTS pg_trgm`,
    `ALTER TABLE "Article"
       ADD COLUMN IF NOT EXISTS "search_tsv" tsvector
       GENERATED ALWAYS AS (
         setweight(to_tsvector('simple', teknav_norm_fa("title")),                    'A') ||
         setweight(to_tsvector('simple', teknav_norm_fa(coalesce("subtitle", ''))),  'B') ||
         setweight(to_tsvector('simple', teknav_norm_fa("summary")),                 'B') ||
         setweight(to_tsvector('simple', teknav_norm_fa("content")),                 'C')
       ) STORED`,
    `CREATE INDEX IF NOT EXISTS "Article_search_tsv_idx" ON "Article" USING GIN ("search_tsv")`,
    `CREATE INDEX IF NOT EXISTS "Article_title_trgm_idx" ON "Article" USING GIN ("title" gin_trgm_ops)`,
  ];
  for (const sql of statements) {
    await prisma.$executeRawUnsafe(sql);
  }
  console.log('  ✓ persian-fts applied');
}

// Maps the legacy seed `id` (e.g. "a1", "art4") to the cuid Prisma assigns,
// so cross-references inside the seed (article.authorId = "a3") resolve.
const authorIdMap = new Map<string, string>();
const categoryIdMap = new Map<string, string>();
const tagIdMap = new Map<string, string>();
const userIdByEmail = new Map<string, string>();

// Legacy frontend stores roles as plain strings; the schema uses an enum.
const ROLE_MAP: Record<string, 'admin' | 'editor' | 'writer' | 'reviewer' | 'reader'> = {
  admin: 'admin',
  editor: 'editor',
  writer: 'writer',
  reviewer: 'reviewer',
};

const STATUS_MAP: Record<string, 'active' | 'suspended' | 'pending'> = {
  active: 'active',
  inactive: 'suspended',
};

async function hash(password: string) {
  return argon2.hash(password, {
    algorithm: argon2.Algorithm.Argon2id,
    memoryCost: 19 * 1024,
    timeCost: 2,
    parallelism: 1,
  });
}

function usernameFromEmail(email: string) {
  return email.split('@')[0]
    .toLowerCase()
    .replace(/[^a-z0-9_.]/g, '_')
    .replace(/^[^a-z0-9_]+/, '')
    .replace(/[^a-z0-9_]+$/, '')
    .slice(0, 30);
}

function usernameFromText(text: string) {
  return text
    .toLowerCase()
    .replace(/^@/, '')
    .replace(/@.*$/, '')
    .replace(/[^a-z0-9_.]/g, '_')
    .replace(/^[^a-z0-9_]+/, '')
    .replace(/[^a-z0-9_]+$/, '')
    .slice(0, 30);
}

async function uniqueUsername(base: string, excludeUserId?: string) {
  const cleanBase = base || 'user';
  for (let i = 0; i < 50; i += 1) {
    const suffix = i === 0 ? '' : `_${i}`;
    const candidate = `${cleanBase.slice(0, 30 - suffix.length)}${suffix}`;
    const taken = await prisma.user.findUnique({ where: { username: candidate } });
    if (!taken || taken.id === excludeUserId) return candidate;
  }
  return `${cleanBase.slice(0, 23)}_${Date.now().toString(36)}`.slice(0, 30);
}

async function seedCategories() {
  for (const c of TeknavData.categories) {
    const row = await prisma.category.upsert({
      where: { slug: c.slug },
      update: {
        name: c.name,
        description: c.description,
        color: c.color,
        diagram: c.diagram ?? null,
      },
      create: {
        slug: c.slug,
        name: c.name,
        description: c.description,
        color: c.color,
        diagram: c.diagram ?? null,
      },
    });
    categoryIdMap.set(c.id, row.id);
  }
  console.log(`  ✓ categories: ${TeknavData.categories.length}`);
}

async function seedTags() {
  for (const t of TeknavData.tags) {
    const row = await prisma.tag.upsert({
      where: { name: t.name },
      update: { count: t.count ?? 0 },
      create: { name: t.name, count: t.count ?? 0 },
    });
    tagIdMap.set(String(t.id), row.id);
  }
  console.log(`  ✓ tags: ${TeknavData.tags.length}`);
}

async function seedAuthors() {
  const authorSlugAliases: Array<{ from: string; to: string }> = [
    { from: 'arsam-sabbagh', to: 'sabbagh' },
    { from: 'ahmadreza-mahjoub', to: 'mahjoob' },
  ];
  for (const alias of authorSlugAliases) {
    const oldAuthor = await prisma.author.findUnique({ where: { slug: alias.from }, select: { id: true } });
    const newAuthor = await prisma.author.findUnique({ where: { slug: alias.to }, select: { id: true } });
    if (oldAuthor && !newAuthor) {
      await prisma.author.update({ where: { id: oldAuthor.id }, data: { slug: alias.to } });
    }
  }

  for (const a of TeknavData.authors) {
    const row = await prisma.author.upsert({
      where: { slug: a.slug },
      update: {
        name: a.name,
        specialty: a.specialty,
        bio: a.bio ?? '',
        initials: a.initials ?? '',
        color: a.color ?? '#0F6B73',
        social: a.social ?? {},
        articleCount: a.articleCount ?? 0,
      },
      create: {
        slug: a.slug,
        name: a.name,
        specialty: a.specialty,
        bio: a.bio ?? '',
        initials: a.initials ?? '',
        color: a.color ?? '#0F6B73',
        social: a.social ?? {},
        articleCount: a.articleCount ?? 0,
      },
    });
    authorIdMap.set(a.id, row.id);
  }
  console.log(`  ✓ authors: ${TeknavData.authors.length}`);
}

async function linkAuthorsToUsers() {
  const authors = await prisma.author.findMany({ select: { id: true, name: true, userId: true } });
  for (const author of authors) {
    const linkedUser = await prisma.user.findFirst({
      where: { name: author.name },
      select: { id: true },
    });
    if (linkedUser && author.userId !== linkedUser.id) {
      await prisma.author.update({
        where: { id: author.id },
        data: { userId: linkedUser.id },
      });
    }
  }
}

async function seedStaffAccounts() {
  // Initial staff accounts come from credentials.json. Plaintext passwords are
  // hashed (Argon2id) before insert. Rotate via the admin panel before go-live.
  for (const a of credentials.staff) {
    const passwordHash = await hash(a.password);
    const existing = await prisma.user.findUnique({ where: { email: a.email }, select: { id: true } });
    const username = await uniqueUsername(a.username ?? usernameFromEmail(a.email), existing?.id);
    const row = await prisma.user.upsert({
      where: { email: a.email },
      update: {
        name: a.name,
        role: ROLE_MAP[a.role] ?? 'reader',
        username,
        ...(a.resetPasswordOnSeed ? { passwordHash } : {}),
        // Passwords are not overwritten on re-seed unless resetPasswordOnSeed
        // is explicit. This lets new staff accounts replace old placeholder
        // seed passwords while preserving manually rotated production accounts.
      },
      create: {
        email: a.email,
        passwordHash,
        name: a.name,
        role: ROLE_MAP[a.role] ?? 'reader',
        username,
        status: 'active',
      },
    });
    userIdByEmail.set(a.email, row.id);
  }
  console.log(`  ✓ staff accounts: ${credentials.staff.length}`);
}

async function seedDirectoryUsers() {
  // The legacy frontend's `users` list is a separate directory used by admin UI;
  // seed each as an active reader/writer with a placeholder password the user
  // must reset before logging in. Skip if a same-email account already exists.
  for (const u of TeknavData.users) {
    const existing = await prisma.user.findUnique({ where: { email: u.email } });
    if (existing) {
      if (!existing.username) {
        await prisma.user.update({ where: { id: existing.id }, data: { username: await uniqueUsername(u.username ?? usernameFromEmail(u.email), existing.id) } });
      }
      userIdByEmail.set(u.email, existing.id);
      continue;
    }
    const passwordHash = await hash(`reset-me-${u.email}`);
    const username = await uniqueUsername(u.username ?? usernameFromEmail(u.email));
    const row = await prisma.user.create({
      data: {
        email: u.email,
        passwordHash,
        name: u.name,
        username,
        role: ROLE_MAP[u.role] ?? 'reader',
        status: STATUS_MAP[u.status] ?? 'active',
      },
    });
    userIdByEmail.set(u.email, row.id);
  }
  console.log(`  ✓ directory users: ${TeknavData.users.length}`);
}

async function backfillUsernames() {
  const users = await prisma.user.findMany({
    where: { username: null },
    select: { id: true, email: true, name: true },
  });
  for (const user of users) {
    const base = user.email.includes('@teknav.local')
      ? usernameFromText(user.name || user.id)
      : usernameFromEmail(user.email);
    await prisma.user.update({
      where: { id: user.id },
      data: { username: await uniqueUsername(base, user.id) },
    });
  }
  console.log(`  ✓ username backfill: ${users.length}`);
}

// Convert Persian date `۱۴۰۳/۰۸/۲۸` → null (we already have dateEn = ISO).
function persianDigitsToInt(s: string): string {
  return s.replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
}

async function seedArticles() {
  let created = 0;
  for (const art of TeknavData.articles) {
    const categoryId = categoryIdMap.get(art.category);
    const authorId = authorIdMap.get(art.authorId);
    if (!categoryId || !authorId) {
      console.warn(`  · skipping ${art.slug}: missing category or author`);
      continue;
    }

    const publishedAt = art.dateEn
      ? new Date(art.dateEn)
      : art.date
      ? new Date(persianDigitsToInt(art.date).replace(/\//g, '-'))
      : null;
    const status = ['rust-systems', 'venture-capital-ai'].includes(art.slug)
      ? 'پیش‌نویس'
      : 'منتشرشده';

    const data = {
      slug: art.slug,
      title: art.title,
      subtitle: art.subtitle ?? null,
      summary: art.summary ?? '',
      content: art.content ?? '',
      type: art.type ?? 'تحلیل عمیق',
      status,
      readTime: art.readTime ?? 5,
      views: art.views ?? 0,
      reactions: art.reactions ?? 0,
      featured: !!art.featured,
      diagram: art.diagram ?? null,
      metaDescription: art.metaDescription ?? null,
      keywords: Array.isArray(art.keywords) ? art.keywords : [],
      ogTitle: art.ogTitle ?? null,
      ogDescription: art.ogDescription ?? null,
      ogImage: art.ogImage ?? null,
      canonicalPath: art.canonicalPath ?? `/article/${art.slug}`,
      dateModified: art.dateModified ? new Date(art.dateModified) : publishedAt,
      factCheckedAt: art.factCheckedAt ? new Date(art.factCheckedAt) : publishedAt,
      sourceNotes: art.sourceNotes ?? null,
      contentFreshnessStatus: art.contentFreshnessStatus ?? 'current',
      categoryId,
      authorId,
      publishedAt,
    };

    const row = await prisma.article.upsert({
      where: { slug: art.slug },
      update: data,
      create: data,
    });

    // Wire tags by name (idempotent: delete + re-link is safest on re-seed).
    if (Array.isArray(art.tags) && art.tags.length) {
      await prisma.articleTag.deleteMany({ where: { articleId: row.id } });
      for (const tagName of art.tags) {
        const tag = await prisma.tag.upsert({
          where: { name: tagName },
          update: {},
          create: { name: tagName },
        });
        await prisma.articleTag.create({
          data: { articleId: row.id, tagId: tag.id },
        });
      }
    }
    created++;
  }
  console.log(`  ✓ articles: ${created}`);
}

async function seedActivity() {
  // Idempotent: wipe seed-origin entries (those without a userId) before reinserting.
  // Real user-driven activity (with userId) is preserved across re-seeds.
  await prisma.activityLog.deleteMany({ where: { userId: null } });
  const entries = TeknavData.activityLog ?? [];
  if (entries.length) {
    await prisma.activityLog.createMany({
      data: entries.map((a: any) => ({
        action: a.action ?? '',
        target: a.target ?? '',
        type: a.type ?? 'system',
      })),
    });
  }
  console.log(`  ✓ activity entries: ${entries.length}`);
}

async function refreshAggregates() {
  // Keep articleCount on Author/Category in sync with reality (the legacy seed
  // had hand-rolled values; from now on the API maintains these on writes).
  const authors = await prisma.author.findMany({ include: { _count: { select: { articles: true } } } });
  for (const a of authors) {
    await prisma.author.update({ where: { id: a.id }, data: { articleCount: a._count.articles } });
  }
  const cats = await prisma.category.findMany({ include: { _count: { select: { articles: true } } } });
  for (const c of cats) {
    await prisma.category.update({ where: { id: c.id }, data: { articleCount: c._count.articles } });
  }
  console.log(`  ✓ aggregates refreshed`);
}

async function main() {
  console.log('seeding teknav…');
  await applyPersianFts();
  await seedCategories();
  await seedTags();
  await seedAuthors();
  await seedStaffAccounts();
  await seedDirectoryUsers();
  await backfillUsernames();
  await linkAuthorsToUsers();
  await seedArticles();
  await seedActivity();
  await refreshAggregates();
  console.log('done.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
