// LevelUp Life v3.0 — 多用户 RPG 任务系统
//
// task.mode = "habit" → 日常任务 (Daily Quest)
// task.mode = "plan"  → 主线/支线任务 (Quest)

import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const user = sqliteTable("user", {
  id: integer("id").primaryKey(),
  name: text("name").notNull().default("勇者"),
  username: text("username").notNull().unique(),
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
  hpPenaltyActive: integer("hp_penalty_active", { mode: "boolean" }).notNull().default(false),
  role: text("role").notNull().default("user"),
  banned: integer("banned", { mode: "boolean" }).notNull().default(false),
  registerIp: text("register_ip"),
  registerCountry: text("register_country"),
  lastLoginIp: text("last_login_ip"),
  lastLoginCountry: text("last_login_country"),
  lastSettlementDate: text("last_settlement_date"),
  lastLoginDate: text("last_login_date"),
  city: text("city"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const task = sqliteTable("task", {
  id: integer("id").primaryKey(),
  userId: integer("user_id").notNull(),
  mode: text("mode", { enum: ["habit", "plan"] }).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  difficulty: text("difficulty", { enum: ["trivial", "easy", "medium", "hard", "heroic"] }).notNull().default("easy"),
  xpReward: integer("xp_reward").notNull(),
  goldReward: integer("gold_reward").notNull(),
  frequency: text("frequency", { enum: ["daily", "weekly", "monthly"] }).default("daily"),
  timeOfDay: text("time_of_day", { enum: ["morning", "afternoon", "evening", "anytime"] }).default("anytime"),
  frequencyDays: text("frequency_days"),
  reminderTime: text("reminder_time"),
  streakCount: integer("streak_count").notNull().default(0),
  bestStreak: integer("best_streak").notNull().default(0),
  targetDate: text("target_date"),
  status: text("status", { enum: ["pending", "in_progress", "completed", "failed"] }).default("pending"),
  startDate: text("start_date"),
  endDate: text("end_date"),
  dueDate: text("due_date"),
  completed: integer("completed", { mode: "boolean" }).notNull().default(false),
  completedAt: text("completed_at"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").notNull(),
});

export const habitLog = sqliteTable("habit_log", {
  id: integer("id").primaryKey(),
  userId: integer("user_id").notNull(),
  taskId: integer("task_id").notNull(),
  completedAt: text("completed_at").notNull(),
});

export const achievement = sqliteTable("achievement", {
  id: integer("id").primaryKey(),
  userId: integer("user_id").notNull(),
  key: text("key").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  icon: text("icon").notNull(),
  isHidden: integer("is_hidden", { mode: "boolean" }).notNull().default(true),
  unlocked: integer("unlocked", { mode: "boolean" }).notNull().default(false),
  unlockedAt: text("unlocked_at"),
});

export const storyEvent = sqliteTable("story_event", {
  id: integer("id").primaryKey(),
  userId: integer("user_id").notNull(),
  chapterKey: text("chapter_key").notNull(),
  triggerCondition: text("trigger_condition").notNull(),
  title: text("title").notNull(),
  dialogue: text("dialogue").notNull(),
  npcName: text("npc_name").notNull().default("神秘老人"),
  reward: text("reward"),
  isTriggered: integer("is_triggered", { mode: "boolean" }).notNull().default(false),
  triggeredAt: text("triggered_at"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const activityLog = sqliteTable("activity_log", {
  id: integer("id").primaryKey(),
  userId: integer("user_id").notNull(),
  taskId: integer("task_id"),
  taskTitle: text("task_title").notNull(),
  mode: text("mode", { enum: ["habit", "plan"] }).notNull(),
  xpEarned: integer("xp_earned").notNull(),
  goldEarned: integer("gold_earned").notNull(),
  completedAt: text("completed_at").notNull(),
  date: text("date").notNull(),
});

export const rewardLedger = sqliteTable("reward_ledger", {
  id: integer("id").primaryKey(),
  userId: integer("user_id").notNull(),
  taskId: integer("task_id").notNull(),
  completionKey: text("completion_key").notNull(),
  mode: text("mode", { enum: ["habit", "plan"] }).notNull(),
  taskTitle: text("task_title").notNull(),
  baseXp: integer("base_xp").notNull(),
  baseGold: integer("base_gold").notNull(),
  xpEarned: integer("xp_earned").notNull(),
  goldEarned: integer("gold_earned").notNull(),
  levelBefore: integer("level_before").notNull(),
  xpBefore: integer("xp_before").notNull(),
  xpToNextBefore: integer("xp_to_next_before").notNull(),
  goldBefore: integer("gold_before").notNull(),
  levelAfter: integer("level_after").notNull(),
  xpAfter: integer("xp_after").notNull(),
  xpToNextAfter: integer("xp_to_next_after").notNull(),
  goldAfter: integer("gold_after").notNull(),
  completedDate: text("completed_date").notNull(),
  createdAt: text("created_at").notNull(),
  reversedAt: text("reversed_at"),
});

export const inventory = sqliteTable("inventory", {
  id: integer("id").primaryKey(),
  userId: integer("user_id").notNull(),
  itemKey: text("item_key").notNull(),
  quantity: integer("quantity").notNull().default(0),
  equipped: integer("equipped", { mode: "boolean" }).notNull().default(false),
});

// ── 世界 BOSS ──
export const boss = sqliteTable("boss", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
  emoji: text("emoji").notNull().default("🐉"),
  hp: integer("hp").notNull(),
  maxHp: integer("max_hp").notNull(),
  weekStart: text("week_start").notNull(),
  defeated: integer("defeated", { mode: "boolean" }).notNull().default(false),
});

// ── BOSS 贡献记录 ──
export const bossContribution = sqliteTable("boss_contribution", {
  id: integer("id").primaryKey(),
  bossId: integer("boss_id").notNull(),
  userId: integer("user_id").notNull(),
  damage: integer("damage").notNull().default(0),
});

// ── 每日抽奖记录 ──
export const lotteryLog = sqliteTable("lottery_log", {
  id: integer("id").primaryKey(),
  userId: integer("user_id").notNull(),
  prize: text("prize").notNull(),
  date: text("date").notNull(),
});

// ── 基地建设 ──
export const village = sqliteTable("village", {
  id: integer("id").primaryKey(),
  userId: integer("user_id").notNull().unique(),
  stone: integer("stone").notNull().default(0),
  houses: integer("houses").notNull().default(1),
  library: integer("library").notNull().default(1),
  market: integer("market").notNull().default(1),
  fountain: integer("fountain").notNull().default(1),
  castle: integer("castle").notNull().default(1),
});

// ── 宠物 ──
export const pet = sqliteTable("pet", {
  id: integer("id").primaryKey(),
  userId: integer("user_id").notNull().unique(),
  petType: text("pet_type").notNull(),
  stage: integer("stage").notNull().default(0),
  hatchedAt: text("hatched_at"),
  fedToday: integer("fed_today", { mode: "boolean" }).notNull().default(false),
});

// ── 公会 ──
export const guild = sqliteTable("guild", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
  motto: text("motto").notNull().default(""),
  inviteCode: text("invite_code").notNull().unique(),
  leaderId: integer("leader_id").notNull(),
  hp: integer("hp").notNull().default(100),
  maxHp: integer("max_hp").notNull().default(100),
  createdAt: text("created_at").notNull(),
});

export const guildMember = sqliteTable("guild_member", {
  id: integer("id").primaryKey(),
  guildId: integer("guild_id").notNull(),
  userId: integer("user_id").notNull(),
  joinedAt: text("joined_at").notNull(),
});

export const guildChat = sqliteTable("guild_chat", {
  id: integer("id").primaryKey(),
  guildId: integer("guild_id").notNull(),
  userId: integer("user_id").notNull(),
  username: text("username").notNull(),
  message: text("message").notNull(),
  replyTo: integer("reply_to"),
  replyUsername: text("reply_username"),
  replyPreview: text("reply_preview"),
  createdAt: text("created_at").notNull(),
});

// ── 职业 ──
export const userClass = sqliteTable("user_class", {
  id: integer("id").primaryKey(),
  userId: integer("user_id").notNull().unique(),
  className: text("class_name").notNull(),
  assignedAt: text("assigned_at").notNull(),
});

// ── PvP ──
export const pvpMatch = sqliteTable("pvp_match", {
  id: integer("id").primaryKey(),
  type: text("type").notNull(),
  player1Id: integer("player1_id").notNull(),
  player2Id: integer("player2_id"),
  bet: integer("bet").notNull().default(20),
  winnerId: integer("winner_id"),
  status: text("status").notNull().default("waiting"),
  result: text("result"),
  createdAt: text("created_at").notNull(),
});

// ── 通用限速 ──
export const rateLimit = sqliteTable("rate_limit", {
  id: integer("id").primaryKey(),
  userId: integer("user_id").notNull(),
  actionType: text("action_type").notNull(),
  count: integer("count").notNull().default(0),
  windowStart: text("window_start").notNull(),
});

// ── 好友 ──
export const friend = sqliteTable("friend", {
  id: integer("id").primaryKey(),
  userId: integer("user_id").notNull(),
  friendId: integer("friend_id").notNull(),
  createdAt: text("created_at").notNull(),
});

export const friendChat = sqliteTable("friend_chat", {
  id: integer("id").primaryKey(),
  userId: integer("user_id").notNull(),
  friendId: integer("friend_id").notNull(),
  message: text("message").notNull(),
  createdAt: text("created_at").notNull(),
});

// ── 礼物记录 ──
export const giftLog = sqliteTable("gift_log", {
  id: integer("id").primaryKey(),
  fromUserId: integer("from_user_id").notNull(),
  toUserId: integer("to_user_id").notNull(),
  giftType: text("gift_type").notNull(),
  giftValue: text("gift_value").notNull(),
  date: text("date").notNull(),
});
