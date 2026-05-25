import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { like, sql } from "drizzle-orm";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") || "";

    let users;
    if (q) {
      users = db
        .select()
        .from(schema.user)
        .where(like(schema.user.username, `%${q}%`))
        .all();
    } else {
      users = db.select().from(schema.user).all();
    }

    // 统计每个用户的任务数
    const enriched = users.map((u) => {
      const taskCount = db
        .select({ count: sql<number>`count(*)` })
        .from(schema.task)
        .where(sql`${schema.task.userId} = ${u.id}`)
        .get()?.count ?? 0;

      return {
        id: u.id,
        username: u.username,
        name: u.name,
        role: u.role,
        level: u.level,
        xp: u.xp,
        gold: u.gold,
        hp: u.hp,
        registerIp: u.registerIp,
        registerCountry: u.registerCountry,
        lastLoginIp: u.lastLoginIp,
        lastLoginCountry: u.lastLoginCountry,
        lastLoginDate: u.lastLoginDate,
        createdAt: u.createdAt,
        taskCount,
      };
    });

    return NextResponse.json(enriched);
  } catch (e) {
    console.error("Admin users error:", e);
    return NextResponse.json({ error: "获取用户列表失败" }, { status: 500 });
  }
}
