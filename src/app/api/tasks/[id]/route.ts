import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getUserId } from "@/lib/auth";
import { checkRate } from "@/lib/rate-limiter";
import { fillTaskRewards } from "@/lib/xp-calculator";
import { getDaysAgoLocal, getTodayLocal } from "@/lib/date-utils";
import { settleIfNeeded } from "@/lib/daily-settlement";
import { grantTaskReward, revertTaskReward } from "@/lib/rewards";
import { getNPCVoice } from "@/lib/npc-voices";
import { recordBossDamage, checkBossDefeatedReward } from "@/app/api/boss/route";

function recalculateHabitStreak(taskId: number, userId: number, startDaysAgo = 0): number {
  const logs = db
    .select()
    .from(schema.habitLog)
    .where(
      and(
        eq(schema.habitLog.taskId, taskId),
        eq(schema.habitLog.userId, userId)
      )
    )
    .all();
  const completedDates = new Set(logs.map((log) => log.completedAt));

  let streak = 0;
  while (completedDates.has(getDaysAgoLocal(startDaysAgo + streak))) {
    streak += 1;
  }
  return streak;
}

function removeActivityLog(taskId: number, userId: number, date?: string): void {
  if (date) {
    db.delete(schema.activityLog)
      .where(
        and(
          eq(schema.activityLog.taskId, taskId),
          eq(schema.activityLog.userId, userId),
          eq(schema.activityLog.date, date)
        )
      )
      .run();
    return;
  }

  db.delete(schema.activityLog)
    .where(
      and(
        eq(schema.activityLog.taskId, taskId),
        eq(schema.activityLog.userId, userId)
      )
    )
    .run();
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const taskId = Number.parseInt(id, 10);
    if (Number.isNaN(taskId)) {
      return NextResponse.json({ error: "Invalid task id" }, { status: 400 });
    }

    const userId = getUserId(request);
    settleIfNeeded(userId);

    const body = await request.json();

    // ── 反作弊：完成操作频率限制（每分钟最多 5 次） ──
    if (body.completed === true) {
      const rate = checkRate(userId, "task_complete", 5);
      if (!rate.allowed) {
        return NextResponse.json({ error: rate.message }, { status: 429 });
      }
    }

    const task = db
      .select()
      .from(schema.task)
      .where(and(eq(schema.task.id, taskId), eq(schema.task.userId, userId)))
      .get();

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    if (task.mode === "habit" && body.completed === true) {
      const today = getTodayLocal();
      const existingLog = db
        .select()
        .from(schema.habitLog)
        .where(
          and(
            eq(schema.habitLog.taskId, taskId),
            eq(schema.habitLog.userId, userId),
            eq(schema.habitLog.completedAt, today)
          )
        )
        .get();

      if (existingLog) {
        return NextResponse.json({
          ...task,
          completed: true,
          completedNow: false,
        });
      }

      db.insert(schema.habitLog).values({ userId, taskId, completedAt: today }).run();
      await recordBossDamage(userId, task.difficulty, taskId);
      const bossRewardMessage = await checkBossDefeatedReward();

      const newStreak = recalculateHabitStreak(taskId, userId);
      const newBestStreak = Math.max(newStreak, task.bestStreak);
      db.update(schema.task)
        .set({ streakCount: newStreak, bestStreak: newBestStreak })
        .where(and(eq(schema.task.id, taskId), eq(schema.task.userId, userId)))
        .run();

      const nowISO = new Date().toISOString();
      const completedTask = {
        ...task,
        completed: true,
        streakCount: newStreak,
        bestStreak: newBestStreak,
      };
      const result = grantTaskReward(completedTask);

      if (result.awarded) {
        db.insert(schema.activityLog)
          .values({
            userId,
            taskId,
            taskTitle: task.title,
            mode: task.mode,
            xpEarned: result.xpEarned,
            goldEarned: result.goldEarned,
            completedAt: nowISO,
            date: today,
          })
          .run();
      }

      return NextResponse.json({
        ...task,
        completed: true,
        completedNow: true,
        streakCount: newStreak,
        bestStreak: newBestStreak,
        leveledUp: result.leveledUp,
        levelsGained: result.levelsGained,
        newLevel: result.level,
        newXp: result.xp,
        newXpToNext: result.xpToNext,
        newGold: result.gold,
        bossRewardMessage,
        npcVoice: getNPCVoice({ mode: "habit", difficulty: task.difficulty, title: task.title, streak: newStreak, hour: new Date().getHours() }),
      });
    }

    if (task.mode === "habit" && body.completed === false) {
      const today = getTodayLocal();
      const existingLog = db
        .select()
        .from(schema.habitLog)
        .where(
          and(
            eq(schema.habitLog.taskId, taskId),
            eq(schema.habitLog.userId, userId),
            eq(schema.habitLog.completedAt, today)
          )
        )
        .get();

      db.delete(schema.habitLog)
        .where(
          and(
            eq(schema.habitLog.taskId, taskId),
            eq(schema.habitLog.userId, userId),
            eq(schema.habitLog.completedAt, today)
          )
        )
        .run();
      removeActivityLog(taskId, userId, today);

      const recalculatedStreak = recalculateHabitStreak(taskId, userId, 1);
      db.update(schema.task)
        .set({ streakCount: recalculatedStreak })
        .where(and(eq(schema.task.id, taskId), eq(schema.task.userId, userId)))
        .run();

      const reverted = existingLog
        ? revertTaskReward({ ...task, completed: true })
        : null;

      return NextResponse.json({
        ...task,
        completed: false,
        streakCount: recalculatedStreak,
        rewardReverted: !!reverted,
        newGold: reverted?.gold,
        newXp: reverted?.xp,
        newLevel: reverted?.level,
        newXpToNext: reverted?.xpToNext,
      });
    }

    if (task.mode === "plan" && body.completed === true && !task.completed) {
      const today = getTodayLocal();
      if (task.targetDate && task.targetDate !== today) {
        return NextResponse.json(
          { error: `This task can only be completed on ${task.targetDate}` },
          { status: 403 }
        );
      }

      const nowISO = new Date().toISOString();
      db.update(schema.task)
        .set({ completed: true, completedAt: nowISO, status: "completed" })
        .where(and(eq(schema.task.id, taskId), eq(schema.task.userId, userId)))
        .run();
      await recordBossDamage(userId, task.difficulty, taskId);
      const bossRewardMessage = await checkBossDefeatedReward();

      const completedTask = {
        ...task,
        completed: true,
        completedAt: nowISO,
        status: "completed" as const,
      };
      const result = grantTaskReward(completedTask);

      if (result.awarded) {
        db.insert(schema.activityLog)
          .values({
            userId,
            taskId,
            taskTitle: task.title,
            mode: task.mode,
            xpEarned: result.xpEarned,
            goldEarned: result.goldEarned,
            completedAt: nowISO,
            date: today,
          })
          .run();
      }

      return NextResponse.json({
        ...task,
        completed: true,
        completedAt: nowISO,
        status: "completed",
        completedNow: true,
        leveledUp: result.leveledUp,
        levelsGained: result.levelsGained,
        newLevel: result.level,
        newXp: result.xp,
        newXpToNext: result.xpToNext,
        newGold: result.gold,
        bossRewardMessage,
        npcVoice: getNPCVoice({ mode: "plan", difficulty: task.difficulty, title: task.title, streak: 0, hour: new Date().getHours() }),
      });
    }

    if (task.mode === "plan" && body.completed === false && task.completed) {
      const reverted = revertTaskReward(task);

      db.update(schema.task)
        .set({ completed: false, completedAt: null, status: "in_progress" })
        .where(and(eq(schema.task.id, taskId), eq(schema.task.userId, userId)))
        .run();
      removeActivityLog(taskId, userId);

      return NextResponse.json({
        ...task,
        completed: false,
        completedAt: null,
        status: "in_progress",
        rewardReverted: !!reverted,
        newGold: reverted?.gold,
        newXp: reverted?.xp,
        newLevel: reverted?.level,
        newXpToNext: reverted?.xpToNext,
      });
    }

    const updateData: Record<string, unknown> = {};
    if (body.title !== undefined) updateData.title = body.title;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.difficulty !== undefined) {
      updateData.difficulty = body.difficulty;
      if (!task.completed && task.status !== "completed") {
        const rewards = fillTaskRewards({ difficulty: body.difficulty as string });
        updateData.xpReward = rewards.xpReward;
        updateData.goldReward = rewards.goldReward;
      }
    }
    if (body.sortOrder !== undefined) updateData.sortOrder = body.sortOrder;
    if (body.frequency !== undefined) updateData.frequency = body.frequency;
    if (body.timeOfDay !== undefined) updateData.timeOfDay = body.timeOfDay;
    if (body.frequencyDays !== undefined) {
      updateData.frequencyDays = body.frequencyDays;
    }
    if (body.reminderTime !== undefined) updateData.reminderTime = body.reminderTime;
    if (body.startDate !== undefined) updateData.startDate = body.startDate;
    if (body.endDate !== undefined) updateData.endDate = body.endDate;
    if (body.targetDate !== undefined) updateData.targetDate = body.targetDate;
    if (body.status !== undefined) updateData.status = body.status;
    else if (task.mode === "plan" && !task.completed) updateData.status = "pending";

    if (Object.keys(updateData).length > 0) {
      const updated = db
        .update(schema.task)
        .set(updateData)
        .where(and(eq(schema.task.id, taskId), eq(schema.task.userId, userId)))
        .returning()
        .get();

      return NextResponse.json(updated);
    }

    return NextResponse.json(task);
  } catch (error) {
    console.error("Failed to update task:", error);
    return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const taskId = Number.parseInt(id, 10);
    if (Number.isNaN(taskId)) {
      return NextResponse.json({ error: "Invalid task id" }, { status: 400 });
    }

    const userId = getUserId(request);

    const task = db
      .select()
      .from(schema.task)
      .where(and(eq(schema.task.id, taskId), eq(schema.task.userId, userId)))
      .get();

    if (task) {
      if (task.mode === "plan" && task.completed) {
        revertTaskReward(task);
      }
      if (task.mode === "habit") {
        const today = getTodayLocal();
        const todayLog = db
          .select()
          .from(schema.habitLog)
          .where(
            and(
              eq(schema.habitLog.taskId, taskId),
              eq(schema.habitLog.userId, userId),
              eq(schema.habitLog.completedAt, today)
            )
          )
          .get();
        if (todayLog) {
          revertTaskReward({ ...task, completed: true });
        }
      }
    }

    db.delete(schema.habitLog)
      .where(and(eq(schema.habitLog.taskId, taskId), eq(schema.habitLog.userId, userId)))
      .run();
    removeActivityLog(taskId, userId);
    db.delete(schema.task)
      .where(and(eq(schema.task.id, taskId), eq(schema.task.userId, userId)))
      .run();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete task:", error);
    return NextResponse.json({ error: "Failed to delete task" }, { status: 500 });
  }
}
