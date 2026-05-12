/**
 * HP 每日结算引擎
 *
 * 触发时机：每次 API 请求拉取任务/打卡前调用
 * - 如果上次结算日期 < 昨天 → 结算昨天未完成的 habit，扣 HP
 * - 如果跨天登录 → 恢复 20HP
 * - HP 归零 → 激活 XP 惩罚标记
 */

import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import {
  getTodayLocal,
  getYesterdayLocal,
  getDayOfWeek,
  getDayOfMonth,
} from "@/lib/date-utils";

const HP_PENALTY_PER_MISSED = 5;
const HP_RECOVERY_ON_LOGIN = 20;

/** 判断某个 habit 在指定日期是否应该出现 */
function habitMatchesDate(
  frequency: string | null | undefined,
  dateStr: string,
  frequencyDays?: string | null,
): boolean {
  const freq = frequency || "daily";
  if (freq === "daily") return true;
  if (freq === "weekly") {
    if (frequencyDays) {
      const days = frequencyDays.split(",").map(Number);
      return days.includes(getDayOfWeek(dateStr));
    }
    // 向后兼容：与今天同 weekday 才出现
    const todayDow = new Date().getDay();
    return getDayOfWeek(dateStr) === todayDow;
  }
  if (freq === "monthly") {
    const todayDom = new Date().getDate();
    return getDayOfMonth(dateStr) === todayDom;
  }
  return true;
}

/** 结算：如果上次结算日期早于昨天，对昨天未完成的 habit 进行 HP 惩罚 */
export function settleIfNeeded(): {
  hpChanged: boolean;
  penaltyApplied: boolean;
  hpLost: number;
  missedCount: number;
} {
  const user = db.select().from(schema.user).where(eq(schema.user.id, 1)).get();
  if (!user) return { hpChanged: false, penaltyApplied: false, hpLost: 0, missedCount: 0 };

  const today = getTodayLocal();
  const yesterday = getYesterdayLocal();
  let hpChanged = false;
  let penaltyApplied = false;
  let hpLost = 0;
  let missedCount = 0;

  // ── 登录恢复 ──
  if (user.lastLoginDate !== today) {
    const newHp = Math.min(user.hp + HP_RECOVERY_ON_LOGIN, user.maxHp);
    if (newHp !== user.hp) {
      db.update(schema.user)
        .set({ hp: newHp, lastLoginDate: today })
        .where(eq(schema.user.id, 1))
        .run();
      hpChanged = true;

      // HP 恢复 > 0 时解除惩罚
      if (newHp > 0 && user.hpPenaltyActive) {
        db.update(schema.user)
          .set({ hpPenaltyActive: false })
          .where(eq(schema.user.id, 1))
          .run();
      }
    } else {
      db.update(schema.user)
        .set({ lastLoginDate: today })
        .where(eq(schema.user.id, 1))
        .run();
    }
  }

  // ── 结算昨天 ──
  const needsSettlement =
    !user.lastSettlementDate || user.lastSettlementDate < yesterday;

  if (!needsSettlement) {
    return { hpChanged, penaltyApplied, hpLost, missedCount };
  }

  // 查询所有 habit
  const habits = db
    .select()
    .from(schema.task)
    .where(eq(schema.task.mode, "habit"))
    .all();

  // 筛选昨天应出现的 habit
  const dueHabits = habits.filter((h) => habitMatchesDate(h.frequency, yesterday, h.frequencyDays));

  if (dueHabits.length === 0) {
    db.update(schema.user)
      .set({ lastSettlementDate: yesterday })
      .where(eq(schema.user.id, 1))
      .run();
    return { hpChanged, penaltyApplied, hpLost, missedCount };
  }

  // 查询昨天的打卡记录
  const yesterdayLogs = db
    .select()
    .from(schema.habitLog)
    .where(eq(schema.habitLog.completedAt, yesterday))
    .all();
  const completedIds = new Set(yesterdayLogs.map((l) => l.taskId));

  // 计算未完成数
  missedCount = dueHabits.filter((h) => !completedIds.has(h.id)).length;

  if (missedCount > 0) {
    hpLost = missedCount * HP_PENALTY_PER_MISSED;
    const newHp = Math.max(0, user.hp - hpLost);

    db.update(schema.user)
      .set({
        hp: newHp,
        hpPenaltyActive: newHp <= 0,
        lastSettlementDate: yesterday,
      })
      .where(eq(schema.user.id, 1))
      .run();

    penaltyApplied = true;
    hpChanged = true;
  } else {
    db.update(schema.user)
      .set({ lastSettlementDate: yesterday })
      .where(eq(schema.user.id, 1))
      .run();
  }

  return { hpChanged, penaltyApplied, hpLost, missedCount };
}

/** 获取当前 HP 惩罚状态（用于 XP 计算） */
export function getHpPenaltyActive(): boolean {
  const user = db.select({ hpPenaltyActive: schema.user.hpPenaltyActive })
    .from(schema.user)
    .where(eq(schema.user.id, 1))
    .get();
  return user?.hpPenaltyActive ?? false;
}
