#!/bin/sh
# VPS 一键更新脚本 — 替代 docker compose up -d --build
set -e

cd /opt/levelup-life

echo ">>> 拉取代码..."
git pull origin main

# 检测依赖是否变化
if git diff --name-only HEAD@{1} HEAD | grep -qE 'package.json|package-lock.json'; then
    echo ">>> 依赖有变化，安装..."
    npm ci --omit=dev
fi

# 检测 schema 是否变化
SCHEMA_CHANGED=$(git diff --name-only HEAD@{1} HEAD | grep -c 'drizzle/schema.ts' || true)

echo ">>> 构建..."
npm run build

if [ "$SCHEMA_CHANGED" -gt 0 ]; then
    echo ">>> Schema 有变化，迁移数据库..."
    npx drizzle-kit push --force
fi

echo ">>> 重启..."
pm2 reload ecosystem.config.cjs

echo ">>> 完成!"
pm2 status
