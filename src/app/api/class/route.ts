/**
 * GET /api/class — 获取用户当前职业
 */

import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { getCurrentClass } from "@/lib/class-analyzer";

export async function GET(request: Request) {
  const userId = getUserId(request);
  const cls = getCurrentClass(userId);
  return NextResponse.json(cls ?? { key: "", name: "", emoji: "" });
}
