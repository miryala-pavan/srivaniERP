#!/bin/bash
# Restores a pre_deploy_<stamp>.sql backup taken by backup.sh (deploy-safe.ps1
# runs it automatically before every schema change — files live in
# /var/srivani/app/backups/). Deliberately manual-only: never called
# automatically by any deploy script.
#
# backup.sh's dump is a plain pg_dump with no --clean, so restoring it onto
# the live (non-empty) database would fail on every "already exists" error
# rather than actually restoring anything. The only correct way to replay it
# is to drop and recreate srivani_db first, which is why this requires the
# CONFIRM argument — it discards everything currently in the database and
# everything written after the backup's timestamp.
#
# Usage: bash restore_backup.sh pre_deploy_20260821_143000.sql CONFIRM
set -e
FILE="$1"
CONFIRM="$2"
BACKUPS=/var/srivani/app/backups

if [ -z "$FILE" ] || [ "$CONFIRM" != "CONFIRM" ]; then
  echo "This DROPS the live database and replaces it with the backup — everything"
  echo "written since the backup's timestamp is lost. Requires the literal CONFIRM"
  echo "argument so it can't be run by accident."
  echo ""
  echo "Usage: bash restore_backup.sh <filename> CONFIRM"
  echo "Available backups:"
  ls -lh "$BACKUPS" 2>/dev/null || echo "  (none found — has backup.sh ever run?)"
  exit 1
fi

if [ ! -f "$BACKUPS/$FILE" ]; then
  echo "RESTORE_FAILED file not found: $BACKUPS/$FILE"
  exit 1
fi

echo "Taking a safety dump of current state before overwriting, just in case..."
SAFETY_STAMP=$(date +%Y%m%d_%H%M%S)
docker exec srivani-db pg_dump -U srivani -d srivani_db > "$BACKUPS/pre_restore_safety_${SAFETY_STAMP}.sql"
echo "Safety dump saved: $BACKUPS/pre_restore_safety_${SAFETY_STAMP}.sql"

docker exec srivani-db psql -U srivani -d postgres -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS srivani_db;"
docker exec srivani-db psql -U srivani -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE srivani_db OWNER srivani;"

docker cp "$BACKUPS/$FILE" srivani-db:/tmp/restore.sql
docker exec srivani-db psql -U srivani -d srivani_db -v ON_ERROR_STOP=1 -f /tmp/restore.sql

echo "RESTORE_OK restored from $FILE"
echo "Now restart the app: pm2 restart srivani-backend srivani-frontend srivani-storefront"
