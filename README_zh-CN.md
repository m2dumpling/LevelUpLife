# LevelUp Life

将日常任务变成 RPG 冒险 — 完成任务赚 XP/金币，升级变强。

> [English](./README.md) | 部署到了 Cloudflare Tunnel

## 游戏系统

| 系统 | 说明 |
|------|------|
| **等级** | 完成任务赚 XP，升级公式 `xpToNext = 100 × level^1.5` |
| **金币** | 完成任务赚金币，在商店消费 |
| **HP 惩罚** | 每天未完成 Habit 扣 5HP，HP=0 时 XP 收益 -10% |
| **Habit** | 每日/每周/每月重复任务；支持星期多选（周一二三）；连击天数 + 最佳纪录 |
| **Plan** | 一次性任务，指定执行日期，过期自动标记失败 |
| **搜索筛选** | 客户端实时过滤 — 标题/描述搜索 + 难度筛选 + 状态筛选 |
| **二次确认** | 创建任务需预览确认，防止误操作 |
| **编辑** | 点击 ✏️ 图标编辑任务，一步保存 |
| **撤销完成** | 已完成任务可撤销恢复 |
| **成就** | 18 个成就，部分隐藏，满足条件自动解锁 |
| **剧情** | 6 章故事线，随进度触发 |
| **商店 & 合成** | 金币买矿石 → 合成奖牌 → 佩戴叠加 XP 加成 |
| **Heatmap** | GitHub 风格热力图，周/月/年切换 |
| **月度视图** | 未来 30 天任务一览 |

### 难度奖励

| 难度 | XP | 金币 |
|------|-----|------|
| 琐碎 | 5 | 1 |
| 简单 | 10 | 3 |
| 中等 | 20 | 5 |
| 困难 | 40 | 10 |
| 史诗 | 80 | 20 |

### 矿石 & 奖牌

| 矿石 | 价格 | 合成奖牌 | 所需数量 | 稀有度 | XP 加成 |
|------|------|---------|---------|--------|---------|
| 铜矿石 | 10G | 铜奖牌 | 5 | 普通 | +2% |
| 铁矿石 | 30G | 铁奖牌 | 5 | 罕见 | +5% |
| 金矿石 | 100G | 金奖牌 | 5 | 稀有 | +10% |
| 秘银矿石 | 300G | 秘银奖牌 | 3 | 史诗 | +15% |
| 金刚石 | 1000G | 金刚石奖牌 | 3 | 传说 | +25% |

佩戴奖牌显示在导航栏，按稀有度排序，XP 加成累乘。

---

## 技术栈

- **前端**: Next.js 16 (App Router) + TypeScript + Tailwind CSS v4 + shadcn/ui
- **数据库**: SQLite (better-sqlite3) + Drizzle ORM
- **认证**: JWT (jose) + bcryptjs, httpOnly cookie
- **动画**: Framer Motion, canvas-confetti
- **部署**: Docker + Cloudflare Tunnel

---

## 本地开发

```bash
npm install
cp .env.example .env
# 编辑 .env 设置密码

npm run dev
npx tsx drizzle/seed.ts   # 首次运行
```

打开 `http://localhost:3000`，用 `.env` 中的密码登录。

---

## VPS 部署 (pm2 + Cloudflare Tunnel)

### 前提

- 一台 VPS（1 CPU / 1 GB RAM 足够）
- 域名 DNS 托管在 Cloudflare
- Node.js 22+ 和 pm2

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
apt install -y nodejs
npm install -g pm2
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

### 3. 安装构建

```bash
npm ci --omit=dev
npm run build
```

### 4. 播种数据库

```bash
npx tsx drizzle/seed.ts
```

看到 `🎉 种子数据播种完成！` 即成功。

### 5. 用 pm2 启动

```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup   # 开机自启
```

### 6. 验证

```bash
pm2 status
curl -I http://127.0.0.1:3000
```

### 7. Cloudflare Tunnel（独立二进制，无需 Docker）

```bash
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /usr/local/bin/cloudflared
chmod +x /usr/local/bin/cloudflared

cloudflared tunnel login
cloudflared tunnel create levelup-life

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
```

Cloudflare 控制台 → **Zero Trust** → **Networks** → **Tunnels**，添加 Public Hostname 指向 `http://localhost:3000`。

### 8. 防火墙

```bash
apt install -y ufw
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw --force enable
```

---

## VPS 更新（~30s）

```bash
cd /opt/levelup-life
./update.sh
```

或手动：

```bash
cd /opt/levelup-life
git pull origin main
npm run build
pm2 reload ecosystem.config.cjs
```

如果 `drizzle/schema.ts` 有改动，额外执行：

```bash
npx drizzle-kit push --force
```

---

## 项目结构

```
├── drizzle/                  # DB schema + 种子脚本
├── src/
│   ├── app/
│   │   ├── api/              # API: tasks, auth, shop, craft, inventory, logs
│   │   ├── login/            # 登录页
│   │   └── page.tsx          # 主面板
│   ├── components/
│   │   ├── TaskList.tsx      # 任务列表 + 创建/编辑/搜索/筛选
│   │   ├── TaskCard.tsx      # 任务卡片（完成/编辑/撤销/删除）
│   │   ├── Heatmap.tsx       # 热力图（周/月/年）
│   │   ├── MonthlyView.tsx   # 30 天任务预览
│   │   ├── Timeline.tsx      # 今日日志
│   │   ├── StatDashboard.tsx # 状态面板（等级/金币/HP/连击）
│   │   ├── Navbar.tsx        # 导航栏
│   │   ├── ShopDialog.tsx    # 商店
│   │   ├── BackpackDialog.tsx # 背包（矿石 + 奖牌佩戴）
│   │   ├── LevelUpModal.tsx  # 升级弹窗
│   │   ├── AchievementPopup.tsx # 成就弹窗
│   │   └── ui/               # shadcn/ui 组件
│   ├── hooks/
│   │   ├── useTasks.ts       # 任务 CRUD
│   │   └── useStats.ts       # 用户状态
│   └── lib/
│       ├── auth.ts           # JWT + bcrypt
│       ├── db.ts             # 数据库连接
│       ├── daily-settlement.ts # HP 每日结算引擎
│       ├── xp-calculator.ts  # XP/等级/奖牌加成计算
│       ├── shop-data.ts      # 矿石 & 奖牌配置
│       └── date-utils.ts     # 日期工具
├── ecosystem.config.cjs   # pm2 配置
├── update.sh              # 一键更新脚本
```
