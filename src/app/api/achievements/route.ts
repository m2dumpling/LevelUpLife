/**
 * GET /api/achievements — 获取所有成就列表
 */

import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { asc, eq } from "drizzle-orm";
import { getUserId } from "@/lib/auth";

export async function GET(request: Request) {
  const userId = getUserId(request);
  const achievements = db
    .select()
    .from(schema.achievement)
    .where(eq(schema.achievement.userId, userId))
    .orderBy(asc(schema.achievement.id))
    .all();

  return NextResponse.json(achievements);
}
