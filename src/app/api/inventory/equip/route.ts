/**
 * POST /api/inventory/equip — 佩戴/卸下奖牌
 * Body: { itemKey: "medal_copper", equipped: true }
 */

import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getUserId } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const userId = getUserId(request);
    const { itemKey, equipped } = await request.json();
    if (!itemKey || !itemKey.startsWith("medal_")) {
      return NextResponse.json({ error: "无效的奖牌类型" }, { status: 400 });
    }

    const row = db
      .select()
      .from(schema.inventory)
      .where(
        and(
          eq(schema.inventory.userId, userId),
          eq(schema.inventory.itemKey, itemKey)
        )
      )
      .get();
    if (!row || row.quantity <= 0) {
      return NextResponse.json({ error: "你没有这个奖牌" }, { status: 400 });
    }

    db.update(schema.inventory)
      .set({ equipped })
      .where(
        and(
          eq(schema.inventory.userId, userId),
          eq(schema.inventory.itemKey, itemKey)
        )
      )
      .run();

    const updated = db
      .select()
      .from(schema.inventory)
      .where(
        and(
          eq(schema.inventory.userId, userId),
          eq(schema.inventory.itemKey, itemKey)
        )
      )
      .get();

    return NextResponse.json({
      success: true,
      item: { itemKey: updated!.itemKey, quantity: updated!.quantity, equipped: updated!.equipped },
    });
  } catch (e) {
    console.error("装备切换失败:", e);
    return NextResponse.json({ error: "装备切换失败" }, { status: 500 });
  }
}
