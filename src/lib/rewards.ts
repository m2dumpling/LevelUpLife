import { and, desc, eq, isNull, or } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import {
  applyRewards,
  levelStateFromTotalXp,
  totalXpFromLevelState,
} from "@/lib/xp-calculator";
import { getTodayLocal } from "@/lib/date-utils";
import { getPetBuff } from "@/lib/pet-buffs";
import { getClassBonus } from "@/lib/class-analyzer";
import { getVillageEffects } from "@/lib/village";
import { getWeatherBonusForTaskSync } from "@/lib/weather";

type TaskRow = InferSelectModel<typeof schema.task>;
type RewardLedgerRow = InferSelectModel<typeof schema.rewardLedger>;

export interface RewardGrantResult {
  awarded: boolean;
  xpEarned: number;
  goldEarned: number;
  level: number;
  xp: number;
  xpToNext: number;
  gold: number;
  leveledUp: boolean;
  levelsGained: number;
}

export interface RewardRevertResult {
  reverted: boolean;
  xpReverted: number;
  goldReverted: number;
  level: number;
  xp: number;
  xpToNext: number;
  gold: number;
}

function completionKeyFor(task: TaskRow, date = getTodayLocal()): string {
  return task.mode === "habit" ? `${task.id}:${date}` : `${task.id}:plan`;
}

function getEquippedKeys(userId: number): string[] {
  return db
    .select()
    .from(schema.inventory)
    .where(and(eq(schema.inventory.userId, userId), eq(schema.inventory.equipped, true)))
    .all()
    .map((item) => item.itemKey);
}

function getOpenLedger(task: TaskRow): RewardLedgerRow | undefined {
  const key = completionKeyFor(task);
  const rows = db
    .select()
    .from(schema.rewardLedger)
    .where(and(
      eq(schema.rewardLedger.taskId, task.id),
      or(eq(schema.rewardLedger.userId, task.userId), isNull(schema.rewardLedger.userId))
    ))
    .orderBy(desc(schema.rewardLedger.id))
    .all();

  return rows.find(
    (row) =>
      !row.reversedAt &&
      (row.completionKey === key || task.mode === "plan")
  );
}

export function grantTaskReward(task: TaskRow): RewardGrantResult {
  const existing = getOpenLedger(task);
  const user = db.select().from(schema.user).where(eq(schema.user.id, task.userId)).get();
  if (!user) throw new Error("User not found");

  if (existing) {
    return {
      awarded: false,
      xpEarned: existing.xpEarned,
      goldEarned: existing.goldEarned,
      level: user.level,
      xp: user.xp,
      xpToNext: user.xpToNext,
      gold: user.gold,
      leveledUp: false,
      levelsGained: 0,
    };
  }

  // ── 职业加成 ──
  const classBonus = getClassBonus(
    task.userId,
    task.mode,
    task.difficulty,
    task.timeOfDay || "anytime",
    task.title
  );

  // ── 天气加成（同步缓存读取） ──
  const weatherMultiplier = getWeatherBonusForTaskSync(task.userId, task.title);

  // ── 村庄图书馆 XP 加成 ──
  const villageEffects = getVillageEffects(task.userId);

  // ── 宠物加成 ──
  const petBuff = getPetBuff(task.userId);

  // 合并加成倍率
  const combinedXpMultiplier =
    classBonus.xpBonus *
    weatherMultiplier *
    villageEffects.xpMultiplier *
    (1 + petBuff.xpBonus / 100);
  const combinedGoldMultiplier =
    classBonus.goldBonus * (1 + petBuff.goldBonus / 100);

  const adjustedXp = Math.round(task.xpReward * combinedXpMultiplier);
  const adjustedGold = Math.round(task.goldReward * combinedGoldMultiplier);

  const result = applyRewards(
    user,
    adjustedXp,
    adjustedGold,
    getEquippedKeys(task.userId)
  );
  const now = new Date().toISOString();

  db.update(schema.user)
    .set({
      xp: result.xp,
      xpToNext: result.xpToNext,
      level: result.level,
      gold: result.gold,
      hp: result.hp,
      updatedAt: now,
    })
    .where(eq(schema.user.id, task.userId))
    .run();

  db.insert(schema.rewardLedger)
    .values({
      userId: task.userId,
      taskId: task.id,
      completionKey: completionKeyFor(task),
      mode: task.mode,
      taskTitle: task.title,
      baseXp: task.xpReward,
      baseGold: task.goldReward,
      xpEarned: result.xpEarned,
      goldEarned: adjustedGold,
      levelBefore: user.level,
      xpBefore: user.xp,
      xpToNextBefore: user.xpToNext,
      goldBefore: user.gold,
      levelAfter: result.level,
      xpAfter: result.xp,
      xpToNextAfter: result.xpToNext,
      goldAfter: result.gold,
      completedDate: getTodayLocal(),
      createdAt: now,
      reversedAt: null,
    })
    .run();

  return {
    awarded: true,
    xpEarned: result.xpEarned,
    goldEarned: adjustedGold,
    level: result.level,
    xp: result.xp,
    xpToNext: result.xpToNext,
    gold: result.gold,
    leveledUp: result.leveledUp,
    levelsGained: result.levelsGained,
  };
}

export function revertTaskReward(task: TaskRow): RewardRevertResult | null {
  const ledger = getOpenLedger(task);
  if (!ledger) return null;

  const user = db.select().from(schema.user).where(eq(schema.user.id, task.userId)).get();
  if (!user) throw new Error("User not found");

  const totalXp = totalXpFromLevelState(user.level, user.xp);
  const nextXpState = levelStateFromTotalXp(totalXp - ledger.xpEarned);
  const nextGold = Math.max(0, user.gold - ledger.goldEarned);
  const now = new Date().toISOString();

  db.update(schema.user)
    .set({
      level: nextXpState.level,
      xp: nextXpState.xp,
      xpToNext: nextXpState.xpToNext,
      gold: nextGold,
      updatedAt: now,
    })
    .where(eq(schema.user.id, task.userId))
    .run();

  db.update(schema.rewardLedger)
    .set({ reversedAt: now })
    .where(eq(schema.rewardLedger.id, ledger.id))
    .run();

  return {
    reverted: true,
    xpReverted: ledger.xpEarned,
    goldReverted: ledger.goldEarned,
    level: nextXpState.level,
    xp: nextXpState.xp,
    xpToNext: nextXpState.xpToNext,
    gold: nextGold,
  };
}

export function getTotalEarnedGold(): number {
  return db
    .select()
    .from(schema.rewardLedger)
    .where(isNull(schema.rewardLedger.reversedAt))
    .all()
    .reduce((sum, row) => sum + row.goldEarned, 0);
}
