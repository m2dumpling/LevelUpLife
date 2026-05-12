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
- **Deployment**: Docker + Cloudflare Tunnel

---

## Local Development

```bash
npm install
cp .env.example .env
# Edit .env to set a password

npm run dev
npx tsx drizzle/seed.ts   # First run only
```

Open `http://localhost:3000` and log in with the password from `.env`.

---

## VPS Deployment (Docker + Cloudflare Tunnel)

### Prerequisites

- A VPS (1 CPU / 1 GB RAM is enough)
- A domain with DNS managed on Cloudflare
- Docker installed on the VPS

### 1. Clone

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

# Save your password
cat .env | grep AUTH_PASSWORD
```

### 3. Build & Start

```bash
docker compose up -d --build
```

### 4. Seed Database

```bash
docker exec -it levelup-life npx tsx drizzle/seed.ts
```

### 5. Verify

```bash
docker ps | grep levelup
curl -I http://127.0.0.1:3000
```

### 6. Cloudflare Tunnel

In Cloudflare Dashboard → **Zero Trust** → **Networks** → **Tunnels**:

1. Create a tunnel, choose Docker, copy the token
2. Run on VPS:

```bash
docker run -d \
  --name cloudflare-tunnel \
  --restart unless-stopped \
  --network host \
  cloudflare/cloudflared:latest tunnel \
  --no-autoupdate run \
  --token YOUR_TUNNEL_TOKEN
```

3. Add a **Public Hostname** pointing to `http://localhost:3000`

### 7. Firewall

```bash
apt install -y ufw
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw --force enable
```

The tunnel uses outbound connections — no need to open 80/443.

---

## Updating on VPS

```bash
cd /opt/levelup-life
git pull origin main
docker compose up -d --build
docker exec -it levelup-life npx drizzle-kit push --force
```

The last command is **only needed when `drizzle/schema.ts` changed** in the pulled commits. Without it, new columns won't exist in the database and the API will return 500 errors.

---

## Project Structure

```
├── drizzle/                  # DB schema + seed script
├── src/
│   ├── app/
│   │   ├── api/              # API: tasks, auth, shop, craft, inventory, logs
│   │   ├── login/            # Login page
│   │   └── page.tsx          # Main dashboard
│   ├── components/
│   │   ├── TaskList.tsx      # Task tabs + create/edit/search/filter
│   │   ├── TaskCard.tsx      # Task card (complete/edit/undo/delete)
│   │   ├── Heatmap.tsx       # Contribution heatmap
│   │   ├── MonthlyView.tsx   # 30-day future task overview
│   │   ├── Timeline.tsx      # Daily activity log
│   │   ├── StatDashboard.tsx # XP, Gold, HP, Streak display
│   │   ├── Navbar.tsx        # Navigation + equipped medals
│   │   ├── ShopDialog.tsx    # Ore shop
│   │   ├── BackpackDialog.tsx # Inventory + medal equip
│   │   ├── LevelUpModal.tsx  # Level-up celebration
│   │   └── ui/               # shadcn/ui primitives
│   ├── hooks/
│   │   ├── useTasks.ts       # Task CRUD
│   │   └── useStats.ts       # User stats
│   └── lib/
│       ├── auth.ts           # JWT + bcrypt
│       ├── db.ts             # Database connection
│       ├── daily-settlement.ts # HP daily settlement engine
│       ├── xp-calculator.ts  # XP/level/medal bonus calculation
│       ├── shop-data.ts      # Ore & medal config
│       └── date-utils.ts     # Date helpers
├── Dockerfile
├── docker-compose.yml
└── .env.example
```
