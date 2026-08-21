#!/bin/bash
set -e
APP=/var/srivani/app

rm -rf /tmp/bdist && mkdir -p /tmp/bdist
tar -xzf /tmp/backend-dist.tgz -C /tmp/bdist
rm -rf "$APP/backend/dist.old"
mv "$APP/backend/dist" "$APP/backend/dist.old"
mv /tmp/bdist/dist "$APP/backend/dist"
rm -f "$APP/backend/prisma/schema.prisma.old"
cp "$APP/backend/prisma/schema.prisma" "$APP/backend/prisma/schema.prisma.old"
cp /tmp/schema.prisma "$APP/backend/prisma/schema.prisma"

cd "$APP/backend"
./node_modules/.bin/prisma generate 2>&1 | tail -3
pm2 restart srivani-backend
pm2 save
