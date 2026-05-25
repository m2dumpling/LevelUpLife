/**
 * GET /api/inventory — 获取背包所有物品
 */

import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { getUserId } from "@/lib/auth";

export async function GET(request: Request) {
  const userId = getUserId(request);
  const rows = db
    .select()
    .from(schema.inventory)
    .where(eq(schema.inventory.userId, userId))
    .all();

  // 转为 { itemKey: { quantity, equipped } } 格式
  const result: Record<string, { quantity: number; equipped: boolean }> = {};
  for (const row of rows) {
    result[row.itemKey] = { quantity: row.quantity, equipped: row.equipped };
  }

  return NextResponse.json(result);
}
