# ─── Stage 1: 构建阶段 ───
FROM node:24-alpine AS builder
WORKDIR /app

# 复制依赖配置
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# 复制源码
COPY . .

# 确保数据目录存在（构建时需要）
RUN mkdir -p /app/data

# 编译 better-sqlite3（原生模块编译）
RUN npm rebuild better-sqlite3

# 生成 Drizzle 迁移文件 + Next.js 构建
RUN npx drizzle-kit generate 2>/dev/null || true
RUN npm run build

# 仅安装生产依赖
RUN npm ci --omit=dev --ignore-scripts && npm rebuild better-sqlite3

# 重新安装运行时工具（drizzle-kit 推送 schema + tsx 运行种子脚本）
RUN npm install --no-save drizzle-kit tsx

# ─── Stage 2: 运行阶段 ───
FROM node:24-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# 创建非 root 用户
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

# 复制 standalone 输出
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# 复制整个生产 node_modules（含 drizzle-kit）
COPY --from=builder /app/node_modules ./node_modules

# 复制 drizzle-kit 所需的配置文件
COPY --from=builder /app/drizzle.config.ts ./
COPY --from=builder /app/drizzle ./drizzle

# 复制源码（种子脚本需要）
COPY --from=builder /app/src ./src

# 数据目录
RUN mkdir -p /app/data && chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV DATABASE_PATH=/app/data/levelup.db

# 启动时推送数据库 schema + 启动 Next.js
CMD ["sh", "-c", "npx drizzle-kit push --config=drizzle.config.ts && node server.js"]
