import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, and, or, desc } from "drizzle-orm";
import { getUserId } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const userId = getUserId(request);
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action") || "list";

    // 好友列表
    if (action === "list") {
      const friends = db.select({
        id: schema.user.id, username: schema.user.username, name: schema.user.name, level: schema.user.level,
        note: schema.friend.note,
      }).from(schema.friend).innerJoin(schema.user, eq(schema.friend.friendId, schema.user.id))
        .where(eq(schema.friend.userId, userId)).all();
      return NextResponse.json(friends);
    }

    // 收到的好友请求
    if (action === "requests") {
      const requests = db.select({
        id: schema.friendRequest.id, fromUserId: schema.friendRequest.fromUserId,
        username: schema.user.username, name: schema.user.name, level: schema.user.level,
        createdAt: schema.friendRequest.createdAt,
      }).from(schema.friendRequest).innerJoin(schema.user, eq(schema.friendRequest.fromUserId, schema.user.id))
        .where(and(eq(schema.friendRequest.toUserId, userId), eq(schema.friendRequest.status, "pending"))).all();
      return NextResponse.json(requests);
    }

    // 聊天消息
    if (action === "messages") {
      const friendId = parseInt(searchParams.get("friendId") || "0");
      if (!friendId) return NextResponse.json({ error: "Missing friendId" }, { status: 400 });
      const messages = db.select().from(schema.friendChat).where(or(
        and(eq(schema.friendChat.userId, userId), eq(schema.friendChat.friendId, friendId)),
        and(eq(schema.friendChat.userId, friendId), eq(schema.friendChat.friendId, userId))
      )).orderBy(desc(schema.friendChat.createdAt)).limit(50).all();
      return NextResponse.json(messages.reverse());
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: "获取失败" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const userId = getUserId(request);
    const { action, friendId, message, note, replyTo, replyPreview } = await request.json();

    // 发送好友请求
    if (action === "request") {
      if (!friendId) return NextResponse.json({ error: "Missing friendId" }, { status: 400 });
      if (friendId === userId) return NextResponse.json({ error: "不能添加自己" }, { status: 400 });

      const alreadyFriend = db.select().from(schema.friend).where(
        and(eq(schema.friend.userId, userId), eq(schema.friend.friendId, friendId))
      ).get();
      if (alreadyFriend) return NextResponse.json({ error: "已经是好友了" }, { status: 409 });

      const pending = db.select().from(schema.friendRequest).where(
        and(eq(schema.friendRequest.fromUserId, userId), eq(schema.friendRequest.toUserId, friendId), eq(schema.friendRequest.status, "pending"))
      ).get();
      if (pending) return NextResponse.json({ error: "已发送过好友请求" }, { status: 409 });

      db.insert(schema.friendRequest).values({ fromUserId: userId, toUserId: friendId, status: "pending", createdAt: new Date().toISOString() }).run();
      return NextResponse.json({ success: true, message: "好友请求已发送" });
    }

    // 接受好友请求
    if (action === "accept") {
      const req = db.select().from(schema.friendRequest).where(
        and(eq(schema.friendRequest.id, friendId), eq(schema.friendRequest.toUserId, userId), eq(schema.friendRequest.status, "pending"))
      ).get();
      if (!req) return NextResponse.json({ error: "请求不存在" }, { status: 404 });

      db.update(schema.friendRequest).set({ status: "accepted" }).where(eq(schema.friendRequest.id, req.id)).run();
      const now = new Date().toISOString();
      db.insert(schema.friend).values({ userId, friendId: req.fromUserId, createdAt: now }).run();
      db.insert(schema.friend).values({ userId: req.fromUserId, friendId: userId, createdAt: now }).run();
      return NextResponse.json({ success: true });
    }

    // 拒绝/忽略好友请求
    if (action === "reject") {
      db.update(schema.friendRequest).set({ status: "rejected" }).where(
        and(eq(schema.friendRequest.id, friendId), eq(schema.friendRequest.toUserId, userId))
      ).run();
      return NextResponse.json({ success: true });
    }

    // 删除好友
    if (action === "remove") {
      if (!friendId) return NextResponse.json({ error: "Missing friendId" }, { status: 400 });
      db.delete(schema.friend).where(and(eq(schema.friend.userId, userId), eq(schema.friend.friendId, friendId))).run();
      db.delete(schema.friend).where(and(eq(schema.friend.userId, friendId), eq(schema.friend.friendId, userId))).run();
      return NextResponse.json({ success: true });
    }

    // 发送消息
    if (action === "send") {
      if (!friendId || !message) return NextResponse.json({ error: "Missing fields" }, { status: 400 });
      const finalMessage = replyTo && replyPreview
        ? `[回复] ${replyPreview}\n${message}`
        : message;
      db.insert(schema.friendChat).values({ userId, friendId, message: finalMessage, createdAt: new Date().toISOString() }).run();
      return NextResponse.json({ success: true });
    }

    // 修改备注
    if (action === "note") {
      if (!friendId) return NextResponse.json({ error: "Missing friendId" }, { status: 400 });
      db.update(schema.friend).set({ note: note || null }).where(
        and(eq(schema.friend.userId, userId), eq(schema.friend.friendId, friendId))
      ).run();
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: "操作失败" }, { status: 500 });
  }
}
