#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/teknav}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
STAMP="$(date -u +%Y%m%d-%H%M%S)"
OUT="${BACKUP_DIR}/teknav-${STAMP}.sql.gz"

mkdir -p "${BACKUP_DIR}"
chmod 750 "${BACKUP_DIR}"

pg_dump "${DATABASE_URL}" | gzip -9 > "${OUT}"
chmod 640 "${OUT}"

find "${BACKUP_DIR}" -type f -name 'teknav-*.sql.gz' -mtime "+${RETENTION_DAYS}" -delete
echo "[teknav-backup] wrote ${OUT}"
