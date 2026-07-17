#!/bin/bash
set -e
cd /var/srivani/app/backend
DBURL=$(grep "^DATABASE_URL" .env | cut -d= -f2- | tr -d '"')
./node_modules/.bin/prisma migrate diff --from-url "$DBURL" --to-schema-datamodel prisma/schema.prisma --script 2>/dev/null
