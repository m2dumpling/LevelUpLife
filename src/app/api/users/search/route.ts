import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { like, and, ne } from "drizzle-orm";
import { getUserId } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const userId = getUserId(request);
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") || "";
    if (!q.trim()) return NextResponse.json([]);

    const users = db.select({
      id: schema.user.id, username: schema.user.username, name: schema.user.name, level: schema.user.level,
    }).from(schema.user).where(and(like(schema.user.username, `%${q.trim()}%`), ne(schema.user.id, userId))).limit(10).all();

    return NextResponse.json(users);
  } catch {
    return NextResponse.json({ error: "搜索失败" }, { status: 500 });
  }
}
