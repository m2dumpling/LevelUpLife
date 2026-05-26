import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, and, gt, ne } from "drizzle-orm";
import { getUserId } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const userId = getUserId(request);
    const { searchParams } = new URL(request.url);
    const afterGuildId = parseInt(searchParams.get("afterGuildId") || "0");
    const afterFriendIds = searchParams.get("afterFriendIds") || "";

    // Parse per-friend last seen IDs: "friendId:lastMsgId,friendId:lastMsgId"
    const friendLastSeen: Record<number, number> = {};
    for (const part of afterFriendIds.split(",").filter(Boolean)) {
      const [fid, mid] = part.split(":").map(Number);
      if (fid && mid) friendLastSeen[fid] = mid;
    }

    // Guild unread
    let guildUnread = 0;
    const guildMember = db.select().from(schema.guildMember).where(eq(schema.guildMember.userId, userId)).get();
    if (guildMember && afterGuildId > 0) {
      const newMsgs = db.select().from(schema.guildChat)
        .where(and(eq(schema.guildChat.guildId, guildMember.guildId), gt(schema.guildChat.id, afterGuildId), ne(schema.guildChat.userId, userId)))
        .all();
      guildUnread = newMsgs.length;
    } else if (guildMember && afterGuildId === 0) {
      // First time — count all
      guildUnread = 0;
    }

    // Friend unread per friend
    const friendUnread: Record<number, number> = {};
    for (const [friendId, lastId] of Object.entries(friendLastSeen)) {
      if (lastId === 0) continue;
      const count = db.select().from(schema.friendChat)
        .where(and(
          eq(schema.friendChat.friendId, userId),
          eq(schema.friendChat.userId, Number(friendId)),
          gt(schema.friendChat.id, lastId)
        )).all().length;
      friendUnread[Number(friendId)] = count;
    }

    // Friend requests count
    const requestsCount = db.select().from(schema.friendRequest)
      .where(and(eq(schema.friendRequest.toUserId, userId), eq(schema.friendRequest.status, "pending")))
      .all().length;

    return NextResponse.json({ guildUnread, friendUnread, requestsCount });
  } catch {
    return NextResponse.json({ guildUnread: 0, friendUnread: {}, requestsCount: 0 });
  }
}
