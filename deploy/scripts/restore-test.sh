#!/usr/bin/env bash
# Verifies that a backup can actually be restored, WITHOUT touching the live database.
# Restores the given (or newest) dump into a scratch database, checks it, then drops it.
# Run monthly:  deploy/scripts/restore-test.sh [backups/daily/<stamp>/db.dump]
set -euo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
BACKUP_DIR="${BACKUP_DIR:-$APP_DIR/backups}"
COMPOSE="${COMPOSE:-docker compose --project-directory $APP_DIR --env-file $APP_DIR/.env.production}"
SCRATCH_DB="rohan_restore_test"

dump="${1:-$(find "$BACKUP_DIR/daily" -name db.dump | sort | tail -n 1)}"
[ -n "$dump" ] || { echo "No backups found in $BACKUP_DIR/daily"; exit 1; }
dir="$(dirname "$dump")"
echo "Testing restore of $dump"
( cd "$dir" && sha256sum --check --quiet SHA256SUMS ) && echo "checksums OK"

psql_() { $COMPOSE exec -T postgres psql -U postgres -v ON_ERROR_STOP=1 -tA "$@"; }
psql_ -d postgres -c "DROP DATABASE IF EXISTS $SCRATCH_DB" >/dev/null
psql_ -d postgres -c "CREATE DATABASE $SCRATCH_DB" >/dev/null
trap 'psql_ -d postgres -c "DROP DATABASE IF EXISTS $SCRATCH_DB" >/dev/null' EXIT

$COMPOSE exec -T postgres pg_restore -U postgres -d "$SCRATCH_DB" --no-owner --exit-on-error < "$dump"

echo "Row counts in restored copy:"
psql_ -d "$SCRATCH_DB" -c "
  SELECT 'projects', count(*) FROM \"Project\"
  UNION ALL SELECT 'client payments', count(*) FROM \"ClientPayment\"
  UNION ALL SELECT 'expenses', count(*) FROM \"Expense\"
  UNION ALL SELECT 'audit entries', count(*) FROM \"AuditLog\"
  UNION ALL SELECT 'ledger rows', count(*) FROM \"ProjectCashLedger\";" | sed 's/|/: /'
echo "RESTORE TEST PASSED"
