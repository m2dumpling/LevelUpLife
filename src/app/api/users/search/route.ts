import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { getUserId } from "@/lib/auth";

/** 只能搜索同公会成员，且排除 admin */
export async function GET(request: Request) {
  try {
    const userId = getUserId(request);
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") || "").trim();
    if (!q) return NextResponse.json([]);

    // 用户必须在公会中
    const guildMember = db.select({ guildId: schema.guildMember.guildId })
      .from(schema.guildMember).where(eq(schema.guildMember.userId, userId)).get();
    if (!guildMember) return NextResponse.json([]);

    // 获取同公会所有成员 ID
    const members = db.select({ userId: schema.guildMember.userId })
      .from(schema.guildMember).where(eq(schema.guildMember.guildId, guildMember.guildId)).all();
    const memberIds = members.map(m => m.userId).filter(id => id !== userId);

    // 搜索匹配的用户名
    const users = db.select({
      id: schema.user.id, username: schema.user.username, name: schema.user.name, level: schema.user.level, role: schema.user.role,
    }).from(schema.user).all();

    const results = users.filter(u =>
      memberIds.includes(u.id) && u.role !== "admin" &&
      u.username.toLowerCase().includes(q.toLowerCase())
    ).slice(0, 10);

    return NextResponse.json(results);
  } catch {
    return NextResponse.json([]);
  }
}
