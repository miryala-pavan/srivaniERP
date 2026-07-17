#!/bin/bash
set -e
APP=/var/srivani/app

echo "--- backend: npm install + build ---"
cd "$APP/backend"
npm install
npm run build

echo "--- frontend: npm install + build ---"
cd "$APP/frontend"
npm install
npm run build

echo "--- storefront: npm install + build ---"
cd "$APP/storefront"
if [ ! -f .env.production ]; then
  echo "FATAL: storefront/.env.production missing on server - refusing to build (would bake wrong URLs into the bundle)"
  exit 1
fi
npm install
npm run build

echo "--- prisma generate ---"
cd "$APP/backend"
./node_modules/.bin/prisma generate 2>&1 | tail -3
