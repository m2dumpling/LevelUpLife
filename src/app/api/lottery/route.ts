/**
 * GET  /api/lottery — 检查今天是否可抽奖 + 今日已完成 habit 数
 * POST /api/lottery — 抽一次奖
 */

import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, and, sql } from "drizzle-orm";
import { getUserId } from "@/lib/auth";
import { getTodayLocal } from "@/lib/date-utils";

const REQUIRE_COMPLETIONS = 3;

const PRIZES = [
  { weight: 40, type: "gold", min: 5, max: 20, emoji: "🪙", label: "小袋金币" },
  { weight: 25, type: "gold", min: 20, max: 50, emoji: "💰", label: "中袋金币" },
  { weight: 15, type: "ore", emoji: "🪨", label: "随机矿石" },
  { weight: 12, type: "gold", min: 50, max: 100, emoji: "💎", label: "大袋金币" },
  { weight: 6, type: "gold", min: 100, max: 300, emoji: "👑", label: "金库钥匙" },
  { weight: 2, type: "title", emoji: "🌟", label: "专属称号", value: "欧皇" },
];

const ORE_KEYS = ["ore_copper", "ore_iron", "ore_gold", "ore_mithril"];

function weightedRandom(): (typeof PRIZES)[number] {
  const total = PRIZES.reduce((s, p) => s + p.weight, 0);
  let r = Math.random() * total;
  for (const p of PRIZES) { r -= p.weight; if (r <= 0) return p; }
  return PRIZES[0];
}

export async function GET(request: Request) {
  try {
    const userId = getUserId(request);
    const today = getTodayLocal();

    const drawn = db.select().from(schema.lotteryLog)
      .where(and(eq(schema.lotteryLog.userId, userId), eq(schema.lotteryLog.date, today)))
      .get();

    const todayCompletions = db.select({ count: sql<number>`count(*)` })
      .from(schema.habitLog)
      .where(and(eq(schema.habitLog.userId, userId), eq(schema.habitLog.completedAt, today)))
      .get()?.count ?? 0;

    return NextResponse.json({
      canDraw: !drawn && todayCompletions >= REQUIRE_COMPLETIONS,
      drawn: !!drawn,
      completedToday: todayCompletions,
      required: REQUIRE_COMPLETIONS,
    });
  } catch {
    return NextResponse.json({ error: "获取抽奖状态失败" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const userId = getUserId(request);
    const today = getTodayLocal();

    const drawn = db.select().from(schema.lotteryLog)
      .where(and(eq(schema.lotteryLog.userId, userId), eq(schema.lotteryLog.date, today)))
      .get();
    if (drawn) return NextResponse.json({ error: "今天已经抽过了" }, { status: 400 });

    const count = db.select({ count: sql<number>`count(*)` })
      .from(schema.habitLog)
      .where(and(eq(schema.habitLog.userId, userId), eq(schema.habitLog.completedAt, today)))
      .get()?.count ?? 0;
    if (count < REQUIRE_COMPLETIONS) {
      return NextResponse.json({ error: `需要完成 ${REQUIRE_COMPLETIONS} 个 Habit，当前 ${count}` }, { status: 400 });
    }

    const prize = weightedRandom();
    let result = "";

    if (prize.type === "gold") {
      const amount = Math.floor(Math.random() * ((prize.max || 100) - (prize.min || 5) + 1)) + (prize.min || 5);
      db.update(schema.user).set({ gold: sql`${schema.user.gold} + ${amount}` }).where(eq(schema.user.id, userId)).run();
      result = `${prize.emoji} 获得 ${amount} 金币！`;
    } else if (prize.type === "ore") {
      const oreKey = ORE_KEYS[Math.floor(Math.random() * ORE_KEYS.length)];
      const existing = db.select().from(schema.inventory).where(and(eq(schema.inventory.userId, userId), eq(schema.inventory.itemKey, oreKey))).get();
      if (existing) {
        db.update(schema.inventory).set({ quantity: sql`${schema.inventory.quantity} + 1` }).where(eq(schema.inventory.id, existing.id)).run();
      } else {
        db.insert(schema.inventory).values({ userId, itemKey: oreKey, quantity: 1, equipped: false }).run();
      }
      const oreNames: Record<string, string> = { ore_copper: "铜矿石", ore_iron: "铁矿石", ore_gold: "金矿石", ore_mithril: "秘银矿石" };
      result = `${prize.emoji} 获得 ${oreNames[oreKey] || oreKey}！`;
    } else if (prize.type === "title") {
      result = `🌟 你获得了专属称号：【${prize.value}】！`;
    }

    db.insert(schema.lotteryLog).values({ userId, prize: result, date: today }).run();

    return NextResponse.json({ success: true, result, prize: prize.label });
  } catch (e) {
    console.error("Lottery error:", e);
    return NextResponse.json({ error: "抽奖失败" }, { status: 500 });
  }
}
