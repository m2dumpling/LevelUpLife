# LevelUp Life

将日常任务变成 RPG 冒险 — 完成任务赚 XP/金币，升级变强。

> [English](./README.md) | 部署到了 Cloudflare Tunnel

## 🎮 玩法指南

### 📋 创建任务
两种任务类型：

| | Habit 🔥 | Plan 📋 |
|------|---------|------|
| **干什么** | 每日修行：运动、阅读、冥想... | 一次性任务："周五前提交报告" |
| **何时** | 每天/每周/每月，可选指定星期几 | 你选的具体日期 |
| **奖励** | 每次打卡 ✅ 赚 XP + 金币 | 在到期日当天完成获得 XP + 金币 |

点击 **+ 新建** → 选难度 → 预览 → 确认创建。点圆圈 ○ 打卡，看 XP 数字飘起 🎉。

所有日期按 **北京时间（Asia/Shanghai）** 计算，即使 VPS 在其他时区，Habit 也会按北京时间跨天刷新。撤回已完成的 Habit 或 Plan 会移除该次完成，并扣回对应金币奖励。

### 📈 升级体系
每个任务根据难度给 **XP** 和 **金币**：

> 琐碎 5XP · 简单 10XP · 中等 20XP · 困难 40XP · 史诗 80XP

填满 XP 条 → **叮！** 🎊 升级。`升级所需 = 100 × 等级^1.5` — 越往后越难！

### 💀 HP 惩罚机制
初始 **100 HP ❤️**。每天，你承诺要做但没做的 Habit → **扣 5 HP**。

| HP | 影响 |
|----|------|
| > 0 | 正常 — 满额 XP 收益 |
| 0 💀 | **XP 减益 10%** — 你被削弱了！ |

每天登录恢复 **+20 HP**。保持连击别断 🔥！

### ⚒️ 商店与合成
赚金币 → 花掉：

```
商店买矿石 🏪 → 合成奖牌 ⚒️ → 背包佩戴 🎒 → XP 加成叠加！
```

| 矿石 | 价格 | 合成 | XP 加成 |
|------|------|------|---------|
| 🪨 铜矿石 | 10G | 🥉 铜奖牌 | +2% |
| ⛏️ 铁矿石 | 30G | 🥈 铁奖牌 | +5% |
| 🥇 金矿石 | 100G | 🥇 金奖牌 | +10% |
| 💠 秘银矿石 | 300G | 💠 秘银奖牌 | +15% |
| 💎 金刚石 | 1000G | 💎 金刚石奖牌 | +25% |

所有佩戴的奖牌 **乘算叠加** — 戴 5 个 +2% 铜奖牌 = `1.02⁵ ≈ 1.104`，即 +10.4% XP。

### 🏆 成就 & 剧情
- **18 个成就** 自动解锁 ⚔️ — "初出茅庐"、"坚持 10 天"、"升至 10 级"...
- **6 章剧情** 📖 随进度触发 — 遇见 NPC，获得奖励
- **热力图** 🟩 像 GitHub 提交记录一样追踪你的活跃度
- **月度视图** 🗓️ 预览未来 30 天所有任务

### 🛡️ 策略建议
- 从**简单/中等**难度开始，别一上来就史诗
- **先合铜奖牌**（便宜，5 个矿石 → +2%）
- 每天至少完成一个 Habit，**保护 HP** 别归零
- **Plan** 给截止日期，**Habit** 给日常习惯

---

## 技术栈

- **前端**: Next.js 16 (App Router) + TypeScript + Tailwind CSS v4 + shadcn/ui
- **数据库**: SQLite (better-sqlite3) + Drizzle ORM
- **认证**: JWT (jose) + bcryptjs, httpOnly cookie
- **动画**: Framer Motion, canvas-confetti
- **部署**: pm2 + Cloudflare Tunnel

---

## 本地开发

```bash
npm install
cp .env.example .env
# 编辑 .env 设置 AUTH_PASSWORD 和 JWT_SECRET

npm run dev

# 首次运行 — 播种数据库
npx tsx drizzle/seed.ts
```

打开 `http://localhost:3000`，用 `.env` 中的密码登录。

---

## VPS 部署

Ubuntu 24.04，1 CPU / 1 GB RAM 实测通过。

### 0. 安装依赖

```bash
# Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
apt install -y nodejs

# pm2
npm install -g pm2

# Git
apt install -y git
```

### 1. 克隆仓库

```bash
cd /opt
git clone https://github.com/m2dumpling/LevelUpLife.git levelup-life
cd levelup-life
```

### 2. 创建 .env

```bash
cat > .env << EOF
AUTH_PASSWORD=$(openssl rand -base64 16)
JWT_SECRET=$(openssl rand -base64 32)
EOF
chmod 600 .env

# 记下密码
cat .env | grep AUTH_PASSWORD
```

