import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { fillTaskRewards } from "@/lib/xp-calculator";
import { compareDates, getTodayLocal } from "@/lib/date-utils";
import { settleIfNeeded } from "@/lib/daily-settlement";

export async function GET() {
  settleIfNeeded();
  const today = getTodayLocal();

  let tasks = db
    .select()
    .from(schema.task)
    .orderBy(asc(schema.task.sortOrder))
    .all();

  let repaired = false;
  for (const task of tasks) {
    if (
      task.mode === "plan" &&
      !task.completed &&
      task.status === "failed" &&
      (!task.targetDate || compareDates(task.targetDate, today) >= 0)
    ) {
      db.update(schema.task)
        .set({ status: "pending" })
        .where(eq(schema.task.id, task.id))
        .run();
      repaired = true;
    }
  }

  if (repaired) {
    tasks = db
      .select()
      .from(schema.task)
      .orderBy(asc(schema.task.sortOrder))
      .all();
  }

  const todayLogs = db
    .select()
    .from(schema.habitLog)
    .where(eq(schema.habitLog.completedAt, today))
    .all();
  const todayCompletedIds = new Set(todayLogs.map((log) => log.taskId));

  const enriched = tasks.map((task) => {
    if (task.mode === "habit") {
      return { ...task, completed: todayCompletedIds.has(task.id) };
    }

    if (
      task.mode === "plan" &&
      !task.completed &&
      task.status !== "completed" &&
      task.status !== "failed" &&
      task.targetDate &&
      compareDates(task.targetDate, today) < 0
    ) {
      db.update(schema.task)
        .set({ status: "failed" })
        .where(eq(schema.task.id, task.id))
        .run();
      return { ...task, status: "failed" as const };
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
        { error: "Title and mode are required" },
        { status: 400 }
      );
    }

    if (!["habit", "plan"].includes(mode)) {
      return NextResponse.json(
        { error: "Mode must be habit or plan" },
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
        frequency: (body.frequency as "daily" | "weekly" | "monthly") || "daily",
        timeOfDay:
          (body.timeOfDay as
            | "morning"
            | "afternoon"
            | "evening"
            | "anytime") || "anytime",
        frequencyDays: body.frequencyDays || null,
        reminderTime: body.reminderTime || null,
        streakCount: 0,
        bestStreak: 0,
        startDate: body.startDate || null,
        endDate: body.endDate || null,
        targetDate: body.targetDate || null,
        status: "pending",
        completed: false,
        sortOrder: 0,
        createdAt: now,
      })
      .returning()
      .get();

    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    console.error("Failed to create task:", error);
    return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
  }
}
