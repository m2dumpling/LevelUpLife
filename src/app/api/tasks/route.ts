/**
 * GET /api/tasks — 获取所有任务
 * POST /api/tasks — 创建新任务
 */

import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, asc } from "drizzle-orm";
import { fillTaskRewards } from "@/lib/xp-calculator";

export async function GET() {
  const tasks = db
    .select()
    .from(schema.task)
    .orderBy(asc(schema.task.completed), asc(schema.task.sortOrder))
    .all();

  return NextResponse.json(tasks);
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

    // 使用难度自动计算 XP 和金币奖励
    const rewards = fillTaskRewards({ difficulty: difficulty || "easy" });

    const now = new Date().toISOString();
    const task = db
      .insert(schema.task)
      .values({
        title,
        mode: mode as "habit" | "plan",
        description: description || null,
        difficulty: (difficulty || "easy") as "trivial" | "easy" | "medium" | "hard" | "heroic",
        xpReward: rewards.xpReward!,
        goldReward: rewards.goldReward!,
        streakCount: 0,
        bestStreak: 0,
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
