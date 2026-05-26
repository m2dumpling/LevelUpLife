/**
 * GET /api/village — 获取村庄状态，不存在则自动创建
 * POST /api/village {building, action:"upgrade"} — 升级建筑
 */

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getUserId } from "@/lib/auth";
import { getOrCreateVillage, getUpgradeCost, getVillageEffects } from "@/lib/village";

export async function GET(request: Request) {
  const userId = getUserId(request);
  const village = getOrCreateVillage(userId);
  const effects = getVillageEffects(userId);
  return NextResponse.json({ ...village, effects });
}

export async function POST(request: Request) {
  try {
    const userId = getUserId(request);
    const body = await request.json();
    const { building, action } = body;

    if (!building || action !== "upgrade") {
      return NextResponse.json(
        { error: "缺少 building 或 action 参数" },
        { status: 400 }
      );
    }

    const validBuildings = ["houses", "library", "market", "fountain", "castle"];
    if (!validBuildings.includes(building)) {
      return NextResponse.json(
        { error: `无效建筑: ${building}` },
        { status: 400 }
      );
    }

    const village = getOrCreateVillage(userId);
    const currentLevel = (village as Record<string, any>)[building] as number;
    const cost = getUpgradeCost(currentLevel);

    const user = db
      .select()
      .from(schema.user)
      .where(eq(schema.user.id, userId))
      .get();

    if (!user) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 });
    }

    if (user.gold < cost) {
      return NextResponse.json(
        { error: `金币不足，升级需要 ${cost} 金币` },
        { status: 400 }
      );
    }

    // 扣金币
    db.update(schema.user)
      .set({ gold: user.gold - cost, updatedAt: new Date().toISOString() })
      .where(eq(schema.user.id, userId))
      .run();

    // 升级建筑
    const updateSet: Record<string, number> = {};
    updateSet[building] = currentLevel + 1;
    db.update(schema.village)
      .set(updateSet)
      .where(eq(schema.village.userId, userId))
      .run();

    // 应用建筑效果
    if (building === "houses") {
      // 房屋: +1 maxHP，HP 也跟着 +1
      db.update(schema.user)
        .set({
          maxHp: user.maxHp + 1,
          hp: Math.min(user.hp + 1, user.maxHp + 1),
        })
        .where(eq(schema.user.id, userId))
        .run();
    }

    const updatedVillage = getOrCreateVillage(userId);
    const effects = getVillageEffects(userId);
    const updatedUser = db
      .select({ gold: schema.user.gold, maxHp: schema.user.maxHp, hp: schema.user.hp })
      .from(schema.user)
      .where(eq(schema.user.id, userId))
      .get();

    return NextResponse.json({
      village: { ...updatedVillage, effects },
      user: updatedUser,
      cost,
    });
  } catch (error) {
    console.error("Village upgrade failed:", error);
    return NextResponse.json({ error: "升级失败" }, { status: 500 });
  }
}
