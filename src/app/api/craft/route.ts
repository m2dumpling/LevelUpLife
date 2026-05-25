/**
 * POST /api/craft — 用矿石合成奖牌
 * Body: { medalKey: "medal_copper" }
 */

import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getUserId } from "@/lib/auth";
import { MEDAL_RECIPES } from "@/lib/shop-data";

export async function POST(request: Request) {
  try {
    const userId = getUserId(request);
    const { medalKey } = await request.json();
    if (!medalKey) {
      return NextResponse.json({ error: "缺少 medalKey" }, { status: 400 });
    }

    const recipe = MEDAL_RECIPES.find((m) => m.medalKey === medalKey);
    if (!recipe) {
      return NextResponse.json({ error: "无效的奖牌配方" }, { status: 400 });
    }

    // 检查矿石数量
    const oreRow = db
      .select()
      .from(schema.inventory)
      .where(
        and(
          eq(schema.inventory.userId, userId),
          eq(schema.inventory.itemKey, recipe.oreKey)
        )
      )
      .get();
    const oreQty = oreRow?.quantity ?? 0;
    if (oreQty < recipe.oreRequired) {
      return NextResponse.json({ error: `材料不足，需要 ${recipe.oreRequired} 个矿石，当前 ${oreQty} 个` }, { status: 400 });
    }

    // 扣矿石
    if (oreQty === recipe.oreRequired) {
      db.delete(schema.inventory)
        .where(
          and(
            eq(schema.inventory.userId, userId),
            eq(schema.inventory.itemKey, recipe.oreKey)
          )
        )
        .run();
    } else {
      db.update(schema.inventory)
        .set({ quantity: oreQty - recipe.oreRequired })
        .where(
          and(
            eq(schema.inventory.userId, userId),
            eq(schema.inventory.itemKey, recipe.oreKey)
          )
        )
        .run();
    }

    // 加奖牌（upsert）
    const medalRow = db
      .select()
      .from(schema.inventory)
      .where(
        and(
          eq(schema.inventory.userId, userId),
          eq(schema.inventory.itemKey, medalKey)
        )
      )
      .get();
    if (medalRow) {
      db.update(schema.inventory)
        .set({ quantity: medalRow.quantity + 1 })
        .where(
          and(
            eq(schema.inventory.userId, userId),
            eq(schema.inventory.itemKey, medalKey)
          )
        )
        .run();
    } else {
      db.insert(schema.inventory)
        .values({ userId, itemKey: medalKey, quantity: 1, equipped: false })
        .run();
    }

    // 返回更新后的背包
    const allRows = db
      .select()
      .from(schema.inventory)
      .where(eq(schema.inventory.userId, userId))
      .all();
    const inventory: Record<string, { quantity: number; equipped: boolean }> = {};
    for (const row of allRows) {
      inventory[row.itemKey] = { quantity: row.quantity, equipped: row.equipped };
    }

    return NextResponse.json({ success: true, inventory });
  } catch (e) {
    console.error("合成失败:", e);
    return NextResponse.json({ error: "合成失败" }, { status: 500 });
  }
}
