# LevelUp Life

A personal RPG-style habit tracker — turn daily tasks into an adventure.

> [中文说明](./README.zh-CN.md)

## Game Mechanics

| System | Description |
|--------|-------------|
| **Level** | Earn XP from tasks, level up. `xpToNext = 100 × level^1.5` |
| **Gold** | Earn gold from tasks, spend at the shop |
| **HP** | Daily HP affected by completing/skipping/failing tasks |
| **Streak** | Consecutive completion days; resets on miss; best streak recorded |
| **Achievements** | 18 achievements, some hidden, auto-unlock on completion |
| **Story** | 6-chapter storyline triggered by progress milestones |
| **Shop & Craft** | Buy ores with gold → craft medals → equip for XP bonus |
| **Heatmap** | GitHub-style contribution graph showing yearly task activity |

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

Equipped medals display next to the title, sorted by rarity. XP bonuses stack multiplicatively.

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
# Install dependencies
npm install

# Copy environment template
cp .env.example .env
# Edit .env and set a development password

# Start dev server
npm run dev

# Seed the database (first time only)
npx tsx drizzle/seed.ts
```

Open `http://localhost:3000` and log in with the password from `.env`.

---

## VPS Deployment (Docker + Cloudflare Tunnel)

### Prerequisites

- A VPS (1 CPU / 1 GB RAM is enough)
- A domain with DNS managed on Cloudflare
- Docker installed on the VPS

### Step 1: Clone the repository

```bash
cd /opt
git clone https://github.com/m2dumpling/LevelUpLife.git levelup-life
cd levelup-life
```

### Step 2: Create .env file

```bash
cat > .env << EOF
AUTH_PASSWORD=$(openssl rand -base64 16)
JWT_SECRET=$(openssl rand -base64 32)
EOF
chmod 600 .env

# Save the password for logging in
cat .env | grep AUTH_PASSWORD
```

### Step 3: Build and start the container

```bash
docker compose up -d --build
```

### Step 4: Seed the database

```bash
docker exec -it levelup-life npx tsx drizzle/seed.ts
```

You should see `🎉 种子数据播种完成！` (Seed complete).

### Step 5: Verify the container is running

```bash
docker ps | grep levelup
curl -I http://127.0.0.1:3000
```

### Step 6: Set up Cloudflare Tunnel

In Cloudflare Dashboard:
1. Go to **Zero Trust** → **Networks** → **Tunnels**
2. Click **Create a tunnel**, name it (e.g. `levelup-life`)
3. Choose **Docker** environment, copy the token from the install command

Back on the VPS:

```bash
docker run -d \
  --name cloudflare-tunnel \
  --restart unless-stopped \
  --network host \
  cloudflare/cloudflared:latest tunnel \
  --no-autoupdate run \
  --token YOUR_TUNNEL_TOKEN
```

Then in the Cloudflare Tunnel config, add a **Public Hostname**:
- **Subdomain**: `@` (or your preferred subdomain)
- **Domain**: your-domain.com
- **Service**: `http://localhost:3000`

Visit `https://your-domain.com` — done.

### Step 7: Firewall

```bash
apt install -y ufw
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
# No need to open 80/443 — Tunnel uses outbound connections
ufw --force enable
ufw status verbose
```

---

## Updating

```bash
cd /opt/levelup-life
git pull origin main
docker compose up -d --build
```

---

## Project Structure

```
├── drizzle/              # DB schema, migrations, seed script
├── src/
│   ├── app/
│   │   ├── api/          # API routes (tasks, auth, shop, craft, inventory)
│   │   ├── login/        # Login page
│   │   ├── layout.tsx    # Root layout
│   │   └── page.tsx      # Main dashboard
│   ├── components/       # React components
│   │   ├── Navbar.tsx    # Navbar + medal display
│   │   ├── Heatmap.tsx   # GitHub-style contribution heatmap
│   │   ├── ShopDialog.tsx     # Shop dialog
│   │   ├── BackpackDialog.tsx # Backpack/inventory dialog
│   │   └── ui/           # shadcn/ui primitives
│   ├── lib/              # Utilities
│   │   ├── auth.ts       # JWT + bcrypt auth
│   │   ├── db.ts         # Database connection
│   │   ├── xp-calculator.ts   # XP/level calculation
│   │   ├── shop-data.ts  # Ore/medal configuration
│   │   └── seed-data.ts  # Predefined achievements & story
│   └── middleware.ts      # Route guard (JWT verification)
├── Dockerfile
├── docker-compose.yml
└── .env.example
```
