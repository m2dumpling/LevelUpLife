/**
 * GET /api/logs — 获取活动日志（供热力图 + 时间轴使用）
 */

import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { desc, eq } from "drizzle-orm";
import { getUserId } from "@/lib/auth";

export async function GET(request: Request) {
  const userId = getUserId(request);
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") || "50", 10);

  const logs = db
    .select()
    .from(schema.activityLog)
    .where(eq(schema.activityLog.userId, userId))
    .orderBy(desc(schema.activityLog.completedAt))
    .limit(Math.min(limit, 365))
    .all();

  return NextResponse.json(logs);
}
