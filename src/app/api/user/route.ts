/**
 * GET /api/user — 获取当前用户属性
 */

import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { getUserId } from "@/lib/auth";

export async function GET(request: Request) {
  const userId = getUserId(request);
  const user = db.select().from(schema.user).where(eq(schema.user.id, userId)).get();

  if (!user) {
    return NextResponse.json({ error: "用户不存在" }, { status: 404 });
  }

  // 不返回密码哈希
  const { passwordHash: _, ...safeUser } = user;
  return NextResponse.json(safeUser);
}
