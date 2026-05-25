/**
 * 职业系统 — 职业分析器
 *
 * assignClass(userId): 每周一根据过去 7 天行为分配职业
 * getClassBonus(userId, taskMode, taskDifficulty, timeOfDay): 获取职业加成
 */

import { db, schema } from "@/lib/db";
import { eq, and, gte } from "drizzle-orm";
import { getDaysAgoLocal, getTodayLocal } from "@/lib/date-utils";

// ── 职业定义 ──
interface ClassDef {
  name: string;
  emoji: string;
  xpBonus: number;
  goldBonus: number;
}

const CLASSES: Record<string, ClassDef> = {
  dawn_knight: { name: "黎明骑士", emoji: "🌅", xpBonus: 0.15, goldBonus: 0 },
  monk: { name: "武僧", emoji: "🏃", xpBonus: 0.15, goldBonus: 0 },
  scholar: { name: "学者", emoji: "📚", xpBonus: 0.15, goldBonus: 0 },
  mercenary: { name: "佣兵", emoji: "⚔️", xpBonus: 0, goldBonus: 0.10 },
  flame_walker: { name: "烈焰行者", emoji: "🔥", xpBonus: 0.10, goldBonus: 0 },
  druid: { name: "德鲁伊", emoji: "🌿", xpBonus: 0.05, goldBonus: 0 },
  adventurer: { name: "冒险者", emoji: "🗡️", xpBonus: 0, goldBonus: 0 },
};

// ── 关键词判定 ──
const EXERCISE_KEYWORDS = [
  "运动", "跑步", "健身", "锻炼", "游泳",
];
const STUDY_KEYWORDS = [
  "阅读", "学习", "读书", "背单词",
];

// ── 分析并分配职业 ──
export function assignClass(userId: number): void {
  const today = getTodayLocal();
  const sevenDaysAgo = getDaysAgoLocal(7);

  // 获取最近 7 天完成记录
  const completions = db
    .select()
    .from(schema.activityLog)
    .where(
      and(
        eq(schema.activityLog.userId, userId),
        gte(schema.activityLog.date, sevenDaysAgo)
      )
    )
    .all();

  if (completions.length === 0) {
    // 没有近期记录，保持当前职业或设为冒险者
    upsertClass(userId, "adventurer");
    return;
  }

  // 获取关联的 task 信息用于 timeOfDay
  const taskIds = [...new Set(completions.map((c) => c.taskId))];
  const tasks = db
    .select()
    .from(schema.task)
    .where(and(eq(schema.task.userId, userId)))
    .all();
  const taskMap = new Map(tasks.map((t) => [t.id, t]));

  const total = completions.length;

  // 1. 早晨习惯 > 60%
  const morningCompletions = completions.filter((c) => {
    if (c.taskId == null) return false;
    const t = taskMap.get(c.taskId);
    return t?.timeOfDay === "morning";
  });
  if (morningCompletions.length / total > 0.6) {
    upsertClass(userId, "dawn_knight");
    return;
  }

  // 2. 运动类标题 > 50%
  const exerciseCompletions = completions.filter((c) =>
    EXERCISE_KEYWORDS.some((kw) => c.taskTitle.includes(kw))
  );
  if (exerciseCompletions.length / total > 0.5) {
    upsertClass(userId, "monk");
    return;
  }

  // 3. 学习类标题 > 50%
  const studyCompletions = completions.filter((c) =>
    STUDY_KEYWORDS.some((kw) => c.taskTitle.includes(kw))
  );
  if (studyCompletions.length / total > 0.5) {
    upsertClass(userId, "scholar");
    return;
  }

  // 4. 完成的 plan 占比 > 60%
  const planCompletions = completions.filter((c) => c.mode === "plan");
  const totalPlans = tasks.filter((t) => t.mode === "plan").length;
  if (totalPlans > 0 && planCompletions.length / totalPlans > 0.6) {
    upsertClass(userId, "mercenary");
    return;
  }

  // 5. heroic 难度 > 30%
  const heroicCompletions = completions.filter((c) => {
    if (c.taskId == null) return false;
    const t = taskMap.get(c.taskId);
    return t?.difficulty === "heroic";
  });
  if (heroicCompletions.length / total > 0.3) {
    upsertClass(userId, "flame_walker");
    return;
  }

  // 6. 完成率 > 90% 但人均 XP < 30
  const completionRate = total / (total + 0); // 此时 totalPlans 无法计算完成率，用另一个方式
  const avgXp = completions.reduce((sum, c) => sum + c.xpEarned, 0) / total;
  // 重新计算：获取有效统计
  const allRecentTasks = db
    .select()
    .from(schema.task)
    .where(
      and(
        eq(schema.task.userId, userId),
        gte(schema.task.createdAt, sevenDaysAgo)
      )
    )
    .all();
  const habitTasks = tasks.filter((t) => t.mode === "habit");
  const planTasks = tasks.filter((t) => t.mode === "plan");
  const effectiveCompletions = completions.filter((c) => c.mode === "habit" || c.mode === "plan");
  const totalHabitInstances = habitTasks.length; // 每个 habit 每天一次，7天
  const totalPossible = totalHabitInstances * 7 + planTasks.length;
  const actualCompleted = effectiveCompletions.length;
  const rate = totalPossible > 0 ? actualCompleted / totalPossible : 0;

  if (rate > 0.9 && avgXp < 30) {
    upsertClass(userId, "druid");
    return;
  }

  // 7. 默认：保持当前职业或冒险者
  const existing = db
    .select()
    .from(schema.userClass)
    .where(eq(schema.userClass.userId, userId))
    .get();
  if (existing) {
    // 保持当前职业
    return;
  }
  upsertClass(userId, "adventurer");
}

