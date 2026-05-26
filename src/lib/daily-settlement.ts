/**
 * HP 每日结算引擎 + 不活跃账户清理 + 村庄石料 + 职业分配
 *
 * settleIfNeeded(userId): 单个用户的 HP 结算
 * cleanupInactiveAccounts(): 删除超过 15 天未登录的账户
 */

import { db, schema } from "@/lib/db";
import { eq, and, lt, ne } from "drizzle-orm";
import { getTodayLocal, getYesterdayLocal, getDaysAgoLocal, getDayOfWeek, getDayOfMonth } from "@/lib/date-utils";
import { addStoneOnStreak, getVillageEffects } from "@/lib/village";
import { assignClass } from "@/lib/class-analyzer";

const HP_PENALTY_PER_MISSED = 5;
const BASE_HP_RECOVERY_ON_LOGIN = 20;
const INACTIVE_DAYS = 15;

let cleanupRanToday = false;

/** 处理宠物喂食与饥饿检测（基于指定日期的习惯完成情况） */
function handlePetFeeding(userId: number, dateStr: string) {
  const pet = db
    .select()
    .from(schema.pet)
    .where(eq(schema.pet.userId, userId))
    .get();
  if (!pet) return;

  const dateLogs = db
    .select()
    .from(schema.habitLog)
    .where(
      and(
        eq(schema.habitLog.userId, userId),
        eq(schema.habitLog.completedAt, dateStr),
      ),
    )
    .all();

  const fed = dateLogs.length > 0;
  db.update(schema.pet)
    .set({ fedToday: fed })
    .where(eq(schema.pet.userId, userId))
    .run();

  if (!fed) {
    // 检查连续 3 天是否均未完成任何习惯
    const d2 = getDaysAgoLocal(2);
    const d3 = getDaysAgoLocal(3);

    let hasAnyRecent = false;
    for (const d of [dateStr, d2, d3]) {
      const logs = db
        .select()
        .from(schema.habitLog)
        .where(
          and(
            eq(schema.habitLog.userId, userId),
            eq(schema.habitLog.completedAt, d),
          ),
        )
        .all();
      if (logs.length > 0) {
        hasAnyRecent = true;
        break;
      }
    }

    if (!hasAnyRecent) {
      db.delete(schema.pet)
        .where(eq(schema.pet.userId, userId))
        .run();
      console.log(
        `[pet] Pet deleted for user ${userId} — 3 days unfed`,
      );
    }
  }
}

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
  stoneGained?: number; classAssigned?: string;
} {
  const user = db.select().from(schema.user).where(eq(schema.user.id, userId)).get();
  if (!user) return { hpChanged: false, penaltyApplied: false, hpLost: 0, missedCount: 0 };

  const today = getTodayLocal();
  const yesterday = getYesterdayLocal();
  let hpChanged = false, penaltyApplied = false, hpLost = 0, missedCount = 0;
  let stoneGained = 0;
  let classAssigned: string | undefined;

  // 村庄喷泉加成
  const effects = getVillageEffects(userId);
  const hpRecovery = BASE_HP_RECOVERY_ON_LOGIN + effects.hpRecoveryBonus;

  // 登录恢复
  if (user.lastLoginDate !== today) {
    const newHp = Math.min(user.hp + hpRecovery, user.maxHp);
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

  // ── 计算用户级连续天数 (streakDays) ──
  const habits = db.select().from(schema.task).where(and(eq(schema.task.mode, "habit"), eq(schema.task.userId, userId))).all();

  // 结算昨天
  if (!user.lastSettlementDate || user.lastSettlementDate >= yesterday) {
    runCleanupIfNeeded(userId);
    return { hpChanged, penaltyApplied, hpLost, missedCount };
  }

  const dueHabits = habits.filter((h) => habitMatchesDate(h.frequency, yesterday, h.frequencyDays));

  if (dueHabits.length === 0) {
    // 无到期习惯，重置连续天数
    db.update(schema.user)
      .set({ lastSettlementDate: yesterday, streakDays: 0, totalDays: user.totalDays + 1 })
      .where(eq(schema.user.id, userId)).run();
    handlePetFeeding(userId, yesterday);
    runCleanupIfNeeded(userId);
    return { hpChanged, penaltyApplied, hpLost, missedCount };
  }

  const yesterdayLogs = db.select().from(schema.habitLog).where(and(eq(schema.habitLog.completedAt, yesterday), eq(schema.habitLog.userId, userId))).all();
  const completedIds = new Set(yesterdayLogs.map((l) => l.taskId));
  missedCount = dueHabits.filter((h) => !completedIds.has(h.id)).length;

  if (missedCount > 0) {
    hpLost = missedCount * HP_PENALTY_PER_MISSED;
    const newHp = Math.max(0, user.hp - hpLost);
    db.update(schema.user)
      .set({ hp: newHp, hpPenaltyActive: newHp <= 0, lastSettlementDate: yesterday, streakDays: 0, totalDays: user.totalDays + 1 })
      .where(eq(schema.user.id, userId)).run();
    penaltyApplied = true; hpChanged = true;
  } else {
    // 全部完成：连续天数 +1
    const newStreak = user.streakDays + 1;
    const newBestStreak = Math.max(newStreak, user.bestStreak);
    const newTotalDays = user.totalDays + 1;
    db.update(schema.user)
      .set({ lastSettlementDate: yesterday, streakDays: newStreak, bestStreak: newBestStreak, totalDays: newTotalDays })
      .where(eq(schema.user.id, userId)).run();

    // ── 石料掉落（基于用户连续天数） ──
    stoneGained = addStoneOnStreak(userId, newStreak);
  }

  // ── 宠物喂食 & 饥饿检测 ──
  handlePetFeeding(userId, yesterday);

  // ── 周一分配职业 ──
  // getDayOfWeek returns 0=Sun, 1=Mon, ..., 6=Sat for the given date string
  if (getDayOfWeek(today) === 1) {
    assignClass(userId);
    const cls = db.select({ className: schema.userClass.className })
      .from(schema.userClass)
      .where(eq(schema.userClass.userId, userId))
      .get();
    if (cls) classAssigned = cls.className;
  }

  runCleanupIfNeeded(userId);
  return { hpChanged, penaltyApplied, hpLost, missedCount, stoneGained, classAssigned };
}

/** 当前用户 HP 惩罚状态 */
export function getHpPenaltyActive(userId: number): boolean {
  const user = db.select({ hpPenaltyActive: schema.user.hpPenaltyActive }).from(schema.user).where(eq(schema.user.id, userId)).get();
  return user?.hpPenaltyActive ?? false;
}

function runCleanupIfNeeded(_userId: number) {
  const today = getTodayLocal();
  if (cleanupRanToday) return;
  cleanupRanToday = true;

  const cutoff = getDaysAgoLocal(INACTIVE_DAYS);
  const inactiveUsers = db.select({ id: schema.user.id }).from(schema.user).where(and(lt(schema.user.lastLoginDate, cutoff), ne(schema.user.role, "admin"))).all();

  for (const u of inactiveUsers) {
    const uid = u.id;
    for (const table of [schema.rewardLedger, schema.activityLog, schema.inventory, schema.habitLog, schema.achievement, schema.storyEvent, schema.task, schema.pet, schema.village, schema.userClass, schema.guildMember, schema.guildChat, schema.bossContribution, schema.lotteryLog]) {
      db.delete(table).where(eq(table.userId, uid)).run();
    }
    db.delete(schema.user).where(eq(schema.user.id, uid)).run();
  }

  if (inactiveUsers.length > 0) {
    console.log(`[cleanup] Deleted ${inactiveUsers.length} inactive accounts (last login < ${cutoff})`);
  }
}
