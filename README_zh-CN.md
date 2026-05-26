# LevelUp Life — 将日常任务变成 RPG 冒险

完成任务赚 XP/金币，升级变强。

> [English](./README.md) | [Android App 📱](https://github.com/m2dumpling/LevelUpLife-App) | 部署在 Cloudflare Tunnel

---

## 🎮 玩法指南

你是勇者。每养成一个习惯、完成一个目标，就是 XP。升级。买装备。打败拖延大魔王。

### 📋 两种任务类型

| | Habit 🔥 | Plan 📋 |
|------|---------|------|
| **干什么** | 每日修行：运动、阅读、冥想、喝水... | 一次性任务："周五前提交报告" |
| **何时** | 每天/每周/每月，可选指定星期几 | 你选的执行日期 |
| **奖励** | 每次打卡 ✅ 赚 XP + 金币 | 到期日完成 → 大额奖励 |

点击 **+ 新建** → 选难度 → 预览 → 确认创建。点圆圈 ○ 打卡，看 XP 数字飘起。

### 📈 升级体系

> 琐碎 5XP · 简单 10XP · 中等 20XP · 困难 40XP · 史诗 80XP

公式：`xpToNext = 100 × 等级^1.5`。1→2 级只需 100 XP。50→51 级需要 35000+。越来越难，越来越爽。

### 💀 HP 惩罚机制

初始 **100 HP ❤️**。每天漏掉一个 Habit → **扣 5 HP**。HP 归零 → **XP 收益 -10%**，你被削弱了。

每天登录自动恢复 **+20 HP**。游戏惩罚懒惰，奖励坚持。

| HP | 状态 |
|----|------|
| > 0 | 正常 — 满额 XP |
| 0 💀 | 虚弱 — **XP -10%** |

### ⚒️ 商店 → 合成 → 佩戴 → 叠加

金币不是摆设。花掉它：

```
商店 🏪 → 买矿石 → 合成 ⚒️ → 锻造奖牌 → 佩戴 🎒 → XP 加成层层叠加
```

| 矿石 | 价格 | 奖牌 | 稀有度 | XP 加成 |
|------|------|------|--------|---------|
| 🪨 铜矿石 | 10G | 🥉 铜奖牌 | 普通 | +2% |
| ⛏️ 铁矿石 | 30G | 🥈 铁奖牌 | 罕见 | +5% |
| 🥇 金矿石 | 100G | 🥇 金奖牌 | 稀有 | +10% |
| 💠 秘银矿石 | 300G | 💠 秘银奖牌 | 史诗 | +15% |
| 💎 金刚石 | 1000G | 💎 金刚石奖牌 | 传说 | +25% |

奖牌**乘算叠加**。五枚铜奖牌 = 1.02⁵ ≈ **+10.4% XP**。精打细算，收益翻倍。

### 🏆 成就 & 剧情
- **18 个成就** ⚔️ — 从"初出茅庐"到"任务之王"，部分隐藏等你发现
- **6 章剧情** 📖 带 NPC 对话和奖励，随进度触发
- **热力图** 🟩 GitHub 风格，一眼看出哪天摸鱼了
- **月度视图** 🗓️ 未来 30 天任务一览

### ⚔️ PvP 竞技场 — 挑战其他勇者
实时对战，胜者赢走奖池（扣除 2G 税收）。

| 模式 | 玩法 |
|------|------|
| ✊ 石头剪刀布 | 双方各自出拳 → 揭示 → 动画对决判定胜负 |
| 🎲 骰子对决 | 各掷一个 D20，点数大者获胜。平局重掷（最多 3 次） |
| ⏱ 速算对决 | 抢答数学题，正确且速度快者获胜 |

- 创建对决，赌注 10–500G
- 加入其他玩家的等待对决
- 实时轮询反馈对手操作
- 每日上限 10 次
- 入场条件：今天至少完成 1 个任务

### 🎰 每日抽奖
完成 3 个以上 Habit → 免费抽一次！赢奖牌、金币、稀有道具。

### 🐲 世界 Boss
每次完成任务对共享 Boss 造成伤害。全服合力击杀，全员获得奖励。

### 🏰 公会大厅 — 并肩作战
- 创建或加入公会（6 位邀请码）
- **全屏 Discord 风聊天室** `/chat`，彩色头像、消息分组、北京时间显示
- 公会 HP 条 — 成员漏任务会扣血
- **公会排行榜** 按总 XP 排名
- 会长可踢人，成员可退出

### 🐾 宠物系统
任务奖励孵出宠物蛋。每只宠物提供被动加成（XP 加成、HP 恢复、额外金币）。

### 🏡 村庄建设
打造你的村庄！每次完成任务贡献资源，解锁建筑获得永久加成。

### 🌦 天气系统
动态天气影响任务奖励 — 晴天 XP 加成，暴风雨挑战升级。面板上查看天气徽章。

### 🎭 职业系统
任务历史决定你的职业（战士、法师、盗贼等），各有独特加成。

### 🔒 多用户 + 管理员面板
- **注册/登录** — 任何人可创建账号（用户名 + 密码）
- **管理后台** `/admin` — 用户统计、注册趋势、国家分布
- 内容审计标记可疑任务标题
- 封禁/解封用户、导出数据、下载数据库备份
- 仅 seed 创建的 `admin` 账号可访问，无法提权

---

## 📱 还有 Android 版

想要真正的到点提醒？下载 **[LevelUp Life Android App →](https://github.com/m2dumpling/LevelUpLife-App)** — 同样的游戏体验，原生闹钟通知，完全离线可用。

---

## 🛠 技术栈

Next.js 16 · TypeScript · Tailwind CSS v4 · shadcn/ui · SQLite · Drizzle ORM · JWT + bcrypt · Framer Motion · pm2 · Cloudflare Tunnel

---

## 🖥 本地开发

```bash
npm install
cp .env.example .env          # 设置 AUTH_PASSWORD 和 JWT_SECRET
npx drizzle-kit push --force  # 同步 SQLite schema
npm run dev
npx tsx drizzle/seed.ts       # 首次运行播种
```

打开 `http://localhost:3000`，用 `.env` 中的密码登录。

---

## ☁️ VPS 部署

Ubuntu 24.04，1 CPU / 1 GB RAM 实测通过。月费约 $4。

### 0. 安装依赖

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
apt install -y nodejs git
npm install -g pm2
```

### 1. 克隆仓库

```bash
cd /opt
git clone https://github.com/m2dumpling/LevelUpLife.git levelup-life
cd levelup-life
```

### 2. 创建密钥

```bash
cat > .env << EOF
AUTH_PASSWORD=$(openssl rand -base64 16)
JWT_SECRET=$(openssl rand -base64 32)
EOF
chmod 600 .env
cat .env | grep AUTH_PASSWORD    # ← 记下密码！
```

### 3. 构建

```bash
npm ci                          # ⚠️ 不要加 --omit=dev，Tailwind 构建需要
npx drizzle-kit push --force
npm run build
npx tsx drizzle/seed.ts         # 看到 🎉 种子数据播种完成！即可
```

### 4. 启动

```bash
pm2 start ecosystem.config.cjs
pm2 save && pm2 startup         # 开机自启
curl -I http://127.0.0.1:3000   # → 307 就是对的
```

### 5. Cloudflare Tunnel

```bash
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 \
  -o /usr/local/bin/cloudflared && chmod +x /usr/local/bin/cloudflared

cloudflared tunnel login         # 打印的 URL 在你自己浏览器打开
cloudflared tunnel create levelup-life
```

Cloudflare 控制台 → **Zero Trust** → **Networks** → **Tunnels** → 配置 → **Public Hostname**:
- Domain: 你的域名 → Type: HTTP → URL: `localhost:3000`

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

### 6. 防火墙

```bash
apt install -y ufw
ufw default deny incoming && ufw default allow outgoing
ufw allow 22/tcp && ufw --force enable
```

Tunnel 走出站连接，无需开放 80/443。

### 7. 完成

访问 `https://你的域名`，用 `AUTH_PASSWORD` 登录。

---

## 🔄 更新

```bash
cd /opt/levelup-life
./update.sh                     # 一键：pull → build → restart
```

手动更新：

```bash
git pull origin main
npm ci                            # package-lock 有变化时执行
npm run build                     # ~20s
npx drizzle-kit push --force      # 本次新增/更新 reward_ledger 等 schema 时必须执行
pm2 reload ecosystem.config.cjs
```

---

## 🩹 常见问题

| 现象 | 解决 |
|------|------|
| 构建报错 `Cannot find module @tailwindcss/postcss` | `npm ci --omit=dev` 把 dev 依赖删了。重跑 `npm ci && npm run build` |
| seed 报 `AUTH_PASSWORD 未设置` | 拉最新代码，seed 脚本已支持自动加载 `.env` |
| 浏览器 404 但 curl 正常 | Cloudflare Tunnel 的 Public Hostname 没指向 `localhost:3000` |
| pm2 日志有 `next start` 警告 | 拉最新 `ecosystem.config.cjs`，已改用 `server.js` |
| 页面能打开但没数据 | 没播种：`npx tsx drizzle/seed.ts` |
| `drizzle-kit push --forc` 报错 | 拼写错误，是 `--force` 不是 `--forc` |

---

## 📁 项目结构

```
├── drizzle/                    # DB schema + 种子
├── src/
│   ├── app/
│   │   ├── api/                # REST: tasks, auth, shop, craft, inventory, logs
│   │   └── login/              # 登录页
│   ├── components/
│   │   ├── TaskList.tsx        # 任务列表 + 创建/编辑/搜索/筛选
│   │   ├── TaskCard.tsx        # 任务卡片（打卡/编辑/撤销/删除）
│   │   ├── StatDashboard.tsx   # 状态面板（等级/金币/HP/连击）
│   │   ├── Heatmap.tsx         # 热力图（周/月/年）
│   │   ├── MonthlyView.tsx     # 30 天任务预览
│   │   ├── Timeline.tsx        # 今日日志
│   │   ├── ShopDialog.tsx      # 矿石商店
│   │   ├── BackpackDialog.tsx  # 背包 + 奖牌佩戴
│   │   └── LevelUpModal.tsx    # 升级弹窗
│   ├── hooks/                  # useTasks, useStats
│   └── lib/                    # auth, db, xp-calc, shop-data, date-utils
├── ecosystem.config.cjs        # pm2 配置
├── update.sh                   # 一键更新脚本
└── .env.example
```
