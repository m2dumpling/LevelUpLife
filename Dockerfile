# syntax=docker/dockerfile:1
# ─── Stage 1: 构建阶段 ───
FROM node:24-alpine AS builder
WORKDIR /app

# 持久化 npm 缓存，跨构建复用
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm,sharing=locked \
    npm ci --ignore-scripts

# 复制源码（这层之后会因代码变更失效，但 npm ci 层被缓存）
COPY . .

RUN mkdir -p /app/data
RUN npm rebuild better-sqlite3
RUN npx drizzle-kit generate 2>/dev/null || true

# Next.js 构建（复用 npm 缓存）
RUN --mount=type=cache,target=/root/.npm,sharing=locked \
    npm run build

# 生产依赖
RUN --mount=type=cache,target=/root/.npm,sharing=locked \
    npm ci --omit=dev --ignore-scripts \
    && npm rebuild better-sqlite3 \
    && npm install --no-save drizzle-kit tsx

# ─── Stage 2: 运行阶段 ───
FROM node:24-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/drizzle.config.ts ./
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/src ./src

RUN mkdir -p /app/data && chown -R nextjs:nodejs /app

USER nextjs
EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV DATABASE_PATH=/app/data/levelup.db

CMD ["sh", "-c", "npx drizzle-kit push --config=drizzle.config.ts && node server.js"]