### 3. 安装 & 构建

```bash
npm ci             # ⚠️ 不要用 --omit=dev，Tailwind/TypeScript 构建时需要
npm run build
```

### 4. 播种数据库

```bash
npx tsx drizzle/seed.ts
```

看到 `🎉 种子数据播种完成！` 即成功。seed 脚本自动加载 `.env`，无需手动 export。

### 5. 用 pm2 启动

```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup            # 开机自启
```

### 6. 验证

```bash
pm2 status
curl -I http://127.0.0.1:3000
# 返回 307 (重定向登录) 就是对的
```

### 7. Cloudflare Tunnel

**首次配置：**
```bash
# 安装 cloudflared
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 \
  -o /usr/local/bin/cloudflared
chmod +x /usr/local/bin/cloudflared

# 登录 — 会输出一个 URL，在你自己的浏览器（不是 VPS）打开授权
cloudflared tunnel login

# 创建隧道
cloudflared tunnel create levelup-life
```

然后去 Cloudflare 控制台：
1. **Zero Trust** → **Networks** → **Tunnels**
2. 点击刚创建的隧道 → **Configure**
3. **Public Hostname** 标签 → 添加：
   - **Subdomain**: `@`（或其他子域名）
   - **Domain**: 你的域名
   - **Type**: HTTP
   - **URL**: `localhost:3000`

**创建 systemd 服务：**
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
systemctl status cloudflared     # 确认运行
```

### 8. 防火墙

```bash
apt install -y ufw
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw --force enable
```

Tunnel 走出站连接，无需开放 80/443。

### 9. 登录使用

访问 `https://你的域名`，用步骤 2 的 `AUTH_PASSWORD` 登录。

---

## VPS 更新（~30s）

```bash
cd /opt/levelup-life
git pull origin main
npm run build                     # ~20s
pm2 reload ecosystem.config.cjs

# 仅当 drizzle/schema.ts 有改动时：
npx drizzle-kit push --force
```

或用一键脚本：`./update.sh`

---

## 常见问题

| 现象 | 解决 |
|------|------|
| 构建报错 `Cannot find module '@tailwindcss/postcss'` | `npm ci --omit=dev` 漏了构建依赖。重跑：`npm ci && npm run build` |
| seed 报 `AUTH_PASSWORD 未设置` | 拉最新代码（seed 脚本已支持自动加载 .env） |
| 浏览器 404 但 curl localhost 正常 | Cloudflare Tunnel 的 Public Hostname 没指向 `localhost:3000` |
| pm2 日志有 `next start` 警告 | 拉最新 `ecosystem.config.cjs`（已改用 `server.js`） |
| 页面能打开但没数据 | 没播种：`npx tsx drizzle/seed.ts` |
| `drizzle-kit push --forc` 报错 | 拼写错误，是 `--force`，不是 `--forc` |

---

## 项目结构

```
├── drizzle/                    # DB schema + 种子脚本
├── src/
│   ├── app/
│   │   ├── api/                # API: tasks, auth, shop, craft, inventory, logs
│   │   ├── login/              # 登录页
│   │   └── page.tsx            # 主面板
│   ├── components/
│   │   ├── TaskList.tsx        # 任务列表 + 创建/编辑/搜索/筛选
│   │   ├── TaskCard.tsx        # 任务卡片（完成/编辑/撤销/删除）
│   │   ├── Heatmap.tsx         # 热力图（周/月/年）
│   │   ├── MonthlyView.tsx     # 30 天任务预览
│   │   ├── Timeline.tsx        # 今日日志
│   │   ├── StatDashboard.tsx   # 状态面板（等级/金币/HP/连击）
│   │   ├── Navbar.tsx          # 导航栏
│   │   ├── ShopDialog.tsx      # 商店
│   │   ├── BackpackDialog.tsx  # 背包（矿石 + 奖牌佩戴）
│   │   ├── LevelUpModal.tsx    # 升级弹窗
│   │   └── ui/                 # shadcn/ui 组件
│   ├── hooks/
│   │   ├── useTasks.ts         # 任务 CRUD
│   │   └── useStats.ts         # 用户状态
│   └── lib/
│       ├── auth.ts             # JWT + bcrypt
│       ├── db.ts               # 数据库连接
│       ├── daily-settlement.ts # HP 每日结算引擎
│       ├── xp-calculator.ts    # XP/等级/奖牌加成计算
│       ├── shop-data.ts        # 矿石 & 奖牌配置
│       └── date-utils.ts       # 日期工具
├── ecosystem.config.cjs        # pm2 配置
├── update.sh                   # 一键更新脚本
└── .env.example
```
