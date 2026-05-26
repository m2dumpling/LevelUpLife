import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, desc, or, and } from "drizzle-orm";
import { getUserId } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const userId = getUserId(request);
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "gold";

    if (type === "gold") {
      // Gold: reward ledger + lottery + gifts received + PvP rewards
      const rewards = db.select({
        date: schema.rewardLedger.completedDate,
        amount: schema.rewardLedger.goldEarned,
        reversed: schema.rewardLedger.reversedAt,
        title: schema.rewardLedger.taskTitle,
        type: schema.rewardLedger.mode,
      }).from(schema.rewardLedger)
        .where(eq(schema.rewardLedger.userId, userId))
        .orderBy(desc(schema.rewardLedger.createdAt))
        .limit(20).all()
        .map(r => ({ date: r.date, amount: r.reversed ? -r.amount : r.amount, title: r.title + (r.reversed ? " (已撤回)" : ""), source: r.reversed ? "任务撤回" : "任务奖励", type: r.type }));

      const lottery = db.select({ date: schema.lotteryLog.date, prize: schema.lotteryLog.prize })
        .from(schema.lotteryLog).where(eq(schema.lotteryLog.userId, userId))
        .orderBy(desc(schema.lotteryLog.date)).limit(10).all()
        .map(l => ({ date: l.date, amount: 0, title: l.prize, source: "抽奖", type: "lottery" }));

      const gifts = db.select({ date: schema.giftLog.date, giftType: schema.giftLog.giftType, giftValue: schema.giftLog.giftValue, fromUserId: schema.giftLog.fromUserId })
        .from(schema.giftLog).where(eq(schema.giftLog.toUserId, userId))
        .orderBy(desc(schema.giftLog.date)).limit(10).all()
        .map(g => {
          const sender = db.select({ username: schema.user.username }).from(schema.user).where(eq(schema.user.id, g.fromUserId)).get();
          return { date: g.date, amount: g.giftType === "gold" ? parseInt(g.giftValue) : 0, title: `来自 ${sender?.username || "未知"} 的礼物`, source: "礼物", type: "gift" };
        });

      return NextResponse.json([...rewards, ...lottery, ...gifts].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30));
    }

    if (type === "xp") {
      const rewards = db.select({
        date: schema.rewardLedger.completedDate,
        xp: schema.rewardLedger.xpEarned,
        title: schema.rewardLedger.taskTitle,
        levelBefore: schema.rewardLedger.levelBefore,
        levelAfter: schema.rewardLedger.levelAfter,
      }).from(schema.rewardLedger)
        .where(eq(schema.rewardLedger.userId, userId))
        .orderBy(desc(schema.rewardLedger.id))
        .limit(30).all();

      return NextResponse.json(rewards);
    }

    // HP history — approximate from settlement logs and login recovery
    if (type === "hp") {
      return NextResponse.json([]);
    }

    return NextResponse.json([]);
  } catch {
    return NextResponse.json([]);
  }
}
