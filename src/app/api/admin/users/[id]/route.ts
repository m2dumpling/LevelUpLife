import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userId = parseInt(id, 10);
    if (isNaN(userId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const user = db.select().from(schema.user).where(eq(schema.user.id, userId)).get();
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const tasks = db.select().from(schema.task).where(eq(schema.task.userId, userId)).all();
    const habitLogs = db.select().from(schema.habitLog).where(eq(schema.habitLog.userId, userId)).all();
    const inventory = db.select().from(schema.inventory).where(eq(schema.inventory.userId, userId)).all();

    return NextResponse.json({
      user: {
        id: user.id, username: user.username, name: user.name, role: user.role,
        level: user.level, xp: user.xp, gold: user.gold, hp: user.hp,
        registerIp: user.registerIp, registerCountry: user.registerCountry,
        lastLoginIp: user.lastLoginIp, lastLoginCountry: user.lastLoginCountry,
        lastLoginDate: user.lastLoginDate, createdAt: user.createdAt,
        storyProgress: user.storyProgress, hpPenaltyActive: user.hpPenaltyActive,
        streakDays: user.streakDays, bestStreak: user.bestStreak, totalDays: user.totalDays,
      },
      tasks: tasks.map((t) => ({
        id: t.id, title: t.title, mode: t.mode, difficulty: t.difficulty,
        xpReward: t.xpReward, goldReward: t.goldReward,
        completed: t.completed, status: t.status, targetDate: t.targetDate,
        streakCount: t.streakCount, createdAt: t.createdAt,
      })),
      recentCompletions: habitLogs.slice(-50).map((l) => ({ taskId: l.taskId, date: l.completedAt })),
      inventory: inventory.map((i) => ({ itemKey: i.itemKey, quantity: i.quantity, equipped: i.equipped })),
    });
  } catch (e) {
    console.error("Admin user detail error:", e);
    return NextResponse.json({ error: "获取用户详情失败" }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userId = parseInt(id, 10);
    if (isNaN(userId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const user = db.select().from(schema.user).where(eq(schema.user.id, userId)).get();
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
    if (user.role === "admin") return NextResponse.json({ error: "不能修改管理员账户" }, { status: 403 });

    const { banned } = await request.json();
    if (typeof banned === "boolean") {
      db.update(schema.user).set({ banned }).where(eq(schema.user.id, userId)).run();
      return NextResponse.json({ success: true, banned });
    }

    return NextResponse.json({ error: "仅支持 banned 字段" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: "更新失败" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userId = parseInt(id, 10);
    if (isNaN(userId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const user = db.select().from(schema.user).where(eq(schema.user.id, userId)).get();
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
    if (user.role === "admin") return NextResponse.json({ error: "不能删除管理员账户" }, { status: 403 });

    for (const table of [schema.rewardLedger, schema.activityLog, schema.habitLog, schema.achievement, schema.storyEvent, schema.inventory, schema.task]) {
      db.delete(table).where(eq(table.userId, userId)).run();
    }
    db.delete(schema.user).where(eq(schema.user.id, userId)).run();

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Admin delete user error:", e);
    return NextResponse.json({ error: "删除用户失败" }, { status: 500 });
  }
}
