// Public + authenticated profile routes.
// GET  /api/profile/:username — public profile
// PUT  /api/auth/profile      — update own profile (requires session)
// POST /api/auth/avatar       — upload profile picture (multipart, requires session)

import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import * as argon2 from '@node-rs/argon2';
import { prisma } from '../db.js';
import { config } from '../config.js';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { requireAuth } from '../plugins/session.js';

const USERNAME_RE = /^[a-z0-9_][a-z0-9_.]{1,28}[a-z0-9_]$/;

const profileUpdateSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(USERNAME_RE, 'username must be 3-30 chars, lowercase letters/digits/dots/underscores')
    .optional(),
  bio: z.string().trim().max(280).optional(),
  currentPassword: z.string().min(1).max(256).optional(),
  password: z.string().min(8).max(256).optional(),
});

const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

async function tryWebP(buf: Buffer, mime: string): Promise<{ buf: Buffer; ext: string }> {
  if (mime === 'image/webp') return { buf, ext: '.webp' };
  try {
    const sharp = (await import('sharp')).default;
    const converted = await sharp(buf).webp({ quality: 82 }).toBuffer();
    return { buf: converted, ext: '.webp' };
  } catch {
    return { buf, ext: ALLOWED_IMAGE_TYPES[mime] ?? '.jpg' };
  }
}

export default async function profileRoutes(app: FastifyInstance) {
  // ── Public profile ──────────────────────────────────────────────────────────
  app.get<{ Params: { username: string } }>('/api/profile/:username', async (req, reply) => {
    const slug = req.params.username.toLowerCase().replace(/^@/, '');
    const user = await prisma.user.findUnique({
      where: { username: slug },
      select: {
        id: true,
        username: true,
        name: true,
        bio: true,
        avatarUrl: true,
        role: true,
        createdAt: true,
        author: {
          select: {
            articles: {
              where: { status: 'منتشرشده' },
              orderBy: { publishedAt: 'desc' },
              take: 10,
              select: { id: true, slug: true, title: true, summary: true, publishedAt: true, views: true, reactions: true },
            },
            articleCount: true,
            verifiedExpert: true,
            verificationNote: true,
          },
        },
      },
    });
    if (!user || !user.username) return reply.code(404).send({ error: 'not_found' });
    return reply.send({ profile: user });
  });

  // ── Update own profile ──────────────────────────────────────────────────────
  app.put('/api/auth/profile', { preHandler: requireAuth() }, async (req, reply) => {
    const parsed = profileUpdateSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_input', details: parsed.error.flatten().fieldErrors });

    const { name, username, bio, currentPassword, password } = parsed.data;
    const currentUser = await prisma.user.findUnique({
      where: { id: req.session!.userId },
      select: { id: true, role: true, passwordHash: true },
    });
    if (!currentUser) return reply.code(404).send({ error: 'user_not_found' });
    const canChangeUsername = currentUser.role !== 'reader';

    // Username uniqueness pre-check
    if (username && !canChangeUsername) {
      return reply.code(403).send({ error: 'username_change_forbidden' });
    }
    if (username && canChangeUsername) {
      const taken = await prisma.user.findUnique({ where: { username } });
      if (taken && taken.id !== req.session!.userId) {
        return reply.code(409).send({ error: 'username_taken' });
      }
    }

    let passwordHash: string | undefined;
    if (password) {
      if (currentUser.passwordHash) {
        if (!currentPassword) return reply.code(400).send({ error: 'current_password_required' });
        const ok = await argon2.verify(currentUser.passwordHash, currentPassword).catch(() => false);
        if (!ok) return reply.code(403).send({ error: 'current_password_invalid' });
      }
      passwordHash = await argon2.hash(password, {
        algorithm: argon2.Algorithm.Argon2id,
        memoryCost: 19 * 1024,
        timeCost: 2,
        parallelism: 1,
      });
    }

    const user = await prisma.user.update({
      where: { id: req.session!.userId },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(canChangeUsername && username !== undefined ? { username } : {}),
        ...(bio !== undefined ? { bio } : {}),
        ...(passwordHash ? { passwordHash } : {}),
      },
      select: { id: true, email: true, phone: true, name: true, username: true, bio: true, avatarUrl: true, role: true, status: true, emailVerifiedAt: true, phoneVerifiedAt: true, twoFactorEnabled: true },
    });
    return reply.send({ ok: true, user: { ...user, emailVerified: !!user.emailVerifiedAt, phoneVerified: !!user.phoneVerifiedAt } });
  });

  // ── Upload avatar ───────────────────────────────────────────────────────────
  app.post('/api/auth/avatar', { preHandler: requireAuth() }, async (req: FastifyRequest, reply) => {
    const body = req.body as Record<string, any>;
    if (!body?.file) return reply.code(400).send({ error: 'file_required' });

    const mime: string = body.mimeType ?? 'image/jpeg';
    if (!ALLOWED_IMAGE_TYPES[mime]) return reply.code(400).send({ error: 'unsupported_file_type' });

    let buf = Buffer.from(body.file, 'base64');
    if (buf.length > 5 * 1024 * 1024) return reply.code(400).send({ error: 'file_too_large' }); // 5 MB

    const doWebP: boolean = body.webp === true || body.webp === 'true';
    const { buf: finalBuf, ext } = doWebP ? await tryWebP(buf, mime) : { buf, ext: ALLOWED_IMAGE_TYPES[mime] };
    let width: number | undefined;
    let height: number | undefined;
    try {
      const sharp = (await import('sharp')).default;
      const meta = await sharp(finalBuf).metadata();
      width = meta.width;
      height = meta.height;
    } catch {
      // Dimension metadata is optional; uploads should not fail without sharp.
    }

    const now = new Date();
    const yyyy = String(now.getFullYear());
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dir = join(config.UPLOAD_DIR, yyyy, mm);
    await mkdir(dir, { recursive: true });

    const filename = `avatar-${randomUUID()}${ext}`;
    const absolutePath = join(dir, filename);
    await writeFile(absolutePath, finalBuf);

    const url = `/uploads/${yyyy}/${mm}/${filename}`;
    await prisma.user.update({ where: { id: req.session!.userId }, data: { avatarUrl: url } });
    await prisma.mediaAsset.create({
      data: {
        url,
        path: absolutePath,
        filename,
        mimeType: ext === '.webp' ? 'image/webp' : mime,
        sizeBytes: finalBuf.length,
        width,
        height,
        uploadedById: req.session!.userId,
      },
    }).catch(() => undefined);

    return reply.send({ ok: true, url });
  });
}
