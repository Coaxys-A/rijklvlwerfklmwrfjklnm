# syntax=docker/dockerfile:1.7
# Teknav backend — Fastify + Prisma + Argon2id.
# Two-stage build; runtime is bookworm-slim (Debian) so the host server's
# Debian 13 Trixie environment matches at the libc + openssl level.

# ── Stage 1: deps + TypeScript build ────────────────────────────────────────
FROM node:20-bookworm-slim AS builder

# openssl is needed by Prisma's query engine; ca-certs for npm tarball verification.
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install deps with a clean lockfile-driven install. Cache the npm download
# between builds via the BuildKit cache mount.
COPY package.json package-lock.json* .npmrc* ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund

# Generate Prisma client (needs schema before TS compile).
COPY prisma ./prisma
RUN npx prisma generate

# Copy and compile TypeScript.
COPY tsconfig.json ./
COPY src ./src
RUN npx tsc

# Drop dev deps so the runtime stage gets a leaner node_modules.
RUN npm prune --omit=dev


# ── Stage 2: runtime ────────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl ca-certificates dumb-init \
    && rm -rf /var/lib/apt/lists/*

# Run as a non-root user.
RUN groupadd -r teknav --gid=10001 && \
    useradd -r -g teknav --uid=10001 --home-dir=/app --shell=/bin/false teknav

WORKDIR /app
ENV NODE_ENV=production \
    PORT=3010 \
    UPLOAD_DIR=/uploads

COPY --from=builder --chown=teknav:teknav /app/node_modules ./node_modules
COPY --from=builder --chown=teknav:teknav /app/dist ./dist
COPY --from=builder --chown=teknav:teknav /app/prisma ./prisma
COPY --chown=teknav:teknav package.json ./

# Uploads volume mount target — pre-create with correct ownership.
RUN mkdir -p /uploads && chown teknav:teknav /uploads

COPY --chown=teknav:teknav docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

USER teknav
EXPOSE 3010

# dumb-init forwards SIGTERM → Node so graceful shutdown actually fires.
ENTRYPOINT ["dumb-init", "--", "/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "--enable-source-maps", "dist/server.js"]
