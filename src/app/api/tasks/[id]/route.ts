/**
 * PATCH /api/tasks/[id] — 日常打卡 / 任务完成 / 更新任务
 * DELETE /api/tasks/[id] — 删除任务
 *
 * v2.0:
 *   mode=habit → 打卡写入 habitLog（支持今日重复打卡校验 + 连续天数计算）
 *   mode=plan  → 保留直接设置 completed 的行为（支持状态流转）
 */

import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import {
  applyRewards,
  getEquippedBonusMultiplier,
} from "@/lib/xp-calculator";
import { getTodayLocal, getYesterdayLocal, compareDates } from "@/lib/date-utils";
import { settleIfNeeded } from "@/lib/daily-settlement";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const taskId = parseInt(id, 10);
    if (isNaN(taskId)) {
      return NextResponse.json({ error: "无效的任务 ID" }, { status: 400 });
    }

    // 每日结算检查
    settleIfNeeded();

    const body = await request.json();
    const task = db
      .select()
      .from(schema.task)
      .where(eq(schema.task.id, taskId))
      .get();

    if (!task) {
      return NextResponse.json({ error: "任务不存在" }, { status: 404 });
    }

    // ═══════════════════════════════════════════════════
    // 日常任务打卡 (mode=habit)
    // ═══════════════════════════════════════════════════
    if (task.mode === "habit" && body.completed === true) {
      const today = getTodayLocal();

      // 校验今日是否已打卡
      const existingLog = db
        .select()
        .from(schema.habitLog)
        .where(
          and(
            eq(schema.habitLog.taskId, taskId),
            eq(schema.habitLog.completedAt, today)
          )
        )
        .get();

      if (existingLog) {
        return NextResponse.json(
          { error: "今日已打卡，无需重复操作" },
          { status: 409 }
        );
      }

      // 插入打卡日志
      db.insert(schema.habitLog)
        .values({ taskId, completedAt: today })
        .run();

      // 计算连击：检查昨天是否也打卡了
      const yesterday = getYesterdayLocal();
      const yesterdayLog = db
        .select()
        .from(schema.habitLog)
        .where(
          and(
            eq(schema.habitLog.taskId, taskId),
            eq(schema.habitLog.completedAt, yesterday)
          )
        )
        .get();

      const newStreak = yesterdayLog ? task.streakCount + 1 : 1;
      const newBestStreak = Math.max(newStreak, task.bestStreak);

      db.update(schema.task)
        .set({
          streakCount: newStreak,
          bestStreak: newBestStreak,
        })
        .where(eq(schema.task.id, taskId))
        .run();

      // 奖励计算
      const nowISO = new Date().toISOString();
      const equippedMedals = db
        .select()
        .from(schema.inventory)
        .where(eq(schema.inventory.equipped, true))
        .all();
      const equippedKeys = equippedMedals.map((m) => m.itemKey);
      const effectiveXp = Math.round(
        task.xpReward * getEquippedBonusMultiplier(equippedKeys)
      );

      const user = db
        .select()
        .from(schema.user)
        .where(eq(schema.user.id, 1))
        .get()!;

      const result = applyRewards(
        user,
        task.xpReward,
        task.goldReward,
        equippedKeys
      );

      db.update(schema.user)
        .set({
          xp: result.xp,
          xpToNext: result.xpToNext,
          level: result.level,
          gold: result.gold,
          updatedAt: nowISO,
        })
        .where(eq(schema.user.id, 1))
        .run();

      // 活动日志
      db.insert(schema.activityLog)
        .values({
          taskId,
          taskTitle: task.title,
          mode: task.mode,
          xpEarned: effectiveXp,
          goldEarned: task.goldReward,
          completedAt: nowISO,
          date: today,
        })
        .run();

      return NextResponse.json({
        ...task,
        completed: true,
        streakCount: newStreak,
        bestStreak: newBestStreak,
        leveledUp: result.leveledUp,
        levelsGained: result.levelsGained,
        newLevel: result.level,
        newXp: result.xp,
        newXpToNext: result.xpToNext,
        newGold: result.gold,
      });
    }

    // ═══════════════════════════════════════════════════
    // 日常任务取消打卡 (mode=habit)
    // ═══════════════════════════════════════════════════
    if (task.mode === "habit" && body.completed === false) {
      const today = getTodayLocal();

      // 删除今日打卡记录
      db.delete(schema.habitLog)
        .where(
          and(
            eq(schema.habitLog.taskId, taskId),
            eq(schema.habitLog.completedAt, today)
          )
        )
        .run();

      // 重新计算连击：找最近连续打卡天数
      const allLogs = db
        .select()
        .from(schema.habitLog)
        .where(eq(schema.habitLog.taskId, taskId))
        .all();

      const completedDates = new Set(allLogs.map((l) => l.completedAt));

      // 从昨天往回数连续天数
      let recalculatedStreak = 0;
      const checkDate = new Date();
      while (true) {
        const dateStr = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, "0")}-${String(checkDate.getDate()).padStart(2, "0")}`;
        if (completedDates.has(dateStr)) {
          recalculatedStreak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          break;
        }
      }

      db.update(schema.task)
        .set({ streakCount: recalculatedStreak })
        .where(eq(schema.task.id, taskId))
        .run();

      return NextResponse.json({
        ...task,
        completed: false,
        streakCount: recalculatedStreak,
      });
    }

    // ═══════════════════════════════════════════════════
    // 主线/支线任务完成 (mode=plan)
    // ═══════════════════════════════════════════════════
    if (task.mode === "plan" && body.completed === true && !task.completed) {
      const today = getTodayLocal();

      // 严格日期校验：只能在 targetDate 当天完成
      if (task.targetDate && task.targetDate !== today) {
        return NextResponse.json(
          { error: `此任务只能在 ${task.targetDate} 完成` },
          { status: 403 }
        );
      }

      const now = new Date();
      const nowISO = now.toISOString();

      db.update(schema.task)
        .set({
          completed: true,
          completedAt: nowISO,
          status: "completed",
        })
        .where(eq(schema.task.id, taskId))
        .run();

      // 奖励
      const equippedMedals = db
        .select()
        .from(schema.inventory)
        .where(eq(schema.inventory.equipped, true))
        .all();
      const equippedKeys = equippedMedals.map((m) => m.itemKey);
      const effectiveXp = Math.round(
        task.xpReward * getEquippedBonusMultiplier(equippedKeys)
      );

      const user = db
        .select()
        .from(schema.user)
        .where(eq(schema.user.id, 1))
        .get()!;

      const result = applyRewards(
        user,
        task.xpReward,
        task.goldReward,
        equippedKeys
      );

      db.update(schema.user)
        .set({
          xp: result.xp,
          xpToNext: result.xpToNext,
          level: result.level,
          gold: result.gold,
          updatedAt: nowISO,
        })
        .where(eq(schema.user.id, 1))
        .run();

      // 活动日志
      db.insert(schema.activityLog)
        .values({
          taskId,
          taskTitle: task.title,
          mode: task.mode,
          xpEarned: effectiveXp,
          goldEarned: task.goldReward,
          completedAt: nowISO,
          date: today,
        })
        .run();

      return NextResponse.json({
        ...task,
        completed: true,
        completedAt: nowISO,
        status: "completed",
        leveledUp: result.leveledUp,
        levelsGained: result.levelsGained,
        newLevel: result.level,
        newXp: result.xp,
        newXpToNext: result.xpToNext,
        newGold: result.gold,
      });
    }

    // ═══════════════════════════════════════════════════
    // 主线/支线任务取消完成 (mode=plan)
    // ═══════════════════════════════════════════════════
    if (task.mode === "plan" && body.completed === false && task.completed) {
      db.update(schema.task)
        .set({
          completed: false,
          completedAt: null,
          status: "in_progress",
        })
        .where(eq(schema.task.id, taskId))
        .run();

      return NextResponse.json({
        ...task,
        completed: false,
        completedAt: null,
        status: "in_progress",
      });
    }

    // ═══════════════════════════════════════════════════
    // 常规更新
    // ═══════════════════════════════════════════════════
    const updateData: Record<string, unknown> = {};
    if (body.title !== undefined) updateData.title = body.title;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.difficulty !== undefined) updateData.difficulty = body.difficulty;
    if (body.sortOrder !== undefined) updateData.sortOrder = body.sortOrder;
    // 日常任务
    if (body.frequency !== undefined) updateData.frequency = body.frequency;
    if (body.timeOfDay !== undefined) updateData.timeOfDay = body.timeOfDay;
    if (body.frequencyDays !== undefined) updateData.frequencyDays = body.frequencyDays;
    if (body.reminderTime !== undefined) updateData.reminderTime = body.reminderTime;
    if (body.startDate !== undefined) updateData.startDate = body.startDate;
    if (body.endDate !== undefined) updateData.endDate = body.endDate;
    // 主线/支线任务
    if (body.targetDate !== undefined) updateData.targetDate = body.targetDate;
    if (body.status !== undefined) updateData.status = body.status;

    if (Object.keys(updateData).length > 0) {
      const updated = db
        .update(schema.task)
        .set(updateData)
        .where(eq(schema.task.id, taskId))
        .returning()
        .get();

      return NextResponse.json(updated);
    }

    return NextResponse.json(task);
  } catch (e) {
    console.error("更新任务失败:", e);
    return NextResponse.json({ error: "更新任务失败" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const taskId = parseInt(id, 10);
    if (isNaN(taskId)) {
      return NextResponse.json({ error: "无效的任务 ID" }, { status: 400 });
    }

    // 删除任务时级联删除打卡日志
    db.delete(schema.habitLog)
      .where(eq(schema.habitLog.taskId, taskId))
      .run();
    db.delete(schema.task).where(eq(schema.task.id, taskId)).run();

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("删除任务失败:", e);
    return NextResponse.json({ error: "删除任务失败" }, { status: 500 });
  }
}
