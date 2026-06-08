# LevelUp Life

[English](./README.md) | 中文

LevelUp Life 把日常习惯和计划任务做成 RPG 循环：完成任务获得 XP 和金币、升级、买材料、合成奖牌、加入公会、打世界 Boss，并长期追踪执行力。

这个仓库是标准 Web 版，不包含 Web Push 推送通知。需要可安装 PWA 和服务端推送提醒时，使用 [LevelUpLife-PWA](https://github.com/m2dumpling/LevelUpLife-PWA)。

## 当前状态

- 支持多用户注册/登录和管理员后台。
- 生产环境使用 SQLite + Drizzle。
- 支持 PM2 standalone 部署，配置文件是 `ecosystem.config.cjs`。
- 最近的业务回归修复由 `npm run test:bugs` 覆盖，包括金币礼物只提示一次、任务奖励按任务拥有者计算、Boss 奖励只发一次、公会按终身 XP 排名、每日结算日期边界等。

## 功能

- Habit 和 Plan 两类任务，按难度发放 XP 和金币。
- HP、连续打卡、等级、成就、剧情、热力图、月视图。
- 商店、合成、背包、奖牌装备、宠物、村庄、天气、职业加成。
- PvP、每日抽奖、世界 Boss、公会、公会聊天、金币礼物。
- 金币礼物提示通过 `gift_log.seen_at` 在服务端记录，确保收礼人只弹一次。
- 管理员后台支持用户统计、内容审计、封禁、导出和数据库备份。

## 技术栈

- Next.js 16、React 19、TypeScript
- Tailwind CSS v4、shadcn/ui 风格组件、Framer Motion
- SQLite、Drizzle ORM、better-sqlite3
- JWT、bcryptjs
- PM2 standalone 部署，适合配合 Cloudflare Tunnel

## 本地开发

```bash
npm install
cp .env.example .env
npm run db:push
npx tsx drizzle/seed.ts
npm run dev
```

打开 `http://localhost:3000`。

必须配置的 `.env`：

```bash
AUTH_PASSWORD=your-secret-password
JWT_SECRET=change-me-to-a-random-string-at-least-32-chars
DATABASE_PATH=./data/levelup.db
```

## 验证

```bash
npm run test:bugs
npm run build
```

`npm run test:bugs` 是重点业务回归测试。`npm run build` 验证生产构建。

## 生产安装

非 PWA 线上部署应保持：

- 路径：`/opt/levelup-life`
- PM2 应用名：`levelup-life`
- 端口：`3000`
- 数据库：`/opt/levelup-life/data/levelup.db`

先安装 Node.js 22 和 PM2：

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
apt install -y nodejs git
npm install -g pm2
```

如果 VPS 已配置 GitHub SSH key，建议用 SSH 克隆：

```bash
cd /opt
git clone git@github.com:m2dumpling/LevelUpLife.git levelup-life
cd /opt/levelup-life
```

创建 `.env`，生产环境务必使用绝对数据库路径：

```bash
cat > .env <<'EOF'
AUTH_PASSWORD=替换成登录密码
JWT_SECRET=替换成足够长的随机密钥
DATABASE_PATH=/opt/levelup-life/data/levelup.db
EOF
chmod 600 .env
```

构建并初始化：

```bash
npm ci
npm run db:push
npm run build
npx tsx drizzle/seed.ts
pm2 start ecosystem.config.cjs
pm2 save
```

健康检查：

```bash
curl -I http://127.0.0.1:3000
```

未登录请求返回 `307` 并跳转到 `/login` 是正常的。

## 已安装 VPS 如何更新

已有 `/opt/levelup-life` 部署时：

```bash
cd /opt/levelup-life
git fetch origin
git status
cp data/levelup.db data/levelup.db.bak-$(date +%Y%m%d%H%M%S)
git pull --ff-only origin main
npm ci --no-audit --no-fund
npm run build
pm2 restart levelup-life --update-env
curl -I http://127.0.0.1:3000
```

如果本次更新改了 `drizzle/schema.ts`，在备份数据库后、重启前执行：

```bash
npm run db:push
```

仓库里的 `update.sh` 会自动执行拉代码、按需安装依赖、构建、同步 standalone 静态资源和 PM2 reload：

```bash
cd /opt/levelup-life
./update.sh
```

## PM2 说明

`ecosystem.config.cjs` 会从 `/opt/levelup-life` 启动 `.next/standalone/server.js`，环境变量为：

```text
NODE_ENV=production
PORT=3000
HOSTNAME=0.0.0.0
DATABASE_PATH=/opt/levelup-life/data/levelup.db
```

检查当前 PM2 环境：

```bash
pm2 describe levelup-life
pm2 env 0 | grep -E "PORT|DATABASE_PATH|NODE_ENV|PWD"
```

## 常见问题

| 现象 | 原因 / 处理 |
| --- | --- |
| `curl -I` 返回 `307 location: /login` | 正常，未登录用户会跳转登录页。 |
| `SQLITE_ERROR: no such table: user` | PM2 指到了新的空数据库。改成绝对 `DATABASE_PATH`，再 `pm2 restart --update-env`。 |
| 部署后出现 `Failed to find Server Action "x"` | 多数是浏览器或 PWA 还拿着旧构建资源。刷新页面、关闭旧标签页或清站点缓存。 |
| `pm2 logs` 一直不退出 | 这是 tail 日志的正常行为。按 `Ctrl+C`，或用 `pm2 logs levelup-life --lines 80 --nostream`。 |
| 构建找不到 Tailwind 包 | 不要用 `npm ci --omit=dev`，生产构建需要 devDependencies。执行 `npm ci` 后再 `npm run build`。 |

## 项目结构

```text
drizzle/                  数据库 schema、迁移、种子脚本
src/app/                  Next.js App Router 页面和 API
src/components/           主要 UI 组件
src/hooks/                客户端 hooks
src/lib/                  登录、数据库、奖励、日期、结算、游戏逻辑
tests/                    业务回归测试
ecosystem.config.cjs      PM2 生产配置
update.sh                 VPS 更新脚本
```
