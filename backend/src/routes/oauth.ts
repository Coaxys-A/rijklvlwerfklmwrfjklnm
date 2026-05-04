// OAuth — Google + GitHub sign-in (authorization-code grant).
//
// Flow:
//   1. GET  /api/auth/oauth/:provider/start
//        Issues a state token (stored in Redis 10min), redirects to provider's
//        consent screen.
//   2. GET  /api/auth/oauth/:provider/callback?code=…&state=…
//        Validates state, exchanges code → access_token, fetches the user
//        profile, upserts a User row (role: 'reader'), creates a session,
//        redirects to "/".
//
// Env vars (see .env.prod.example):
//   OAUTH_CALLBACK_BASE   e.g. https://teknav.ir
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
//   GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET
// If a provider's vars are missing, that provider's routes return 503.

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { randomBytes } from 'node:crypto';
import { prisma } from '../db.js';
import { redis } from '../redis.js';
import { config } from '../config.js';
import type { SessionData } from '../plugins/session.js';

const STATE_TTL_SECONDS = 10 * 60;
const USERNAME_RE = /^[a-z0-9_][a-z0-9_.]{1,28}[a-z0-9_]$/;

interface ProviderConfig {
  authUrl: string;
  tokenUrl: string;
  userUrl: string;
  scope: string;
  clientId?: string;
  clientSecret?: string;
  parseProfile: (profile: any, accessToken: string) => Promise<{
    sub: string;
    email: string | null;
    name: string;
    avatarUrl: string | null;
  }>;
}

function baseUsername(input: string) {
  const base = input
    .toLowerCase()
    .replace(/^@/, '')
    .replace(/@.*$/, '')
    .replace(/[^a-z0-9_.]/g, '_')
    .replace(/^[^a-z0-9_]+/, '')
    .replace(/[^a-z0-9_]+$/, '')
    .slice(0, 24);
  return USERNAME_RE.test(base) ? base : `user_${randomBytes(3).toString('hex')}`;
}

async function uniqueUsername(seed: string) {
  const base = baseUsername(seed);
  for (let i = 0; i < 20; i += 1) {
    const candidate = i === 0 ? base : `${base}_${i}`;
    const taken = await prisma.user.findUnique({ where: { username: candidate } });
    if (!taken) return candidate;
  }
  return `${base}_${randomBytes(3).toString('hex')}`.slice(0, 30);
}

const PROVIDERS: Record<string, ProviderConfig> = {
  google: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userUrl: 'https://openidconnect.googleapis.com/v1/userinfo',
    scope: 'openid email profile',
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    parseProfile: async (p) => ({
      sub: String(p.sub),
      email: p.email ?? null,
      name: p.name || p.given_name || (p.email ? p.email.split('@')[0] : 'کاربر گوگل'),
      avatarUrl: p.picture ?? null,
    }),
  },
  github: {
    authUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    userUrl: 'https://api.github.com/user',
    scope: 'read:user user:email',
    clientId: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    parseProfile: async (p, accessToken) => {
      let email: string | null = p.email ?? null;
      // GitHub may not return a public email. Fetch the verified primary if not.
      if (!email) {
        try {
          const r = await fetch('https://api.github.com/user/emails', {
            headers: { Authorization: `Bearer ${accessToken}`, 'User-Agent': 'teknav-oauth' },
          });
          if (r.ok) {
            const arr = await r.json() as Array<{ email: string; primary: boolean; verified: boolean }>;
            const primary = arr.find((e) => e.primary && e.verified) || arr.find((e) => e.verified);
            email = primary?.email ?? null;
          }
        } catch { /* swallow */ }
      }
      return {
        sub: String(p.id),
        email,
        name: p.name || p.login || 'کاربر گیت‌هاب',
        avatarUrl: p.avatar_url ?? null,
      };
    },
  },
};

const callbackBase = (process.env.OAUTH_CALLBACK_BASE || '').replace(/\/$/, '');
const redirectUri = (provider: string) => `${callbackBase}/api/auth/oauth/${provider}/callback`;
const stateKey = (s: string) => `oauth:state:${s}`;

