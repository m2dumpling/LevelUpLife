# LevelUp Life — Turn Daily Tasks into an RPG Adventure

Complete tasks, earn XP/Gold, level up.

> [中文说明](./README_zh-CN.md) | Deployed via Cloudflare Tunnel

## Game Systems

| System | Description |
|--------|-------------|
| **Level** | Earn XP from tasks. `xpToNext = 100 × level^1.5` |
| **Gold** | Earn gold from tasks, spend at the shop |
| **HP Penalty** | -5HP per missed daily habit. 0HP = -10% XP |
| **Habit** | Daily/weekly/monthly recurring tasks. Multi-select weekdays. Streak tracking + best streak |
| **Plan** | One-time quests on a target date. Auto-fail when expired |
| **Search & Filter** | Client-side: title/description search + difficulty + status filters |
| **Confirm Dialog** | Form → preview → confirm for task creation. Edit saves in one step |
| **Edit** | Click ✏️ icon to edit, one-click save |
| **Undo** | Revert completed tasks back to pending |
| **Achievements** | 18 achievements, some hidden, auto-unlock |
| **Story** | 6-chapter storyline triggered by milestones |
| **Shop & Craft** | Buy ores → craft medals → equip for stacked XP bonuses |
| **Heatmap** | GitHub-style contribution graph, week/month/year toggle |
| **Monthly View** | 30-day future task overview |

### Task Difficulty

| Difficulty | XP | Gold |
|------------|-----|------|
| Trivial | 5 | 1 |
| Easy | 10 | 3 |
| Medium | 20 | 5 |
| Hard | 40 | 10 |
| Heroic | 80 | 20 |

### Ores & Medals

| Ore | Cost | Crafts Into | Required | Rarity | XP Bonus |
|-----|------|-------------|----------|--------|----------|
| Copper Ore | 10G | Copper Medal | 5 | Common | +2% |
| Iron Ore | 30G | Iron Medal | 5 | Uncommon | +5% |
| Gold Ore | 100G | Gold Medal | 5 | Rare | +10% |
| Mithril Ore | 300G | Mithril Medal | 3 | Epic | +15% |
| Adamantite Ore | 1000G | Adamantite Medal | 3 | Legendary | +25% |

Equipped medals stack multiplicatively and display in the navbar.

---

## Tech Stack

- **Frontend**: Next.js 16 (App Router) + TypeScript + Tailwind CSS v4 + shadcn/ui
- **Database**: SQLite (better-sqlite3) + Drizzle ORM
- **Auth**: JWT (jose) + bcryptjs, httpOnly cookie
- **Animation**: Framer Motion, canvas-confetti
- **Deployment**: pm2 + Cloudflare Tunnel

---

## Local Development

```bash
npm install
cp .env.example .env
# Edit .env: set AUTH_PASSWORD and JWT_SECRET

npm run dev

# First time only — seed database
npx tsx drizzle/seed.ts
```

Open `http://localhost:3000`, log in with the password from `.env`.

---

## VPS Deployment

Tested on Ubuntu 24.04, 1 CPU / 1 GB RAM.

### 0. Install Prerequisites

```bash
# Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
apt install -y nodejs

# pm2
npm install -g pm2

# Git
apt install -y git
```

### 1. Clone & Setup

```bash
cd /opt
git clone https://github.com/m2dumpling/LevelUpLife.git levelup-life
cd levelup-life
```

### 2. Create .env

```bash
cat > .env << EOF
AUTH_PASSWORD=$(openssl rand -base64 16)
JWT_SECRET=$(openssl rand -base64 32)
EOF
chmod 600 .env

# Save your password — you'll need it to log in
cat .env | grep AUTH_PASSWORD
```

### 3. Install & Build

```bash
npm ci             # ⚠️ Do NOT use --omit=dev — Tailwind/TS are needed for build
npm run build
```

### 4. Seed Database

```bash
npx tsx drizzle/seed.ts
```

Should print `🎉 种子数据播种完成！`. The seed script auto-loads `.env`, no manual export needed.

### 5. Start with pm2

```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup            # Auto-start on reboot
```

### 6. Verify

