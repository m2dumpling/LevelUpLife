import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, and, gt, ne, isNull, inArray } from "drizzle-orm";
import { getUserId } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const userId = getUserId(request);
    const { searchParams } = new URL(request.url);
    const afterGuildId = parseInt(searchParams.get("afterGuildId") || "0");
    const afterTimestamp = parseInt(searchParams.get("after") || "0");

    // Guild unread
    let guildUnread = 0;
    const guildMember = db.select().from(schema.guildMember).where(eq(schema.guildMember.userId, userId)).get();
    if (guildMember) {
      if (afterGuildId > 0) {
        const newMsgs = db.select().from(schema.guildChat)
          .where(and(eq(schema.guildChat.guildId, guildMember.guildId), gt(schema.guildChat.id, afterGuildId), ne(schema.guildChat.userId, userId)))
          .all();
        guildUnread = newMsgs.length;
      } else {
        // First time: count all from others in the last 24h
        const oneDayAgo = new Date(Date.now() - 86400000).toISOString();
        guildUnread = db.select().from(schema.guildChat)
          .where(and(eq(schema.guildChat.guildId, guildMember.guildId), ne(schema.guildChat.userId, userId), gt(schema.guildChat.createdAt, oneDayAgo)))
          .all().length;
      }
    }

    // Friend unread: count ALL messages from ANY friend sent after last check timestamp
    const friendUnread: Record<number, number> = {};
    const friends = db.select({ friendId: schema.friend.friendId, note: schema.friend.note })
      .from(schema.friend).where(eq(schema.friend.userId, userId)).all();

    if (afterTimestamp > 0) {
      // Count messages from each friend sent after the timestamp
      for (const f of friends) {
        const afterDate = new Date(afterTimestamp).toISOString();
        const count = db.select().from(schema.friendChat).where(and(
          eq(schema.friendChat.userId, f.friendId), eq(schema.friendChat.friendId, userId),
          gt(schema.friendChat.createdAt, afterDate)
        )).all().length;
        if (count > 0) friendUnread[f.friendId] = count;
      }
    }

    // Friend requests count
    const requestsCount = db.select().from(schema.friendRequest)
      .where(and(eq(schema.friendRequest.toUserId, userId), eq(schema.friendRequest.status, "pending")))
      .all().length;

    // Gift notifications — use ID comparison for reliable delivery
    const { searchParams: sp2 } = new URL(request.url);
    const afterGiftId = parseInt(sp2.get("afterGiftId") || "0");
    const giftAlerts: { fromUsername: string; giftType: string; giftValue: string; giftId: number }[] = [];
    const newGifts = db.select().from(schema.giftLog).where(and(
      eq(schema.giftLog.toUserId, userId),
      gt(schema.giftLog.id, afterGiftId),
      isNull(schema.giftLog.seenAt)
    )).all();
    for (const g of newGifts) {
      const sender = db.select({ username: schema.user.username }).from(schema.user).where(eq(schema.user.id, g.fromUserId)).get();
      giftAlerts.push({ fromUsername: sender?.username || "未知", giftType: g.giftType, giftValue: g.giftValue, giftId: g.id });
    }
    if (newGifts.length > 0) {
      db.update(schema.giftLog)
        .set({ seenAt: new Date().toISOString() })
        .where(inArray(schema.giftLog.id, newGifts.map((g) => g.id)))
        .run();
    }

    return NextResponse.json({ guildUnread, friendUnread, requestsCount, giftAlerts });
  } catch {
    return NextResponse.json({ guildUnread: 0, friendUnread: {}, requestsCount: 0 });
  }
}
