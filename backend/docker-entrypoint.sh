#!/bin/sh
# Backend entrypoint — apply schema, then exec the server.
# Migration vs. db-push selection: Prisma migrations are the production-correct
# path, but if no migrations folder exists yet (fresh repo, or schema managed
# via `prisma db push` during dev) we fall back to db push.

set -eu

cd /app

if [ -d "prisma/migrations" ] && [ "$(ls -A prisma/migrations 2>/dev/null || true)" ]; then
  echo "[entrypoint] applying Prisma migrations via 'prisma migrate deploy'"
  npx --no-install prisma migrate deploy
else
  echo "[entrypoint] no prisma/migrations/ found — falling back to 'prisma db push'"
  echo "[entrypoint]   (run 'npx prisma migrate dev --name init' once locally to switch to migration mode)"
  npx --no-install prisma db push --skip-generate
fi

exec "$@"
