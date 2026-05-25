#!/bin/sh
# One-click VPS update for the pm2 deployment.
set -e

cd /opt/levelup-life

echo ">>> Pulling latest code..."
git pull origin main

if git diff --name-only HEAD@{1} HEAD | grep -qE 'package.json|package-lock.json' || [ ! -x node_modules/.bin/next ]; then
    echo ">>> Dependencies changed or missing, installing..."
    npm ci --no-audit --no-fund
fi

SCHEMA_CHANGED=$(git diff --name-only HEAD@{1} HEAD | grep -c 'drizzle/schema.ts' || true)

echo ">>> Building..."
npm run build

if [ "$SCHEMA_CHANGED" -gt 0 ]; then
    echo ">>> Schema changed, syncing database..."
    npx drizzle-kit push --force
fi

echo ">>> Copying static assets to standalone..."
rm -rf .next/standalone/.next/static .next/standalone/public 2>/dev/null
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public

echo ">>> Reloading pm2 app..."
pm2 reload ecosystem.config.cjs

echo ">>> Done."
pm2 status
