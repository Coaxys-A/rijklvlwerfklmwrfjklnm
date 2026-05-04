#!/bin/sh
# Teknav nightly Postgres backup.
# Loops forever inside the postgres-backup container; uses a 24h sleep so the
# host cron doesn't have to know anything. Runs once at startup, then every 24h.
#
# Output:    /backups/teknav-YYYYMMDD-HHMMSS.sql.gz
# Retention: keep 14 days; older files auto-deleted.

set -eu

BACKUP_DIR="${BACKUP_DIR:-/backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
INTERVAL_SECONDS="${BACKUP_INTERVAL_SECONDS:-86400}"  # 24h

mkdir -p "$BACKUP_DIR"

run_once() {
  ts="$(date -u +%Y%m%d-%H%M%S)"
  out="${BACKUP_DIR}/teknav-${ts}.sql.gz"
  echo "[pg-backup] dumping → ${out}"
  PGPASSWORD="${POSTGRES_PASSWORD}" pg_dump \
      --host=postgres \
      --username="${POSTGRES_USER}" \
      --dbname="${POSTGRES_DB}" \
      --no-owner --no-privileges \
      --format=plain \
    | gzip -9 > "$out.tmp" \
    && mv "$out.tmp" "$out"
  echo "[pg-backup] done → $(du -h "$out" | cut -f1)"

  echo "[pg-backup] pruning files older than ${RETENTION_DAYS} days"
  find "$BACKUP_DIR" -maxdepth 1 -name 'teknav-*.sql.gz' -type f -mtime +"$RETENTION_DAYS" -print -delete || true
}

while true; do
  run_once || echo "[pg-backup] dump failed; will retry next cycle"
  echo "[pg-backup] sleeping ${INTERVAL_SECONDS}s"
  sleep "$INTERVAL_SECONDS"
done
