#!/bin/bash
set -e
APP=/var/srivani/app

rm -rf /tmp/bdist && mkdir -p /tmp/bdist
tar -xzf /tmp/backend-dist.tgz -C /tmp/bdist
rm -rf "$APP/backend/dist.old"
mv "$APP/backend/dist" "$APP/backend/dist.old"
mv /tmp/bdist/dist "$APP/backend/dist"
cp /tmp/schema.prisma "$APP/backend/prisma/schema.prisma"

rm -rf /tmp/fnext && mkdir -p /tmp/fnext
tar -xzf /tmp/next.tgz -C /tmp/fnext
rm -rf "$APP/frontend/.next.old"
mv "$APP/frontend/.next" "$APP/frontend/.next.old"
mv /tmp/fnext/.next "$APP/frontend/.next"
tar -xzf /tmp/public.tgz -C "$APP/frontend"

rm -rf /tmp/snext && mkdir -p /tmp/snext
tar -xzf /tmp/storefront-next.tgz -C /tmp/snext
rm -rf "$APP/storefront/.next.old"
mv "$APP/storefront/.next" "$APP/storefront/.next.old"
mv /tmp/snext/.next "$APP/storefront/.next"
tar -xzf /tmp/storefront-public.tgz -C "$APP/storefront"

cd "$APP/backend"
./node_modules/.bin/prisma generate 2>&1 | tail -3
pm2 restart srivani-backend srivani-frontend srivani-storefront
pm2 save
