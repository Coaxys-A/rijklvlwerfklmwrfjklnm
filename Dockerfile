# syntax=docker/dockerfile:1.7
# Teknav frontend — Vite build → nginx:alpine static serving.
# The reverse-proxy nginx config is mounted at runtime from ./nginx/nginx.conf
# (so the operator can tune it for the production env without rebuilding).

# ── Stage 1: build ──────────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS builder

WORKDIR /app

COPY package.json package-lock.json* .npmrc* ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund

# Copy only the things Vite touches.
COPY index.html vite.config.js ./
COPY scripts ./scripts
COPY public ./public
COPY src ./src
COPY teknav-*.js teknav-*.jsx ./

# Build + run the no-CDN guard. If a CDN URL leaks into dist/, this fails the build.
RUN npm run build


# ── Stage 2: serve ──────────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runtime

# Static SPA bundle.
COPY --from=builder /app/dist /usr/share/nginx/html

# Conf is mounted at runtime via a docker-compose volume; ship a sane default
# inside the image so a bare `docker run` of this image still works for smoke tests.
COPY nginx/nginx.default.conf /etc/nginx/conf.d/default.conf

# Healthcheck wgets / for a 200; keeps the static asset path simple.
RUN apk add --no-cache curl
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -fsS http://127.0.0.1/ >/dev/null || exit 1

EXPOSE 80