function upsertClass(userId: number, classKey: string): void {
  const def = CLASSES[classKey];
  if (!def) return;

  const existing = db
    .select()
    .from(schema.userClass)
    .where(eq(schema.userClass.userId, userId))
    .get();

  if (existing) {
    db.update(schema.userClass)
      .set({
        className: classKey,
        assignedAt: new Date().toISOString(),
      })
      .where(eq(schema.userClass.userId, userId))
      .run();
  } else {
    db.insert(schema.userClass)
      .values({
        userId,
        className: classKey,
        assignedAt: new Date().toISOString(),
      })
      .run();
  }
}

// ── 获取职业加成 ──
export interface ClassBonus {
  xpBonus: number;
  goldBonus: number;
  className: string;
  emoji: string;
}

export function getClassBonus(
  userId: number,
  taskMode: string,
  taskDifficulty: string,
  timeOfDay: string,
  taskTitle: string
): ClassBonus {
  const uc = db
    .select()
    .from(schema.userClass)
    .where(eq(schema.userClass.userId, userId))
    .get();

  if (!uc) {
    return { xpBonus: 1.0, goldBonus: 1.0, className: "", emoji: "" };
  }

  const def = CLASSES[uc.className];
  if (!def) {
    return { xpBonus: 1.0, goldBonus: 1.0, className: "", emoji: "" };
  }

  let xpBonus = 1.0;
  let goldBonus = 1.0;

  switch (uc.className) {
    case "dawn_knight":
      if (timeOfDay === "morning") xpBonus = 1 + def.xpBonus;
      break;
    case "monk":
      if (EXERCISE_KEYWORDS.some((kw) => taskTitle.includes(kw))) xpBonus = 1 + def.xpBonus;
      break;
    case "scholar":
      if (STUDY_KEYWORDS.some((kw) => taskTitle.includes(kw))) xpBonus = 1 + def.xpBonus;
      break;
    case "mercenary":
      if (taskMode === "plan") goldBonus = 1 + (def.goldBonus || 0.1);
      break;
    case "flame_walker":
      if (taskDifficulty === "heroic") xpBonus = 1 + def.xpBonus;
      break;
    case "druid":
      xpBonus = 1 + def.xpBonus;
      break;
    default:
      break;
  }

  return {
    xpBonus,
    goldBonus,
    className: def.name,
    emoji: def.emoji,
  };
}

/** 获取用户当前职业（用于 UI 展示） */
export function getCurrentClass(userId: number): { key: string; name: string; emoji: string } | null {
  const uc = db
    .select()
    .from(schema.userClass)
    .where(eq(schema.userClass.userId, userId))
    .get();

  if (!uc) return null;
  const def = CLASSES[uc.className];
  if (!def) return null;

  return { key: uc.className, name: def.name, emoji: def.emoji };
}

export { CLASSES };
