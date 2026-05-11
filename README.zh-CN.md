# LevelUp Life（升级人生）

个人 RPG 风格习惯追踪应用 —— 把日常任务变成冒险旅程。

> [English README](./README.md)

## 游戏机制

| 系统 | 说明 |
|------|------|
| **等级 (Level)** | 完成任务获得经验值，累积升级。`xpToNext = 100 × level^1.5` |
| **金币 (Gold)** | 完成任务获得金币，用于商店购买矿石 |
| **生命值 (HP)** | 每日有 HP，完成/跳过/失败任务影响 HP |
| **Habit（日常任务）** | 每日重复任务，通过打卡日志记录完成，支持连续天数追踪与最佳纪录 |
| **Plan（一次性任务）** | 一次性待办，可设置截止日期，状态流转：待开始→进行中→已完成/已失败 |
| **成就** | 18 个成就，部分隐藏，达成自动解锁 |
| **主线剧情** | 6 章剧情，根据进度自动触发 |
| **商店 & 合成** | 金币买矿石 → 矿石合奖牌 → 佩戴奖牌获得 XP 加成 |
| **热力图** | GitHub 风格贡献图，支持周/月/年三视图切换 |
| **月度视图** | 未来 30 天任务一览，展示所有计划中的 Habit 和 Plan |

### 任务难度

| 难度 | XP | 金币 |
|------|-----|------|
| 简单 (trivial) | 5 | 1 |
| 普通 (easy) | 10 | 3 |
| 中等 (medium) | 20 | 5 |
| 困难 (hard) | 40 | 10 |
| 史诗 (heroic) | 80 | 20 |

### 矿石 & 奖牌

| 矿石 | 价格 | 合成奖牌 | 所需数量 | 稀有度 | XP 加成 |
|------|------|----------|----------|--------|---------|
| 铜矿石 | 10G | 铜奖牌 | 5 | 普通 | +2% |
| 铁矿石 | 30G | 铁奖牌 | 5 | 罕见 | +5% |
| 金矿石 | 100G | 金奖牌 | 5 | 稀有 | +10% |
| 秘银矿石 | 300G | 秘银奖牌 | 3 | 史诗 | +15% |
| 精金矿石 | 1000G | 精金奖牌 | 3 | 传说 | +25% |

奖牌佩戴后显示在页面左上角标题旁，按稀有度排列。多个奖牌 XP 加成乘法叠加。

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
# 安装依赖
npm install

# 复制环境变量模板
cp .env.example .env
# 编辑 .env，设置开发用密码

# 启动开发服务器
npm run dev

# 运行数据库种子（首次需要）
npx tsx drizzle/seed.ts
```

打开 `http://localhost:3000`，用 `.env` 中设置的密码登录。

---

## VPS 部署（Docker + Cloudflare Tunnel）

### 前提条件

- 一台 VPS（1C 1G 即可）
- 一个域名，DNS 托管在 Cloudflare
- VPS 已安装 Docker

### 第一步：克隆项目

```bash
cd /opt
git clone https://github.com/m2dumpling/LevelUpLife.git levelup-life
cd levelup-life
```

### 第二步：创建 .env 文件

```bash
cat > .env << EOF
AUTH_PASSWORD=$(openssl rand -base64 16)
JWT_SECRET=$(openssl rand -base64 32)
EOF
chmod 600 .env

# 记下密码（用于登录网页）
cat .env | grep AUTH_PASSWORD
```

### 第三步：构建并启动容器

```bash
docker compose up -d --build
```

### 第四步：运行数据库种子脚本

```bash
docker exec -it levelup-life npx tsx drizzle/seed.ts
```

看到 `🎉 种子数据播种完成！` 即完成。

### 第五步：验证容器运行

```bash
docker ps | grep levelup
curl -I http://127.0.0.1:3000
```

### 第六步：配置 Cloudflare Tunnel

在 Cloudflare Dashboard 中：
1. 进入 **Zero Trust** → **Networks** → **Tunnels**
2. 点击 **Create a tunnel**，命名（如 `levelup-life`）
3. 选择环境 **Docker**，复制安装命令中 `docker run` 的 token 部分

回到 VPS：

```bash
docker run -d \
  --name cloudflare-tunnel \
  --restart unless-stopped \
  --network host \
  cloudflare/cloudflared:latest tunnel \
  --no-autoupdate run \
  --token YOUR_TUNNEL_TOKEN
```

然后在 Cloudflare Tunnel 配置页面添加 **Public Hostname**：
- **Subdomain**: `@`（或你想要的子域名）
- **Domain**: 你的域名
- **Service**: `http://localhost:3000`

保存后访问 `https://你的域名` 即可。

### 第七步：防火墙加固

```bash
apt install -y ufw
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
# 不需要开放 80/443 —— Tunnel 是出站连接
ufw --force enable
ufw status verbose
```

---

## 更新部署

```bash
cd /opt/levelup-life
git pull origin main
docker compose up -d --build
```

---

## 项目结构

```
├── drizzle/                 # 数据库 schema、迁移、种子脚本
├── src/
│   ├── app/
│   │   ├── api/             # API 路由 (tasks, auth, shop, craft, inventory, logs)
│   │   ├── login/           # 登录页面
│   │   ├── layout.tsx       # 根布局
│   │   └── page.tsx         # 主页面（仪表盘）
│   ├── components/          # React 组件
│   │   ├── Navbar.tsx       # 导航栏 + 奖牌展示
│   │   ├── StatDashboard.tsx     # 状态面板（等级/金币/HP/连续天数）
│   │   ├── TaskList.tsx     # Habit/Plan 切换 + 任务管理
│   │   ├── TaskCard.tsx     # 单条任务卡片
│   │   ├── Heatmap.tsx      # 贡献热力图（周/月/年切换）
│   │   ├── MonthlyView.tsx  # 未来 30 天任务一览
│   │   ├── Timeline.tsx     # 近期活动日志
│   │   ├── ShopDialog.tsx   # 矿石商店对话框
│   │   ├── BackpackDialog.tsx    # 背包 & 合成对话框
│   │   ├── LevelUpModal.tsx      # 升级庆祝弹窗
│   │   ├── AchievementPopup.tsx  # 成就解锁弹窗
│   │   ├── StoryDialog.tsx       # 剧情事件对话框
│   │   ├── FloatingNumber.tsx    # XP/金币飘字动画
│   │   └── ui/              # shadcn/ui 基础组件
│   ├── hooks/               # 自定义 Hook
│   │   ├── useTasks.ts      # 任务 CRUD + 状态管理
│   │   └── useStats.ts      # 用户状态
│   ├── lib/                 # 工具库
│   │   ├── auth.ts          # JWT + bcrypt 认证
│   │   ├── db.ts            # 数据库连接
│   │   ├── xp-calculator.ts      # 经验值/金币计算 + 奖牌加成
│   │   ├── shop-data.ts     # 矿石/奖牌配置
│   │   ├── date-utils.ts    # 日期格式化工具
│   │   └── seed-data.ts     # 预设成就/剧情
│   └── middleware.ts         # 路由鉴权守卫
├── Dockerfile
├── docker-compose.yml
└── .env.example
```
