// LevelUp Life v2.0 — RPG 任务系统重构
//
// task.mode = "habit" → 日常任务 (Daily Quest)
// task.mode = "plan"  → 主线/支线任务 (Quest)

import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const user = sqliteTable("user", {
  id: integer("id").primaryKey(),
  name: text("name").notNull().default("勇者"),
  passwordHash: text("password_hash").notNull(),
  level: integer("level").notNull().default(1),
  xp: integer("xp").notNull().default(0),
  xpToNext: integer("xp_to_next").notNull().default(100),
  gold: integer("gold").notNull().default(0),
  hp: integer("hp").notNull().default(100),
  maxHp: integer("max_hp").notNull().default(100),
  totalDays: integer("total_days").notNull().default(1),
  streakDays: integer("streak_days").notNull().default(0),
  bestStreak: integer("best_streak").notNull().default(0),
  storyProgress: text("story_progress").notNull().default("chapter_0"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const task = sqliteTable("task", {
  id: integer("id").primaryKey(),
  mode: text("mode", { enum: ["habit", "plan"] }).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  // ── 难度（决定 XP/金币奖励基数）──
  difficulty: text("difficulty", {
    enum: ["trivial", "easy", "medium", "hard", "heroic"],
  })
    .notNull()
    .default("easy"),
  xpReward: integer("xp_reward").notNull(),
  goldReward: integer("gold_reward").notNull(),
  // ── 日常任务 (mode=habit) 专属字段 ──
  frequency: text("frequency", {
    enum: ["daily", "weekly", "monthly"],
  }).default("daily"),
  timeOfDay: text("time_of_day", {
    enum: ["morning", "afternoon", "evening", "anytime"],
  }).default("anytime"),
  streakCount: integer("streak_count").notNull().default(0),
  bestStreak: integer("best_streak").notNull().default(0),
  // ── 主线/支线任务 (mode=plan) 专属字段 ──
  startDate: text("start_date"),
  dueDate: text("due_date"),
  status: text("status", {
    enum: ["pending", "in_progress", "completed", "failed"],
  }).default("pending"),
  // ── 通用 ──
  completed: integer("completed", { mode: "boolean" }).notNull().default(false),
  completedAt: text("completed_at"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").notNull(),
});

/** 日常任务打卡日志：每次打卡一条记录 */
export const habitLog = sqliteTable("habit_log", {
  id: integer("id").primaryKey(),
  taskId: integer("task_id").notNull(),
  completedAt: text("completed_at").notNull(),
});

export const achievement = sqliteTable("achievement", {
  id: integer("id").primaryKey(),
  key: text("key").notNull().unique(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  icon: text("icon").notNull(),
  isHidden: integer("is_hidden", { mode: "boolean" }).notNull().default(true),
  unlocked: integer("unlocked", { mode: "boolean" }).notNull().default(false),
  unlockedAt: text("unlocked_at"),
});

export const storyEvent = sqliteTable("story_event", {
  id: integer("id").primaryKey(),
  chapterKey: text("chapter_key").notNull(),
  triggerCondition: text("trigger_condition").notNull(),
  title: text("title").notNull(),
  dialogue: text("dialogue").notNull(),
  npcName: text("npc_name").notNull().default("神秘老人"),
  reward: text("reward"),
  isTriggered: integer("is_triggered", { mode: "boolean" })
    .notNull()
    .default(false),
  triggeredAt: text("triggered_at"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const activityLog = sqliteTable("activity_log", {
  id: integer("id").primaryKey(),
  taskId: integer("task_id"),
  taskTitle: text("task_title").notNull(),
  mode: text("mode", { enum: ["habit", "plan"] }).notNull(),
  xpEarned: integer("xp_earned").notNull(),
  goldEarned: integer("gold_earned").notNull(),
  completedAt: text("completed_at").notNull(),
  date: text("date").notNull(),
});

export const inventory = sqliteTable("inventory", {
  id: integer("id").primaryKey(),
  itemKey: text("item_key").notNull().unique(),
  quantity: integer("quantity").notNull().default(0),
  equipped: integer("equipped", { mode: "boolean" }).notNull().default(false),
});
