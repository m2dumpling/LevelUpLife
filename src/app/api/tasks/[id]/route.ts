import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import {
  applyRewards,
  fillTaskRewards,
  getEquippedBonusMultiplier,
} from "@/lib/xp-calculator";
import { getDaysAgoLocal, getTodayLocal } from "@/lib/date-utils";
import { settleIfNeeded } from "@/lib/daily-settlement";
import { deductTaskGold } from "@/lib/reward-adjustments";

function getEquippedKeys(): string[] {
  return db
    .select()
    .from(schema.inventory)
    .where(eq(schema.inventory.equipped, true))
    .all()
    .map((item) => item.itemKey);
}

function deductGoldForTask(goldReward: number): number | undefined {
  const user = db.select().from(schema.user).where(eq(schema.user.id, 1)).get();
  if (!user) return undefined;

  const adjusted = deductTaskGold(user, goldReward);
  db.update(schema.user)
    .set({ gold: adjusted.gold, updatedAt: new Date().toISOString() })
    .where(eq(schema.user.id, 1))
    .run();
  return adjusted.gold;
}

function recalculateHabitStreak(taskId: number, startDaysAgo = 0): number {
  const logs = db
    .select()
    .from(schema.habitLog)
    .where(eq(schema.habitLog.taskId, taskId))
    .all();
  const completedDates = new Set(logs.map((log) => log.completedAt));

  let streak = 0;
  while (completedDates.has(getDaysAgoLocal(startDaysAgo + streak))) {
    streak += 1;
  }
  return streak;
}

function removeActivityLog(taskId: number, date?: string): void {
  if (date) {
    db.delete(schema.activityLog)
      .where(
        and(
          eq(schema.activityLog.taskId, taskId),
          eq(schema.activityLog.date, date)
        )
      )
      .run();
    return;
  }

  db.delete(schema.activityLog)
    .where(eq(schema.activityLog.taskId, taskId))
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

    settleIfNeeded();

    const body = await request.json();
    const task = db
      .select()
      .from(schema.task)
      .where(eq(schema.task.id, taskId))
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
            eq(schema.habitLog.completedAt, today)
          )
        )
        .get();

      if (existingLog) {
        return NextResponse.json(
          { error: "Habit already completed today" },
          { status: 409 }
        );
      }

      db.insert(schema.habitLog).values({ taskId, completedAt: today }).run();

      const newStreak = recalculateHabitStreak(taskId);
      const newBestStreak = Math.max(newStreak, task.bestStreak);
      db.update(schema.task)
        .set({ streakCount: newStreak, bestStreak: newBestStreak })
        .where(eq(schema.task.id, taskId))
        .run();

      const nowISO = new Date().toISOString();
      const equippedKeys = getEquippedKeys();
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

    if (task.mode === "habit" && body.completed === false) {
      const today = getTodayLocal();
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

      db.delete(schema.habitLog)
        .where(
          and(
            eq(schema.habitLog.taskId, taskId),
            eq(schema.habitLog.completedAt, today)
          )
        )
        .run();
      removeActivityLog(taskId, today);

      const recalculatedStreak = recalculateHabitStreak(taskId, 1);
      db.update(schema.task)
        .set({ streakCount: recalculatedStreak })
        .where(eq(schema.task.id, taskId))
        .run();

      const newGold = existingLog
        ? deductGoldForTask(task.goldReward)
        : undefined;

      return NextResponse.json({
        ...task,
        completed: false,
        streakCount: recalculatedStreak,
        newGold,
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
        .where(eq(schema.task.id, taskId))
        .run();

      const equippedKeys = getEquippedKeys();
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

    if (task.mode === "plan" && body.completed === false && task.completed) {
      const newGold = deductGoldForTask(task.goldReward);

      db.update(schema.task)
        .set({ completed: false, completedAt: null, status: "in_progress" })
        .where(eq(schema.task.id, taskId))
        .run();
      removeActivityLog(taskId);

      return NextResponse.json({
        ...task,
        completed: false,
        completedAt: null,
        status: "in_progress",
        newGold,
      });
    }

    const updateData: Record<string, unknown> = {};
    if (body.title !== undefined) updateData.title = body.title;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.difficulty !== undefined) {
      updateData.difficulty = body.difficulty;
      const rewards = fillTaskRewards({ difficulty: body.difficulty as string });
      updateData.xpReward = rewards.xpReward;
      updateData.goldReward = rewards.goldReward;
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
  } catch (error) {
    console.error("Failed to update task:", error);
    return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const taskId = Number.parseInt(id, 10);
    if (Number.isNaN(taskId)) {
      return NextResponse.json({ error: "Invalid task id" }, { status: 400 });
    }

    db.delete(schema.habitLog)
      .where(eq(schema.habitLog.taskId, taskId))
      .run();
    removeActivityLog(taskId);
    db.delete(schema.task).where(eq(schema.task.id, taskId)).run();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete task:", error);
    return NextResponse.json({ error: "Failed to delete task" }, { status: 500 });
  }
}
