/**
 * GET /api/logs — 获取活动日志（供热力图 + 时间轴使用）
 */

import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { desc } from "drizzle-orm";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") || "50", 10);

  const logs = db
    .select()
    .from(schema.activityLog)
    .orderBy(desc(schema.activityLog.completedAt))
    .limit(Math.min(limit, 365))
    .all();

  return NextResponse.json(logs);
}
