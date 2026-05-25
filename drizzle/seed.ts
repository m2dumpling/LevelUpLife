/**
 * 数据库种子脚本
 * 初始化成就 + 主线剧情 + 默认用户
 * 运行: npx tsx drizzle/seed.ts
 */

// 加载 .env 文件（seed 脚本不经过 Next.js，需手动加载）
import { readFileSync } from "fs";
import { resolve } from "path";
const envPath = resolve(process.cwd(), ".env");
try {
  const envContent = readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  }
} catch {}

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import { hashPassword } from "../src/lib/auth";
import { SEED_ACHIEVEMENTS, SEED_STORY_EVENTS } from "../src/lib/seed-data";

const dbPath = process.env.DATABASE_PATH || "./data/levelup.db";

// 确保 data 目录存在
import { mkdirSync } from "fs";
import { dirname } from "path";
mkdirSync(dirname(dbPath), { recursive: true });

const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

const db = drizzle(sqlite, { schema });

async function seed() {
  console.log("🌱 开始播种数据...\n");

  // ─── 创建默认用户 ───
  const existingUser = db.select().from(schema.user).get();
  if (!existingUser) {
    const password = process.env.AUTH_PASSWORD;
    if (!password || password === "your-secret-password") {
      console.error(
        "❌ AUTH_PASSWORD 环境变量未设置！请先设置: export AUTH_PASSWORD=你的密码"
      );
      process.exit(1);
    }
    const hashed = await hashPassword(password);

    db.insert(schema.user)
      .values({
        name: "系统管理员",
        username: "admin",
        role: "admin",
        passwordHash: hashed,
        level: 1,
        xp: 0,
        xpToNext: 100,
        gold: 0,
        hp: 100,
        maxHp: 100,
        totalDays: 1,
        streakDays: 0,
        bestStreak: 0,
        storyProgress: "chapter_0",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .run();

    console.log("  ✅ 默认用户「勇者」已创建");
  } else {
    console.log("  ⏭️ 用户已存在，跳过");
  }

  // ─── 播入成就 ───
  const existingAchievements = db.select().from(schema.achievement).all();
  const existingKeys = new Set(existingAchievements.map((a) => a.key));

  let achievementsInserted = 0;
  for (const ach of SEED_ACHIEVEMENTS) {
    if (!existingKeys.has(ach.key)) {
      db.insert(schema.achievement)
        .values({
          userId: 1,
          key: ach.key,
          title: ach.title,
          description: ach.description,
          icon: ach.icon,
          isHidden: ach.isHidden,
          unlocked: false,
        })
        .run();
      achievementsInserted++;
    }
  }
  console.log(`  ✅ 成就: 新增 ${achievementsInserted} 个，共 ${SEED_ACHIEVEMENTS.length} 个`);

  // ─── 播入主线剧情 ───
  const existingStoryEvents = db.select().from(schema.storyEvent).all();
  const existingChapterKeys = new Set(existingStoryEvents.map((e) => e.chapterKey));

  let storiesInserted = 0;
  for (const event of SEED_STORY_EVENTS) {
    if (!existingChapterKeys.has(event.chapterKey)) {
      db.insert(schema.storyEvent)
        .values({
          userId: 1,
          chapterKey: event.chapterKey,
          triggerCondition: event.triggerCondition,
          title: event.title,
          dialogue: event.dialogue,
          npcName: event.npcName,
          reward: event.reward,
          isTriggered: false,
          sortOrder: event.sortOrder,
        })
        .run();
      storiesInserted++;
    }
  }
  console.log(
    `  ✅ 主线剧情: 新增 ${storiesInserted} 章，共 ${SEED_STORY_EVENTS.length} 章`
  );

  console.log("\n🎉 种子数据播种完成！");
}

seed().catch((e) => {
  console.error("播种失败:", e);
  process.exit(1);
});
