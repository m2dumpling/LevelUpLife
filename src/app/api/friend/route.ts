import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, and, or, desc } from "drizzle-orm";
import { getUserId } from "@/lib/auth";
import { getTodayLocal } from "@/lib/date-utils";

export async function GET(request: Request) {
  try {
    const userId = getUserId(request);
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action") || "list";

    if (action === "messages") {
      const friendId = parseInt(searchParams.get("friendId") || "0");
      if (!friendId) return NextResponse.json({ error: "Missing friendId" }, { status: 400 });

      const messages = db.select().from(schema.friendChat)
        .where(or(
          and(eq(schema.friendChat.userId, userId), eq(schema.friendChat.friendId, friendId)),
          and(eq(schema.friendChat.userId, friendId), eq(schema.friendChat.friendId, userId))
        ))
        .orderBy(desc(schema.friendChat.createdAt))
        .limit(50)
        .all();

      return NextResponse.json(messages.reverse());
    }

    // List friends
    const friends = db.select({
      id: schema.user.id,
      username: schema.user.username,
      name: schema.user.name,
      level: schema.user.level,
    })
      .from(schema.friend)
      .innerJoin(schema.user, eq(schema.friend.friendId, schema.user.id))
      .where(eq(schema.friend.userId, userId))
      .all();

    return NextResponse.json(friends);
  } catch (e) {
    return NextResponse.json({ error: "获取好友失败" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const userId = getUserId(request);
    const { action, friendId, message } = await request.json();

    if (action === "add") {
      if (!friendId) return NextResponse.json({ error: "Missing friendId" }, { status: 400 });
      if (friendId === userId) return NextResponse.json({ error: "不能添加自己" }, { status: 400 });

      const exists = db.select().from(schema.friend).where(
        and(eq(schema.friend.userId, userId), eq(schema.friend.friendId, friendId))
      ).get();
      if (exists) return NextResponse.json({ error: "已经是好友了" }, { status: 409 });

      db.insert(schema.friend).values({ userId, friendId, createdAt: new Date().toISOString() }).run();
      // 双向
      db.insert(schema.friend).values({ userId: friendId, friendId: userId, createdAt: new Date().toISOString() }).run();
      return NextResponse.json({ success: true });
    }

    if (action === "remove") {
      if (!friendId) return NextResponse.json({ error: "Missing friendId" }, { status: 400 });
      db.delete(schema.friend).where(and(eq(schema.friend.userId, userId), eq(schema.friend.friendId, friendId))).run();
      db.delete(schema.friend).where(and(eq(schema.friend.userId, friendId), eq(schema.friend.friendId, userId))).run();
      return NextResponse.json({ success: true });
    }

    if (action === "send") {
      if (!friendId || !message) return NextResponse.json({ error: "Missing fields" }, { status: 400 });
      db.insert(schema.friendChat).values({ userId, friendId, message, createdAt: new Date().toISOString() }).run();
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: "操作失败" }, { status: 500 });
  }
}
