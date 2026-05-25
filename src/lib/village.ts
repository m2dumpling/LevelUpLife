/**
 * Village 系统 — 基地建设工具函数
 *
 * addStoneOnStreak(userId, streak): 根据连胜掉落石料
 * getVillageEffects(userId): 计算当前村庄建筑效果
 */

import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

/** 根据连胜天数返回石料掉落数 */
export function addStoneOnStreak(userId: number, streak: number): number {
  let stoneGained = 0;
  if (streak >= 30) stoneGained = 10;
  else if (streak >= 7) stoneGained = 3;
  else if (streak >= 3) stoneGained = 1;
  else return 0;

  const village = db
    .select()
    .from(schema.village)
    .where(eq(schema.village.userId, userId))
    .get();

  if (!village) {
    db.insert(schema.village)
      .values({ userId, stone: stoneGained })
      .run();
  } else {
    db.update(schema.village)
      .set({ stone: village.stone + stoneGained })
      .where(eq(schema.village.userId, userId))
      .run();
  }

  return stoneGained;
}

/** 获取或创建用户的村庄 */
export function getOrCreateVillage(userId: number) {
  let village = db
    .select()
    .from(schema.village)
    .where(eq(schema.village.userId, userId))
    .get();

  if (!village) {
    db.insert(schema.village)
      .values({ userId })
      .run();
    village = db
      .select()
      .from(schema.village)
      .where(eq(schema.village.userId, userId))
      .get()!;
  }

  return village;
}

/** 村庄建筑效果 */
export interface VillageEffects {
  maxHpBonus: number;       // 房屋：每级 +1 maxHP（超出基础 1 级）
  xpMultiplier: number;     // 图书馆：每级 +1% XP
  shopDiscount: number;     // 市场：每级 -5% 价格
  hpRecoveryBonus: number;  // 喷泉：每级 +1 HP 每日恢复
  guildContributionBonus: number; // 城堡：每级 +1 公会贡献
}

/** 获取村庄各建筑效果 */
export function getVillageEffects(userId: number): VillageEffects {
  const v = db
    .select()
    .from(schema.village)
    .where(eq(schema.village.userId, userId))
    .get();

  if (!v) {
    return {
      maxHpBonus: 0,
      xpMultiplier: 1.0,
      shopDiscount: 0,
      hpRecoveryBonus: 0,
      guildContributionBonus: 0,
    };
  }

  return {
    maxHpBonus: v.houses - 1,
    xpMultiplier: 1 + (v.library - 1) * 0.01,
    shopDiscount: (v.market - 1) * 0.05,
    hpRecoveryBonus: v.fountain - 1,
    guildContributionBonus: v.castle - 1,
  };
}

/** 升级费用 = 当前等级 × 10 */
export function getUpgradeCost(currentLevel: number): number {
  return currentLevel * 10;
}
