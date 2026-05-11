/**
 * PATCH /api/tasks/[id] — 完成任务 / 更新任务
 * DELETE /api/tasks/[id] — 删除任务
 */

import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { applyRewards, xpForNextLevel, getEquippedBonusMultiplier } from "@/lib/xp-calculator";

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

    const body = await request.json();

    const task = db.select().from(schema.task).where(eq(schema.task.id, taskId)).get();
    if (!task) {
      return NextResponse.json({ error: "任务不存在" }, { status: 404 });
    }

    // ─── 完成操作 ───
    if (body.completed === true && !task.completed) {
      const now = new Date();
      const nowISO = now.toISOString();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

      // 更新任务状态
      const streakCount = task.streakCount + 1;
      const bestStreak = Math.max(streakCount, task.bestStreak);

      db.update(schema.task)
        .set({
          completed: true,
          completedAt: nowISO,
          streakCount,
          bestStreak,
        })
        .where(eq(schema.task.id, taskId))
        .run();

      // 获取已装备奖牌的 XP 加成
      const equippedMedals = db
        .select()
        .from(schema.inventory)
        .where(eq(schema.inventory.equipped, true))
        .all();
      const equippedKeys = equippedMedals.map((m) => m.itemKey);

      // 更新用户属性
      const user = db.select().from(schema.user).where(eq(schema.user.id, 1)).get()!;
      const result = applyRewards(user, task.xpReward, task.goldReward, equippedKeys);

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

      const effectiveXp = Math.round(task.xpReward * getEquippedBonusMultiplier(equippedKeys));

      // 记录活动日志
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
        streakCount,
        bestStreak,
        leveledUp: result.leveledUp,
        levelsGained: result.levelsGained,
        newLevel: result.level,
        newXp: result.xp,
        newXpToNext: result.xpToNext,
        newGold: result.gold,
      });
    }

    // ─── 取消完成 ───
    if (body.completed === false && task.completed) {
      db.update(schema.task)
        .set({
          completed: false,
          completedAt: null,
        })
        .where(eq(schema.task.id, taskId))
        .run();

      return NextResponse.json({ ...task, completed: false, completedAt: null });
    }

    // ─── 常规更新 (标题、描述等) ───
    const updateData: Record<string, unknown> = {};
    if (body.title !== undefined) updateData.title = body.title;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.difficulty !== undefined) updateData.difficulty = body.difficulty;
    if (body.sortOrder !== undefined) updateData.sortOrder = body.sortOrder;

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

    db.delete(schema.task).where(eq(schema.task.id, taskId)).run();

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("删除任务失败:", e);
    return NextResponse.json({ error: "删除任务失败" }, { status: 500 });
  }
}