export default async function oauthRoutes(app: FastifyInstance) {
  app.get<{ Params: { provider: string } }>(
    '/api/auth/oauth/:provider/start',
    async (req: FastifyRequest<{ Params: { provider: string } }>, reply: FastifyReply) => {
      const cfg = PROVIDERS[req.params.provider];
      if (!cfg) return reply.code(404).send({ error: 'unknown_provider' });
      if (!cfg.clientId || !cfg.clientSecret || !callbackBase) {
        return reply.code(503).send({ error: 'oauth_not_configured', provider: req.params.provider });
      }

      const state = randomBytes(24).toString('base64url');
      await redis.set(stateKey(state), '1', 'EX', STATE_TTL_SECONDS);

      const params = new URLSearchParams({
        client_id: cfg.clientId,
        redirect_uri: redirectUri(req.params.provider),
        response_type: 'code',
        scope: cfg.scope,
        state,
        ...(req.params.provider === 'google' ? { access_type: 'online', prompt: 'select_account' } : {}),
      });
      return reply.redirect(`${cfg.authUrl}?${params.toString()}`);
    },
  );

  app.get<{
    Params: { provider: string };
    Querystring: { code?: string; state?: string; error?: string };
  }>('/api/auth/oauth/:provider/callback', async (req, reply) => {
    const cfg = PROVIDERS[req.params.provider];
    if (!cfg) return reply.code(404).send({ error: 'unknown_provider' });
    if (!cfg.clientId || !cfg.clientSecret || !callbackBase) {
      return reply.code(503).send({ error: 'oauth_not_configured' });
    }

    const { code, state, error } = req.query;
    if (error) return reply.redirect(`/login?error=${encodeURIComponent(error)}`);
    if (!code || !state) return reply.redirect('/login?error=missing_code');

    const stateOk = await redis.get(stateKey(state));
    if (!stateOk) return reply.redirect('/login?error=bad_state');
    await redis.del(stateKey(state));

    // 1. Exchange code → access_token.
    const tokenRes = await fetch(cfg.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: new URLSearchParams({
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
        code,
        redirect_uri: redirectUri(req.params.provider),
        grant_type: 'authorization_code',
      }).toString(),
    });
    if (!tokenRes.ok) return reply.redirect('/login?error=token_exchange_failed');
    const tokenJson = await tokenRes.json() as { access_token?: string };
    const accessToken = tokenJson.access_token;
    if (!accessToken) return reply.redirect('/login?error=no_access_token');

    // 2. Fetch user profile.
    const profileRes = await fetch(cfg.userUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
        'User-Agent': 'teknav-oauth',
      },
    });
    if (!profileRes.ok) return reply.redirect('/login?error=profile_fetch_failed');
    const profile = await cfg.parseProfile(await profileRes.json(), accessToken);

    // 3. Upsert user. Match first by oauthProvider+oauthSubject, then by email.
    let user = await prisma.user.findUnique({
      where: { oauthProvider_oauthSubject: { oauthProvider: req.params.provider, oauthSubject: profile.sub } },
    });

    if (!user && profile.email) {
      user = await prisma.user.findUnique({ where: { email: profile.email } });
      if (user) {
        // Existing email account — link the OAuth identity to it.
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            oauthProvider: req.params.provider,
            oauthSubject: profile.sub,
            ...(user.username ? {} : { username: await uniqueUsername(profile.email || profile.name) }),
            avatarUrl: user.avatarUrl ?? profile.avatarUrl,
            lastLoginAt: new Date(),
          },
        });
      }
    }

    if (!user) {
      // New account — role = reader, no password (OAuth-only).
      user = await prisma.user.create({
        data: {
          email: profile.email ?? `${req.params.provider}+${profile.sub}@oauth.teknav.local`,
          username: await uniqueUsername(profile.email || profile.name || profile.sub),
          name: profile.name,
          avatarUrl: profile.avatarUrl,
          role: 'reader',
          status: 'active',
          oauthProvider: req.params.provider,
          oauthSubject: profile.sub,
          lastLoginAt: new Date(),
        },
      });
    } else {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          lastLoginAt: new Date(),
          ...(user.username ? {} : { username: await uniqueUsername(profile.email || profile.name || user.id) }),
        },
      });
    }

    if (user.status !== 'active') {
      return reply.redirect(`/login?error=account_${user.status}`);
    }

    await reply.createSession({
      userId: user.id,
      role: user.role as SessionData['role'],
    });
    return reply.redirect('/');
  });

  // Helper for the frontend — which providers are configured?
  app.get('/api/auth/oauth/providers', async () => ({
    providers: Object.entries(PROVIDERS)
      .filter(([, p]) => p.clientId && p.clientSecret && callbackBase)
      .map(([k]) => k),
  }));
}

// Suppress "config used" lint when config isn't referenced directly.
void config;
