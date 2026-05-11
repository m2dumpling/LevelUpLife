/**
 * GET /api/achievements — 获取所有成就列表
 */

import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { asc } from "drizzle-orm";

export async function GET() {
  const achievements = db
    .select()
    .from(schema.achievement)
    .orderBy(asc(schema.achievement.id))
    .all();

  return NextResponse.json(achievements);
}
