import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { getUserId } from "@/lib/auth";
import { getTodayLocal } from "@/lib/date-utils";

const ORE_KEYS = ["ore_copper", "ore_iron", "ore_gold", "ore_mithril", "ore_adamantite"] as const;
const ORE_NAMES: Record<string, string> = {
  ore_copper: "铜矿石", ore_iron: "铁矿石", ore_gold: "金矿石", ore_mithril: "秘银矿石", ore_adamantite: "精金矿石",
};

export async function POST(request: Request) {
  try {
    const userId = getUserId(request);
    const today = getTodayLocal();
    const { toUserId, giftType, giftValue } = await request.json();

    if (!toUserId || !giftType) {
      return NextResponse.json({ error: "缺少参数" }, { status: 400 });
    }

    // 检查今天是否已经给这个人送过礼物
    const existing = db.select().from(schema.giftLog).where(
      and(eq(schema.giftLog.fromUserId, userId), eq(schema.giftLog.toUserId, toUserId), eq(schema.giftLog.date, today))
    ).get();
    if (existing) {
      return NextResponse.json({ error: "今天已经给这位成员送过礼物了" }, { status: 400 });
    }

    if (giftType === "gold") {
      const amount = parseInt(giftValue || "0");
      if (!amount || amount < 1) return NextResponse.json({ error: "金币数量无效" }, { status: 400 });

      const user = db.select({ gold: schema.user.gold }).from(schema.user).where(eq(schema.user.id, userId)).get();
      if (!user || user.gold < amount) return NextResponse.json({ error: "金币不足" }, { status: 400 });

      db.update(schema.user).set({ gold: user.gold - amount }).where(eq(schema.user.id, userId)).run();
      const target = db.select({ gold: schema.user.gold }).from(schema.user).where(eq(schema.user.id, toUserId)).get();
      if (target) db.update(schema.user).set({ gold: target.gold + amount }).where(eq(schema.user.id, toUserId)).run();

      db.insert(schema.giftLog).values({ fromUserId: userId, toUserId, giftType: "gold", giftValue: String(amount), date: today }).run();
      return NextResponse.json({ success: true, message: `送出 ${amount}G` });
    }

    if (giftType === "ore") {
      const oreKey = giftValue;
      if (!ORE_KEYS.includes(oreKey as any)) return NextResponse.json({ error: "无效的矿石类型" }, { status: 400 });

      const inv = db.select().from(schema.inventory).where(and(eq(schema.inventory.userId, userId), eq(schema.inventory.itemKey, oreKey))).get();
      if (!inv || inv.quantity < 1) return NextResponse.json({ error: "你没有这个矿石" }, { status: 400 });

      db.update(schema.inventory).set({ quantity: inv.quantity - 1 }).where(eq(schema.inventory.id, inv.id)).run();

      const targetInv = db.select().from(schema.inventory).where(and(eq(schema.inventory.userId, toUserId), eq(schema.inventory.itemKey, oreKey))).get();
      if (targetInv) {
        db.update(schema.inventory).set({ quantity: targetInv.quantity + 1 }).where(eq(schema.inventory.id, targetInv.id)).run();
      } else {
        db.insert(schema.inventory).values({ userId: toUserId, itemKey: oreKey, quantity: 1, equipped: false }).run();
      }

      db.insert(schema.giftLog).values({ fromUserId: userId, toUserId, giftType: "ore", giftValue: oreKey, date: today }).run();
      return NextResponse.json({ success: true, message: `送出一个 ${ORE_NAMES[oreKey]}` });
    }

    return NextResponse.json({ error: "无效的礼物类型" }, { status: 400 });
  } catch (e) {
    console.error("Gift error:", e);
    return NextResponse.json({ error: "送礼失败" }, { status: 500 });
  }
}
