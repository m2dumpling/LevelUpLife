/**
 * GET  /api/guild/chat — 返回当前公会的最近 50 条消息（用户必须是成员）
 * POST /api/guild/chat — 发送一条公会聊天消息
 *
 * 每次 GET 时清理超过上周日 23:59（北京时间）的消息
 */

import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, desc, lt } from "drizzle-orm";
import { getUserId } from "@/lib/auth";

/**
 * 计算"最近一个周日 23:59:59 北京时间"对应的 UTC ISO 字符串。
 * 北京时间比 UTC 快 8 小时，所以 23:59:59 北京 = 15:59:59 UTC。
 */
function getLastSundayBeijingCutoff(): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });
  const parts = formatter.formatToParts(new Date());

  const weekdayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  const weekday =
    weekdayMap[parts.find((p) => p.type === "weekday")?.value || "Sun"] ?? 0;
  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  const day = Number(parts.find((p) => p.type === "day")?.value);

  // daysBack: 如果今天是周日=0, 周一=1, … 周六=6
  const daysBack = weekday;
  // 北京时间 23:59:59.999 = UTC 15:59:59.999
  const cutoffUtc = Date.UTC(year, month - 1, day - daysBack, 15, 59, 59, 999);
  return new Date(cutoffUtc).toISOString();
}

export async function GET(request: Request) {
  try {
    const userId = getUserId(request);

    // 找到用户所属公会
    const membership = db
      .select()
      .from(schema.guildMember)
      .where(eq(schema.guildMember.userId, userId))
      .get();
    if (!membership) {
      return NextResponse.json({ error: "你不在任何公会中" }, { status: 400 });
    }

    // 清理过期消息
    const cutoff = getLastSundayBeijingCutoff();
    db.delete(schema.guildChat)
      .where(lt(schema.guildChat.createdAt, cutoff))
      .run();

    // 获取最近 100 条消息
    const messages = db
      .select()
      .from(schema.guildChat)
      .where(eq(schema.guildChat.guildId, membership.guildId))
      .orderBy(desc(schema.guildChat.createdAt))
      .limit(100)
      .all()
      .reverse(); // 正序返回

    return NextResponse.json({ messages });
  } catch (e) {
    console.error("Guild chat GET error:", e);
    return NextResponse.json({ error: "获取聊天消息失败" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const userId = getUserId(request);
    const body = await request.json();
    const { message, replyTo } = body;

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return NextResponse.json({ error: "消息不能为空" }, { status: 400 });
    }
    if (message.trim().length > 500) {
      return NextResponse.json({ error: "消息最多 500 个字符" }, { status: 400 });
    }

    // 确认是公会成员
    const membership = db
      .select()
      .from(schema.guildMember)
      .where(eq(schema.guildMember.userId, userId))
      .get();
    if (!membership) {
      return NextResponse.json({ error: "你不在任何公会中" }, { status: 400 });
    }

    // 获取用户名
    const user = db
      .select({ username: schema.user.username })
      .from(schema.user)
      .where(eq(schema.user.id, userId))
      .get();
    if (!user) {
      return NextResponse.json({ error: "用户不存在" }, { status: 400 });
    }

    // 处理回复
    let replyUsername: string | null = null;
    let replyPreview: string | null = null;
    if (replyTo && typeof replyTo === "number") {
      const repliedMsg = db
        .select()
        .from(schema.guildChat)
        .where(eq(schema.guildChat.id, replyTo))
        .get();
      if (repliedMsg) {
        replyUsername = repliedMsg.username;
        replyPreview = repliedMsg.message.slice(0, 50);
      }
    }

    const now = new Date().toISOString();
    const chatEntry = db
      .insert(schema.guildChat)
      .values({
        guildId: membership.guildId,
        userId,
        username: user.username,
        message: message.trim(),
        replyTo: replyTo || null,
        replyUsername,
        replyPreview,
        createdAt: now,
      })
      .returning()
      .get();

    return NextResponse.json({ success: true, message: chatEntry }, { status: 201 });
  } catch (e) {
    console.error("Guild chat POST error:", e);
    return NextResponse.json({ error: "发送消息失败" }, { status: 500 });
  }
}
