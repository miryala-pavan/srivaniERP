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

# Sync each app's package.json/lock and install — a new dependency added
# locally (e.g. @anthropic-ai/sdk) previously never made it to the server at
# all: this step only ever swapped compiled dist/.next output, so a runtime
# `require()` of a package that was never installed here crash-looped the
# app on every restart. `npm install` (not `ci`) is idempotent and fast (a
# few seconds) when the lockfile already matches what's installed, so this
# costs nothing on the common case of "no new dependency" and only does real
# work when one was actually added.
for app in backend frontend storefront; do
  cp "/tmp/$app-package.json" "$APP/$app/package.json"
  cp "/tmp/$app-package-lock.json" "$APP/$app/package-lock.json"
  (cd "$APP/$app" && npm install --omit=dev 2>&1 | tail -5)
done

cd "$APP/backend"
./node_modules/.bin/prisma generate 2>&1 | tail -3
pm2 restart srivani-backend srivani-frontend srivani-storefront
pm2 save
