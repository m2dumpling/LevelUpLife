import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { sql } from "drizzle-orm";

export async function GET() {
  try {
    const users = db.select().from(schema.user).all();
    const tasks = db.select().from(schema.task).all();
    const logs = db.select().from(schema.habitLog).all();

    // 注册趋势（按天统计最近 30 天）
    const regTrend: Record<string, number> = {};
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i);
      regTrend[d.toISOString().split("T")[0]] = 0;
    }
    for (const u of users) {
      const day = u.createdAt.split("T")[0];
      if (regTrend[day] !== undefined) regTrend[day]++;
    }

    // 国家分布
    const countries: Record<string, number> = {};
    for (const u of users) {
      if (u.registerCountry) {
        countries[u.registerCountry] = (countries[u.registerCountry] || 0) + 1;
      }
    }

    // 活跃度
    const today = new Date().toISOString().split("T")[0];
    const activeToday = users.filter((u) => u.lastLoginDate === today).length;
    const activeThisWeek = users.filter((u) => {
      if (!u.lastLoginDate) return false;
      const d = new Date(u.lastLoginDate);
      const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
      return d >= weekAgo;
    }).length;

    // 打卡率（今天打卡数 / 今天应有 habit 数）
    const todayCompletions = logs.filter((l) => l.completedAt === today).length;
    const todayHabits = tasks.filter((t) => t.mode === "habit" && !t.completed).length;
    const completionRate = todayHabits > 0 ? Math.round((todayCompletions / todayHabits) * 100) : 0;

    // 内容审计（含敏感词的任务）
    const sensitiveWords = ["赌", "博", "色情", "广告", "微信", "QQ", "加群", "赚钱", "兼职", "刷单"];
    const flagged = tasks.filter((t) =>
      sensitiveWords.some((w) => t.title.includes(w) || (t.description || "").includes(w))
    );

    return NextResponse.json({
      regTrend,
      countries,
      activeToday,
      activeThisWeek,
      totalUsers: users.length,
      totalTasks: tasks.length,
      totalCompletions: logs.length,
      completionRate,
      avgLevel: users.length > 0 ? Math.round(users.reduce((s, u) => s + u.level, 0) / users.length) : 0,
      banned: users.filter((u) => u.banned).length,
      flaggedTasks: flagged.map((t) => ({
        id: t.id, title: t.title, userId: t.userId,
        username: users.find((u) => u.id === t.userId)?.username || "unknown",
      })),
    });
  } catch (e) {
    console.error("Admin stats error:", e);
    return NextResponse.json({ error: "获取统计数据失败" }, { status: 500 });
  }
}
