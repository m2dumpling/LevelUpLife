# LevelUp Life

English | [中文](./README_zh-CN.md)

LevelUp Life turns everyday habits and plans into an RPG loop: complete tasks, earn XP and gold, level up, buy materials, craft medals, join guilds, fight world bosses, and track long-term consistency.

This repository is the standard web version. It does not include Web Push notifications. Use [LevelUpLife-PWA](https://github.com/m2dumpling/LevelUpLife-PWA) if you need installable PWA behavior and server-driven push reminders.

## Current Status

- Multi-user web app with username/password login and an admin panel.
- SQLite + Drizzle schema is used in production.
- PM2 standalone deployment is supported through `ecosystem.config.cjs`.
- Recent regression fixes are covered by `npm run test:bugs`, including one-time gift prompts, task-owner reward isolation, boss reward distribution, guild lifetime XP ranking, and daily settlement date handling.

## Features

- Habit and plan tasks with difficulty-based XP and gold rewards.
- HP, streaks, levels, achievements, story events, heatmap, and monthly view.
- Shop, crafting, backpack, medal equipment, pets, village, weather, and class bonuses.
- PvP arena, daily lottery, world boss, guilds, guild chat, and gold gifts.
- Gift notifications are server-side one-time prompts through `gift_log.seen_at`.
- Admin dashboard for user stats, content audit, bans, exports, and database backup.

## Tech Stack

- Next.js 16, React 19, TypeScript
- Tailwind CSS v4, shadcn/ui style components, Framer Motion
- SQLite, Drizzle ORM, better-sqlite3
- JWT, bcryptjs
- PM2 standalone deployment, Cloudflare Tunnel friendly

## Local Development

```bash
npm install
cp .env.example .env
npm run db:push
npx tsx drizzle/seed.ts
npm run dev
```

Open `http://localhost:3000`.

Required `.env` values:

```bash
AUTH_PASSWORD=your-secret-password
JWT_SECRET=change-me-to-a-random-string-at-least-32-chars
DATABASE_PATH=./data/levelup.db
```

## Verification

```bash
npm run test:bugs
npm run build
```

`npm run test:bugs` is the focused business-regression suite. `npm run build` verifies the production Next.js build.

## Production Install

The live non-PWA deployment is expected to run as:

- Path: `/opt/levelup-life`
- PM2 app: `levelup-life`
- Port: `3000`
- Database: `/opt/levelup-life/data/levelup.db`

Install Node.js 22 and PM2 first:

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
apt install -y nodejs git
npm install -g pm2
```

Clone with SSH if the VPS has deploy keys configured:

```bash
cd /opt
git clone git@github.com:m2dumpling/LevelUpLife.git levelup-life
cd /opt/levelup-life
```

Create `.env` with an absolute database path:

```bash
cat > .env <<'EOF'
AUTH_PASSWORD=replace-with-login-password
JWT_SECRET=replace-with-a-long-random-secret
DATABASE_PATH=/opt/levelup-life/data/levelup.db
EOF
chmod 600 .env
```

Build and initialize:

```bash
npm ci
npm run db:push
npm run build
npx tsx drizzle/seed.ts
pm2 start ecosystem.config.cjs
pm2 save
```

Health check:

```bash
curl -I http://127.0.0.1:3000
```

`307` redirecting to `/login` is normal for an unauthenticated request.

## Updating An Installed VPS

For the existing `/opt/levelup-life` deployment:

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

If `drizzle/schema.ts` changed, run this after the database backup and before restart:

```bash
npm run db:push
```

The included `update.sh` automates pull, conditional dependency install, build, static asset sync, and PM2 reload:

```bash
cd /opt/levelup-life
./update.sh
```

## PM2 Notes

`ecosystem.config.cjs` starts `.next/standalone/server.js` from `/opt/levelup-life` with:

```text
NODE_ENV=production
PORT=3000
HOSTNAME=0.0.0.0
DATABASE_PATH=/opt/levelup-life/data/levelup.db
```

Check the active environment with:

```bash
pm2 describe levelup-life
pm2 env 0 | grep -E "PORT|DATABASE_PATH|NODE_ENV|PWD"
```

## Troubleshooting

| Symptom | Meaning / Fix |
| --- | --- |
| `curl -I` returns `307 location: /login` | Healthy. The app redirects anonymous users to login. |
| `SQLITE_ERROR: no such table: user` | PM2 is pointing at a new/empty database. Use an absolute `DATABASE_PATH` and restart with `--update-env`. |
| `Failed to find Server Action "x"` after deploy | Usually stale browser/PWA chunks from an older build. Refresh the page, close old tabs, or clear site data. |
| `pm2 logs` appears stuck | It is tailing logs by design. Press `Ctrl+C`, or use `pm2 logs levelup-life --lines 80 --nostream`. |
| Build cannot find Tailwind packages | Do not install with `--omit=dev`; production build needs dev dependencies. Run `npm ci` then `npm run build`. |

## Project Layout

```text
drizzle/                  Database schema, migrations, seed script
src/app/                  Next.js App Router pages and API routes
src/components/           Main UI components
src/hooks/                Client hooks
src/lib/                  Auth, DB, reward, date, settlement, and game logic
tests/                    Business regression tests
ecosystem.config.cjs      PM2 production config
update.sh                 VPS update helper
```
