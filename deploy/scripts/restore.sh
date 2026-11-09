#!/usr/bin/env bash
# DISASTER RECOVERY: replaces the LIVE database with a backup.
# Usage: deploy/scripts/restore.sh backups/daily/<stamp>/db.dump
# Stops the app, takes a safety dump of the current database, restores, restarts.
set -euo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
COMPOSE="${COMPOSE:-docker compose --project-directory $APP_DIR --env-file $APP_DIR/.env.production}"
DB_NAME="${DB_NAME:-rohan}"
dump="${1:?usage: restore.sh <path/to/db.dump>}"

( cd "$(dirname "$dump")" && sha256sum --check --quiet SHA256SUMS )
read -r -p "This REPLACES the live '$DB_NAME' database with $dump. Type RESTORE to continue: " answer
[ "$answer" = "RESTORE" ] || { echo "Aborted."; exit 1; }

$COMPOSE stop app
safety="$APP_DIR/backups/pre-restore-$(date +%Y%m%d-%H%M).dump"
$COMPOSE exec -T postgres pg_dump -U postgres -d "$DB_NAME" -Fc > "$safety"
echo "Safety copy of current database: $safety"

$COMPOSE exec -T postgres psql -U postgres -v ON_ERROR_STOP=1 -d postgres \
  -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DB_NAME' AND pid <> pg_backend_pid();" \
  -c "DROP DATABASE $DB_NAME;" \
  -c "CREATE DATABASE $DB_NAME OWNER rc_owner;"
$COMPOSE exec -T postgres pg_restore -U postgres -d "$DB_NAME" --no-owner --role=rc_owner --exit-on-error < "$dump"
$COMPOSE run --rm migrate   # re-applies read-only grants (and any newer migrations)
$COMPOSE start app
echo "Restore complete. Uploaded files: extract uploads.tar.gz from the same folder if needed (see docs)."
