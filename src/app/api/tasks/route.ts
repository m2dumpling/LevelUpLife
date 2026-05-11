/**
 * GET  /api/tasks — 获取所有任务（日常任务 + 主线/支线任务）
 * POST /api/tasks — 创建新任务
 *
 * v2.0: 日常任务通过 habitLog 推导今日完成状态;
 *       主线/支线任务使用 task.completed 字段。
 */

import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, and, asc } from "drizzle-orm";
import { fillTaskRewards } from "@/lib/xp-calculator";
import { getTodayLocal } from "@/lib/date-utils";

export async function GET() {
  const tasks = db
    .select()
    .from(schema.task)
    .orderBy(asc(schema.task.sortOrder))
    .all();

  // 日常任务：查询今日 habitLog，推导 completed 状态
  const today = getTodayLocal();
  const todayLogs = db
    .select()
    .from(schema.habitLog)
    .where(eq(schema.habitLog.completedAt, today))
    .all();
  const todayCompletedIds = new Set(todayLogs.map((l) => l.taskId));

  // 主线/支线任务：保持自身 completed 字段
  const enriched = tasks.map((task) => {
    if (task.mode === "habit") {
      return { ...task, completed: todayCompletedIds.has(task.id) };
    }
    return task;
  });

  return NextResponse.json(enriched);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { title, mode, description, difficulty } = body;

    if (!title || !mode) {
      return NextResponse.json(
        { error: "标题和模式为必填项" },
        { status: 400 }
      );
    }

    if (!["habit", "plan"].includes(mode)) {
      return NextResponse.json(
        { error: "模式必须是 habit 或 plan" },
        { status: 400 }
      );
    }

    const rewards = fillTaskRewards({ difficulty: difficulty || "easy" });
    const now = new Date().toISOString();

    const task = db
      .insert(schema.task)
      .values({
        title,
        mode: mode as "habit" | "plan",
        description: description || null,
        difficulty: (difficulty || "easy") as
          | "trivial"
          | "easy"
          | "medium"
          | "hard"
          | "heroic",
        xpReward: rewards.xpReward!,
        goldReward: rewards.goldReward!,
        // ── 日常任务专属 ──
        frequency: (body.frequency as "daily" | "weekly" | "monthly") || "daily",
        timeOfDay: (body.timeOfDay as "morning" | "afternoon" | "evening" | "anytime") || "anytime",
        streakCount: 0,
        bestStreak: 0,
        // ── 主线/支线任务专属 ──
        startDate: body.startDate || null,
        dueDate: body.dueDate || null,
        status: (body.status as "pending" | "in_progress" | "completed" | "failed") || "pending",
        // ── 通用 ──
        completed: false,
        sortOrder: 0,
        createdAt: now,
      })
      .returning()
      .get();

    return NextResponse.json(task, { status: 201 });
  } catch (e) {
    console.error("创建任务失败:", e);
    return NextResponse.json({ error: "创建任务失败" }, { status: 500 });
  }
}