```bash
pm2 status
curl -I http://127.0.0.1:3000
# Should return 307 (redirect to login) — that's correct
```

### 7. Cloudflare Tunnel

**One-time setup:**
```bash
# Install cloudflared
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 \
  -o /usr/local/bin/cloudflared
chmod +x /usr/local/bin/cloudflared

# Login — this prints a URL, open it in YOUR browser (not VPS) to authorize
cloudflared tunnel login

# Create a tunnel
cloudflared tunnel create levelup-life
```

Now in Cloudflare Dashboard:
1. **Zero Trust** → **Networks** → **Tunnels**
2. Click the newly created tunnel → **Configure**
3. **Public Hostname** tab → Add:
   - **Subdomain**: `@` (or any subdomain)
   - **Domain**: your-domain.com
   - **Type**: HTTP
   - **URL**: `localhost:3000`

**Start tunnel as systemd service:**
```bash
cat > /etc/systemd/system/cloudflared.service << 'EOF'
[Unit]
Description=Cloudflare Tunnel
After=network.target

[Service]
ExecStart=/usr/local/bin/cloudflared tunnel run --url http://localhost:3000 levelup-life
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now cloudflared
systemctl status cloudflared     # Verify running
```

### 8. Firewall

```bash
apt install -y ufw
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw --force enable
```

Tunnel uses outbound connections — no need to open ports 80/443.

### 9. Login & Use

Visit `https://your-domain.com`, log in with the `AUTH_PASSWORD` from step 2.

---

## Updating on VPS

```bash
cd /opt/levelup-life
git pull origin main
npm run build                     # ~20s
pm2 reload ecosystem.config.cjs

# Only if drizzle/schema.ts changed:
npx drizzle-kit push --force
```

Or use the one-click script: `./update.sh`

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Build error `Cannot find module '@tailwindcss/postcss'` | You used `npm ci --omit=dev`. Re-run: `npm ci && npm run build` |
| Seed error `AUTH_PASSWORD 未设置` | Pull latest code (seed script now auto-loads .env) |
| API returns 404 on browser but works via curl | Check Cloudflare Tunnel Public Hostname → URL is `localhost:3000` |
| pm2 `next start` warning | Pull latest `ecosystem.config.cjs` (now uses `server.js`) |
| Page loads but no data | Run `npx tsx drizzle/seed.ts` |
| `drizzle-kit push --force` fails | The `--force` flag must be spelled correctly (not `--forc`) |

---

## Project Structure

```
├── drizzle/                    # DB schema + seed script
├── src/
│   ├── app/
│   │   ├── api/                # API: tasks, auth, shop, craft, inventory, logs
│   │   ├── login/              # Login page
│   │   └── page.tsx            # Main dashboard
│   ├── components/
│   │   ├── TaskList.tsx        # Task tabs + create/edit/search/filter
│   │   ├── TaskCard.tsx        # Task card (complete/edit/undo/delete)
│   │   ├── Heatmap.tsx         # Contribution heatmap (week/month/year)
│   │   ├── MonthlyView.tsx     # 30-day future task overview
│   │   ├── Timeline.tsx        # Daily activity log
│   │   ├── StatDashboard.tsx   # XP, Gold, HP, Streak display
│   │   ├── Navbar.tsx          # Navigation + equipped medals
│   │   ├── ShopDialog.tsx      # Ore shop
│   │   ├── BackpackDialog.tsx  # Inventory + medal equip
│   │   ├── LevelUpModal.tsx    # Level-up celebration
│   │   └── ui/                 # shadcn/ui primitives
│   ├── hooks/
│   │   ├── useTasks.ts         # Task CRUD
│   │   └── useStats.ts         # User stats
│   └── lib/
│       ├── auth.ts             # JWT + bcrypt
│       ├── db.ts               # Database connection
│       ├── daily-settlement.ts # HP daily settlement engine
│       ├── xp-calculator.ts    # XP/level/medal bonus calculation
│       ├── shop-data.ts        # Ore & medal config
│       └── date-utils.ts       # Date helpers
├── ecosystem.config.cjs        # pm2 config
├── update.sh                   # One-click update script
└── .env.example
```
