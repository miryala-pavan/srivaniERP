#!/bin/bash
# Rolls back the most recent deploy-safe.ps1 code swap by restoring whichever
# of backend/frontend/storefront still has a .old build sitting next to it
# (swap_and_restart.sh / swap_backend_only.sh always leave one behind — they
# never delete the previous build, only rename it). Safe to run more than
# once: a component with no .old is simply skipped, nothing is deleted.
#
# This does NOT touch the database. If the deploy that's being rolled back
# also applied a schema change, restore the matching pg_dump from
# /var/srivani/app/backups/ separately (see restore_backup.sh) — code and
# schema should be rolled back together, not one without the other.
set -e
APP=/var/srivani/app
rolled_back=""

if [ -d "$APP/backend/dist.old" ]; then
  rm -rf "$APP/backend/dist.rolled_back"
  mv "$APP/backend/dist" "$APP/backend/dist.rolled_back"
  mv "$APP/backend/dist.old" "$APP/backend/dist"
  if [ -f "$APP/backend/prisma/schema.prisma.old" ]; then
    cp "$APP/backend/prisma/schema.prisma" "$APP/backend/prisma/schema.prisma.rolled_back"
    mv "$APP/backend/prisma/schema.prisma.old" "$APP/backend/prisma/schema.prisma"
    cd "$APP/backend"
    ./node_modules/.bin/prisma generate 2>&1 | tail -3
  fi
  rolled_back="$rolled_back backend"
fi

if [ -d "$APP/frontend/.next.old" ]; then
  rm -rf "$APP/frontend/.next.rolled_back"
  mv "$APP/frontend/.next" "$APP/frontend/.next.rolled_back"
  mv "$APP/frontend/.next.old" "$APP/frontend/.next"
  rolled_back="$rolled_back frontend"
fi

if [ -d "$APP/storefront/.next.old" ]; then
  rm -rf "$APP/storefront/.next.rolled_back"
  mv "$APP/storefront/.next" "$APP/storefront/.next.rolled_back"
  mv "$APP/storefront/.next.old" "$APP/storefront/.next"
  rolled_back="$rolled_back storefront"
fi

if [ -z "$rolled_back" ]; then
  echo "ROLLBACK_NOOP no .old build found for backend, frontend, or storefront — nothing to roll back (either nothing's been deployed since the last rollback, or this is the first deploy)"
  exit 0
fi

pm2 restart srivani-backend srivani-frontend srivani-storefront
pm2 save
echo "ROLLBACK_OK rolled back:$rolled_back"
