/**
 * POST /api/shop/buy — 购买矿石
 * Body: { itemKey: "ore_copper" }
 */

import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getUserId } from "@/lib/auth";
import { SHOP_ORES } from "@/lib/shop-data";

export async function POST(request: Request) {
  try {
    const userId = getUserId(request);
    const { itemKey } = await request.json();
    if (!itemKey) {
      return NextResponse.json({ error: "缺少 itemKey" }, { status: 400 });
    }

    const ore = SHOP_ORES.find((o) => o.oreKey === itemKey);
    if (!ore) {
      return NextResponse.json({ error: "无效的矿石类型" }, { status: 400 });
    }

    const user = db.select().from(schema.user).where(eq(schema.user.id, userId)).get();
    if (!user) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 });
    }

    // Admin 无限金币
    if (user.role !== "admin") {
      if (user.gold < ore.cost) {
        return NextResponse.json({ error: "金币不足" }, { status: 400 });
      }
      db.update(schema.user)
        .set({ gold: user.gold - ore.cost, updatedAt: new Date().toISOString() })
        .where(eq(schema.user.id, userId))
        .run();
    }

    // 加库存（upsert）
    const existing = db
      .select()
      .from(schema.inventory)
      .where(
        and(
          eq(schema.inventory.userId, userId),
          eq(schema.inventory.itemKey, itemKey)
        )
      )
      .get();
    if (existing) {
      db.update(schema.inventory)
        .set({ quantity: existing.quantity + 1 })
        .where(
          and(
            eq(schema.inventory.userId, userId),
            eq(schema.inventory.itemKey, itemKey)
          )
        )
        .run();
    } else {
      db.insert(schema.inventory)
        .values({ userId, itemKey, quantity: 1, equipped: false })
        .run();
    }

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
      gold: user.role === "admin" ? user.gold : user.gold - ore.cost,
      item: { itemKey: updated!.itemKey, quantity: updated!.quantity, equipped: updated!.equipped },
    });
  } catch (e) {
    console.error("购买失败:", e);
    return NextResponse.json({ error: "购买失败" }, { status: 500 });
  }
}
