#!/usr/bin/env bash
# Daily backup of the database and uploaded files.
#   - PostgreSQL custom-format dump (pg_dump -Fc) + uploads tarball + SHA-256 checksums
#   - Retention: last 14 daily backups, plus the 1st-of-month backup for 12 months
#   - Off-site copy with rclone when RCLONE_REMOTE is set (REQUIRED for real protection:
#     a backup stored only on the same VPS does not survive loss of the VPS)
#
# Cron (as root, from /etc/cron.d/rohan-backup):
#   15 2 * * * root cd /opt/rohan-construction && deploy/scripts/backup.sh >> /var/log/rohan-backup.log 2>&1
set -euo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
BACKUP_DIR="${BACKUP_DIR:-$APP_DIR/backups}"
COMPOSE="${COMPOSE:-docker compose --project-directory $APP_DIR --env-file $APP_DIR/.env.production}"
DB_NAME="${DB_NAME:-rohan}"
KEEP_DAILY="${KEEP_DAILY:-14}"
KEEP_MONTHLY="${KEEP_MONTHLY:-12}"
RCLONE_REMOTE="${RCLONE_REMOTE:-}"   # e.g. "gdrive:rohan-backups" or "b2:bucket/rohan"

stamp="$(date +%Y%m%d-%H%M)"
mkdir -p "$BACKUP_DIR/daily" "$BACKUP_DIR/monthly"
umask 077
dest="$BACKUP_DIR/daily/$stamp"
mkdir -p "$dest"

echo "[$(date -Is)] backup start -> $dest"
$COMPOSE exec -T postgres pg_dump -U postgres -d "$DB_NAME" -Fc --no-owner > "$dest/db.dump"
# Sanity check: the dump must be readable and contain the core tables.
$COMPOSE exec -T postgres pg_restore --list < "$dest/db.dump" | grep 'TABLE DATA public ClientPayment' > /dev/null

if [ "${SKIP_UPLOADS:-0}" != "1" ]; then
  $COMPOSE exec -T app tar -C /app/storage -czf - uploads > "$dest/uploads.tar.gz"
fi
( cd "$dest" && sha256sum ./* > SHA256SUMS )

# Keep the first backup of each month.
if [ "$(date +%d)" = "01" ]; then cp -r "$dest" "$BACKUP_DIR/monthly/$stamp"; fi

# Retention.
prune() { find "$1" -mindepth 1 -maxdepth 1 -type d | sort | head -n -"$2" | xargs -r rm -rf; }
prune "$BACKUP_DIR/daily" "$KEEP_DAILY"
prune "$BACKUP_DIR/monthly" "$KEEP_MONTHLY"

if [ -n "$RCLONE_REMOTE" ]; then
  rclone copy "$BACKUP_DIR" "$RCLONE_REMOTE" --transfers 2
  echo "[$(date -Is)] off-site copy -> $RCLONE_REMOTE"
else
  echo "[$(date -Is)] WARNING: RCLONE_REMOTE not set — backup exists ONLY on this VPS"
fi
echo "[$(date -Is)] backup done ($(du -sh "$dest" | cut -f1))"
