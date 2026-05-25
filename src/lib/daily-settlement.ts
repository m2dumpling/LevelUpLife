/**
 * HP 每日结算引擎 + 不活跃账户清理
 *
 * settleIfNeeded(userId): 单个用户的 HP 结算
 * cleanupInactiveAccounts(): 删除超过 15 天未登录的账户
 */

import { db, schema } from "@/lib/db";
import { eq, and, lt } from "drizzle-orm";
import { getTodayLocal, getYesterdayLocal, getDaysAgoLocal, getDayOfWeek, getDayOfMonth } from "@/lib/date-utils";

const HP_PENALTY_PER_MISSED = 5;
const HP_RECOVERY_ON_LOGIN = 20;
const INACTIVE_DAYS = 15;

let cleanupRanToday = false;

function habitMatchesDate(
  frequency: string | null | undefined,
  dateStr: string,
  frequencyDays?: string | null,
): boolean {
  const freq = frequency || "daily";
  if (freq === "daily") return true;
  if (freq === "weekly") {
    if (frequencyDays) return frequencyDays.split(",").map(Number).includes(getDayOfWeek(dateStr));
    return getDayOfWeek(dateStr) === new Date().getDay();
  }
  if (freq === "monthly") return getDayOfMonth(dateStr) === new Date().getDate();
  return true;
}

export function settleIfNeeded(userId: number): {
  hpChanged: boolean; penaltyApplied: boolean; hpLost: number; missedCount: number;
} {
  const user = db.select().from(schema.user).where(eq(schema.user.id, userId)).get();
  if (!user) return { hpChanged: false, penaltyApplied: false, hpLost: 0, missedCount: 0 };

  const today = getTodayLocal();
  const yesterday = getYesterdayLocal();
  let hpChanged = false, penaltyApplied = false, hpLost = 0, missedCount = 0;

  // 登录恢复
  if (user.lastLoginDate !== today) {
    const newHp = Math.min(user.hp + HP_RECOVERY_ON_LOGIN, user.maxHp);
    if (newHp !== user.hp) {
      db.update(schema.user).set({ hp: newHp, lastLoginDate: today }).where(eq(schema.user.id, userId)).run();
      hpChanged = true;
      if (newHp > 0 && user.hpPenaltyActive) {
        db.update(schema.user).set({ hpPenaltyActive: false }).where(eq(schema.user.id, userId)).run();
      }
    } else {
      db.update(schema.user).set({ lastLoginDate: today }).where(eq(schema.user.id, userId)).run();
    }
  }

  // 结算昨天
  if (!user.lastSettlementDate || user.lastSettlementDate >= yesterday) {
    runCleanupIfNeeded();
    return { hpChanged, penaltyApplied, hpLost, missedCount };
  }

  const habits = db.select().from(schema.task).where(and(eq(schema.task.mode, "habit"), eq(schema.task.userId, userId))).all();
  const dueHabits = habits.filter((h) => habitMatchesDate(h.frequency, yesterday, h.frequencyDays));

  if (dueHabits.length === 0) {
    db.update(schema.user).set({ lastSettlementDate: yesterday }).where(eq(schema.user.id, userId)).run();
    runCleanupIfNeeded();
    return { hpChanged, penaltyApplied, hpLost, missedCount };
  }

  const yesterdayLogs = db.select().from(schema.habitLog).where(and(eq(schema.habitLog.completedAt, yesterday), eq(schema.habitLog.userId, userId))).all();
  const completedIds = new Set(yesterdayLogs.map((l) => l.taskId));
  missedCount = dueHabits.filter((h) => !completedIds.has(h.id)).length;

  if (missedCount > 0) {
    hpLost = missedCount * HP_PENALTY_PER_MISSED;
    const newHp = Math.max(0, user.hp - hpLost);
    db.update(schema.user).set({ hp: newHp, hpPenaltyActive: newHp <= 0, lastSettlementDate: yesterday }).where(eq(schema.user.id, userId)).run();
    penaltyApplied = true; hpChanged = true;
  } else {
    db.update(schema.user).set({ lastSettlementDate: yesterday }).where(eq(schema.user.id, userId)).run();
  }

  runCleanupIfNeeded();
  return { hpChanged, penaltyApplied, hpLost, missedCount };
}

/** 当前用户 HP 惩罚状态 */
export function getHpPenaltyActive(userId: number): boolean {
  const user = db.select({ hpPenaltyActive: schema.user.hpPenaltyActive }).from(schema.user).where(eq(schema.user.id, userId)).get();
  return user?.hpPenaltyActive ?? false;
}

function runCleanupIfNeeded() {
  const today = getTodayLocal();
  if (cleanupRanToday) return;
  cleanupRanToday = true;

  const cutoff = getDaysAgoLocal(INACTIVE_DAYS);
  const inactiveUsers = db.select({ id: schema.user.id }).from(schema.user).where(lt(schema.user.lastLoginDate, cutoff)).all();

  for (const u of inactiveUsers) {
    const uid = u.id;
    for (const table of [schema.rewardLedger, schema.activityLog, schema.inventory, schema.habitLog, schema.achievement, schema.storyEvent, schema.task]) {
      db.delete(table).where(eq(table.userId, uid)).run();
    }
    db.delete(schema.user).where(eq(schema.user.id, uid)).run();
  }

  if (inactiveUsers.length > 0) {
    console.log(`[cleanup] Deleted ${inactiveUsers.length} inactive accounts (last login < ${cutoff})`);
  }
}
