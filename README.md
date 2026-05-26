# LevelUp Life — Turn Daily Tasks into an RPG Adventure

Complete tasks, earn XP/Gold, level up.

> [中文说明](./README_zh-CN.md) | [Android App 📱](https://github.com/m2dumpling/LevelUpLife-App) | Deployed via Cloudflare Tunnel

---

## 🎮 How to Play

You're a hero. Every habit you build, every deadline you hit — that's XP. Level up. Buy gear. Fight the dark lord of procrastination.

### 📋 Two Types of Quests

| | Habit 🔥 | Plan 📋 |
|------|---------|------|
| **What** | Your daily grind: exercise, read, meditate, drink water... | One-shot mission: "Ship the feature by Friday" |
| **When** | Every day / week / month — pick your weekdays | A specific date you choose |
| **Win** | Check in each cycle → XP + Gold stack up | Complete on the due date → big payout |

Tap **+ Create** → set difficulty → preview your quest → confirm. Tap the circle ○ to check in and watch XP fly up.

### 📈 Level Up or Die Trying

> Trivial 5XP · Easy 10XP · Medium 20XP · Hard 40XP · Heroic 80XP

Formula: `xpToNext = 100 × level^1.5`. Level 1→2 is 100 XP. Level 50→51 is 35,000+. Things get real.

### 💀 HP — Your Accountability Bar

You start with **100 HP ❤️**. Every daily Habit you skip costs **5 HP**. Hit **zero** and you're *weakened* — **-10% XP** on everything until you recover.

Log in each day to heal **+20 HP**. The game punishes neglect but rewards consistency.

| HP | Status |
|----|--------|
| > 0 | Healthy — full XP |
| 0 💀 | Weakened — **-10% XP penalty** |

### ⚒️ Shop → Craft → Equip → Stack

Gold isn't just for show. Spend it:

```
Shop 🏪 → buy ores → Craft ⚒️ → forge medals → Equip 🎒 → XP multiplier grows
```

| Ore | Price | Medal | Rarity | XP Bonus |
|-----|-------|-------|--------|----------|
| 🪨 Copper | 10G | 🥉 Copper Medal | Common | +2% |
| ⛏️ Iron | 30G | 🥈 Iron Medal | Uncommon | +5% |
| 🥇 Gold | 100G | 🥇 Gold Medal | Rare | +10% |
| 💠 Mithril | 300G | 💠 Mithril Medal | Epic | +15% |
| 💎 Adamantite | 1000G | 💎 Adamantite Medal | Legendary | +25% |

Medals **multiply**. Five Copper Medals = 1.02⁵ ≈ **+10.4% XP** on every task. Stack wisely.

### 🏆 Achievements & Story
- **18 hidden & visible achievements** ⚔️ — from "First Quest" to "Quest King"
- **6-chapter story** 📖 with NPCs, dialog, and rewards
- **GitHub-style heatmap** 🟩 tracks your habit density
- **Monthly view** 🗓️ shows the next 30 days at a glance

### ⚔️ PvP Arena — Battle Other Heroes
Challenge other players in real-time duels. Winner takes the pot (minus 2G tax).

| Mode | How It Works |
|------|-------------|
| ✊ Rock-Paper-Scissors | Both players pick a move → reveal → winner announced with animated showdown |
| 🎲 Dice Duel | Each player rolls a D20 — highest roll wins. Ties trigger re-rolls up to 3x |
| ⏱ Speed Math | Race to solve a math problem. Correct answer + speed = victory |

- Create a duel with 10–500G bets
- Join waiting duels from other players
- Real-time polling shows opponent's moves
- Daily limit: 10 PvP matches
- Entry requirement: complete at least 1 task today

### 🎰 Daily Lottery
Finish 3+ habits today → spin the wheel for free! Win medals, gold, rare items.

### 🐲 World Boss
Every habit completion deals damage to the shared World Boss. Defeat it together for server-wide rewards.

### 🏰 Guild Hall — Fight Together
- Create or join a guild with a 6-digit invite code
- **Full-screen Discord-style chat** `/chat` with colored avatars, message grouping, and Beijing-time timestamps
- Guild HP bar — damaged when members miss tasks
- **Guild leaderboard** ranks guilds by total XP
- Leader can kick members; members can leave

### 🐾 Pet System
Hatch pet eggs from task rewards. Each pet gives passive buffs (XP bonus, HP recovery, extra gold).

### 🏡 Village
Build your village! Each completed task contributes resources. Unlock buildings for permanent bonuses.

### 🌦 Weather System
Dynamic weather affects task rewards — sunny days boost XP, storms challenge you. Check the weather badge on your dashboard.

### 🎭 Class System
Your task history determines your class (Warrior, Mage, Rogue, etc.) with unique bonuses.

### 🔒 Multi-User + Admin Panel
- **Register/Login** — anyone can create an account (username + password)
- **Admin dashboard** at `/admin` — user stats, registration trends, country distribution
- Content audit flags suspicious task titles
- Ban/unban users, export data, download DB backup
- Only the seed-created `admin` account can access — no privilege escalation possible

---

## 📱 Also on Android

Want notifications that actually work? Get the **[LevelUp Life Android App →](https://github.com/m2dumpling/LevelUpLife-App)** — same game, native alarms, works offline.

---

## 🛠 Tech Stack

Next.js 16 · TypeScript · Tailwind CSS v4 · shadcn/ui · SQLite · Drizzle ORM · JWT + bcrypt · Framer Motion · pm2 · Cloudflare Tunnel

---

## 🖥 Local Dev

```bash
npm install
cp .env.example .env          # Set AUTH_PASSWORD + JWT_SECRET
npx drizzle-kit push --force  # Sync SQLite schema
npm run dev
npx tsx drizzle/seed.ts       # First run only
```

Open `http://localhost:3000` → log in with your `.env` password.

---

## ☁️ VPS Deployment

Tested on Ubuntu 24.04, 1 CPU / 1 GB RAM. Total cost: ~$4/month.

### 0. Prerequisites

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
apt install -y nodejs git
npm install -g pm2
```

### 1. Clone

```bash
cd /opt
git clone https://github.com/m2dumpling/LevelUpLife.git levelup-life
cd levelup-life
```

### 2. Secrets

```bash
cat > .env << EOF
AUTH_PASSWORD=$(openssl rand -base64 16)
JWT_SECRET=$(openssl rand -base64 32)
EOF
chmod 600 .env
cat .env | grep AUTH_PASSWORD    # ← save this!
```

### 3. Build

```bash
npm ci                          # ⚠️ NO --omit=dev — Tailwind needs it
npx drizzle-kit push --force
npm run build
npx tsx drizzle/seed.ts         # prints: 🎉 种子数据播种完成！
```

### 4. Launch

```bash
pm2 start ecosystem.config.cjs
pm2 save && pm2 startup         # auto-restart on reboot
curl -I http://127.0.0.1:3000   # → 307 = working
```

### 5. Cloudflare Tunnel

```bash
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 \
  -o /usr/local/bin/cloudflared && chmod +x /usr/local/bin/cloudflared

cloudflared tunnel login         # open the URL in YOUR browser
cloudflared tunnel create levelup-life
```

Cloudflare Dashboard → **Zero Trust** → **Networks** → **Tunnels** → Configure → **Public Hostname**:
- Domain: your-domain.com → Type: HTTP → URL: `localhost:3000`

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

systemctl daemon-reload && systemctl enable --now cloudflared
```

### 6. Firewall

```bash
apt install -y ufw
ufw default deny incoming && ufw default allow outgoing
ufw allow 22/tcp && ufw --force enable
```

No need to open 80/443 — the tunnel uses outbound connections.

---

## 🔄 Updating

```bash
cd /opt/levelup-life
./update.sh                     # one-click: pull → build → restart
```

Or manual:

```bash
git pull origin main
npm ci                            # run when package-lock changed
npm run build                     # ~20s
npx drizzle-kit push --force      # required when reward_ledger/schema changes
pm2 reload ecosystem.config.cjs
```

---

## 🩹 Troubleshooting

| Symptom | Fix |
|---------|-----|
| Build: `Cannot find module @tailwindcss/postcss` | `npm ci --omit=dev` kills dev deps. Rerun `npm ci && npm run build` |
| Seed: `AUTH_PASSWORD 未设置` | Pull latest — seed script now auto-loads `.env` |
| Browser 404 but `curl localhost` works | Cloudflare Tunnel Public Hostname not pointing to `localhost:3000` |
| pm2: `next start` warning | Pull latest `ecosystem.config.cjs` (uses `server.js` now) |
| Blank page / no data | You skipped the seed step: `npx tsx drizzle/seed.ts` |
| `drizzle-kit push --forc` fails | It's `--force`, not `--forc` |

---

## 📁 Project Structure

```
├── drizzle/                    # DB schema + seed
├── src/
│   ├── app/
│   │   ├── api/                # REST: tasks, auth, shop, craft, inventory, logs
│   │   └── login/              # Auth page
│   ├── components/
│   │   ├── TaskList.tsx        # Task tabs + create/edit/search/filter
│   │   ├── TaskCard.tsx        # Task card (check in / edit / undo / delete)
│   │   ├── StatDashboard.tsx   # Stats panel (Lv, XP, Gold, HP, Streak)
│   │   ├── Heatmap.tsx         # Contribution graph (week/month/year)
│   │   ├── MonthlyView.tsx     # 30-day task overview
│   │   ├── Timeline.tsx        # Daily activity log
│   │   ├── ShopDialog.tsx      # Ore shop
│   │   ├── BackpackDialog.tsx  # Inventory + medal equip
│   │   └── LevelUpModal.tsx    # Level-up celebration
│   ├── hooks/                  # useTasks, useStats
│   └── lib/                    # auth, db, xp-calc, shop-data, date-utils
├── ecosystem.config.cjs        # pm2 config
├── update.sh                   # One-click VPS update
└── .env.example
```
