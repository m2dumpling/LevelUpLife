/**
 * GET  /api/guild — 获取当前用户的公会信息（含成员列表 + 排行榜排名）
 * POST /api/guild — 公会操作（create / join / leave / kick）
 */

import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, asc, sql, and } from "drizzle-orm";
import { getUserId } from "@/lib/auth";
import { totalXpFromLevelState } from "@/lib/xp-calculator";

/** 生成 6 位大写字母+数字的邀请码（保证唯一） */
function generateInviteCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  for (let attempt = 0; attempt < 10; attempt++) {
    let code = "";
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    const exists = db
      .select()
      .from(schema.guild)
      .where(eq(schema.guild.inviteCode, code))
      .get();
    if (!exists) return code;
  }
  throw new Error("无法生成唯一邀请码");
}

/** 计算 guild 的排行榜排名（按成员总 XP） */
function getGuildRank(guildId: number): number | null {
  const rows = db
    .select({
      guildId: schema.guildMember.guildId,
      level: schema.user.level,
      xp: schema.user.xp,
    })
    .from(schema.guildMember)
    .innerJoin(schema.user, eq(schema.guildMember.userId, schema.user.id))
    .all();
  const totals = new Map<number, number>();
  for (const row of rows) {
    totals.set(
      row.guildId,
      (totals.get(row.guildId) || 0) + totalXpFromLevelState(row.level, row.xp)
    );
  }
  const all = [...totals.entries()]
    .map(([guildId, totalXp]) => ({ guildId, totalXp }))
    .sort((a, b) => b.totalXp - a.totalXp || a.guildId - b.guildId);

  const idx = all.findIndex((g) => g.guildId === guildId);
  return idx >= 0 ? idx + 1 : null;
}

/** 获取用户所属公会的完整信息 */
function getUserGuild(userId: number) {
  const membership = db
    .select()
    .from(schema.guildMember)
    .where(eq(schema.guildMember.userId, userId))
    .get();
  if (!membership) return null;

  const guildData = db
    .select()
    .from(schema.guild)
    .where(eq(schema.guild.id, membership.guildId))
    .get();
  if (!guildData) return null;

  // 成员列表（含用户名）
  const members = db
    .select({
      id: schema.guildMember.id,
      userId: schema.guildMember.userId,
      username: schema.user.username,
      joinedAt: schema.guildMember.joinedAt,
    })
    .from(schema.guildMember)
    .innerJoin(schema.user, eq(schema.guildMember.userId, schema.user.id))
    .where(eq(schema.guildMember.guildId, guildData.id))
    .orderBy(asc(schema.guildMember.joinedAt))
    .all();

  const isLeader = guildData.leaderId === userId;
  const rank = getGuildRank(guildData.id);

  return {
    guild: guildData,
    members,
    isLeader,
    leaderboardRank: rank,
  };
}

export async function GET(request: Request) {
  try {
    const userId = getUserId(request);
    const data = getUserGuild(userId);

    if (!data) {
      return NextResponse.json({ guild: null });
    }
    return NextResponse.json(data);
  } catch (e) {
    console.error("Guild GET error:", e);
    return NextResponse.json({ error: "获取公会信息失败" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const userId = getUserId(request);
    const body = await request.json();
    const { action } = body;

    if (!action) {
      return NextResponse.json({ error: "缺少 action 字段" }, { status: 400 });
    }

    // ── 创建公会 ──
    if (action === "create") {
      const { name, motto } = body;
      if (!name || typeof name !== "string" || name.trim().length === 0) {
        return NextResponse.json({ error: "公会名称不能为空" }, { status: 400 });
      }
      if (name.trim().length > 20) {
        return NextResponse.json({ error: "公会名称最多 20 个字符" }, { status: 400 });
      }
      if (motto && typeof motto === "string" && motto.length > 60) {
        return NextResponse.json({ error: "公会宣言最多 60 个字符" }, { status: 400 });
      }

      // 检查是否已在其他公会
      const existing = db
        .select()
        .from(schema.guildMember)
        .where(eq(schema.guildMember.userId, userId))
        .get();
      if (existing) {
        return NextResponse.json({ error: "你已加入其他公会，请先退出" }, { status: 400 });
      }

      // 检查金币
      const user = db
        .select({ gold: schema.user.gold })
        .from(schema.user)
        .where(eq(schema.user.id, userId))
        .get();
      if (!user || user.gold < 50) {
        return NextResponse.json({ error: "创建公会需要 50 金币" }, { status: 400 });
      }

      // 扣金币
      db.update(schema.user)
        .set({ gold: sql`${schema.user.gold} - 50` })
        .where(eq(schema.user.id, userId))
        .run();

      // 生成邀请码 + 创建公会
      const inviteCode = generateInviteCode();
      const now = new Date().toISOString();

      const guild = db
        .insert(schema.guild)
        .values({
          name: name.trim(),
          motto: (motto || "").trim().slice(0, 60),
          inviteCode,
          leaderId: userId,
          hp: 100,
          maxHp: 100,
          createdAt: now,
        })
        .returning()
        .get();

      // 会长自动加入
      db.insert(schema.guildMember)
        .values({ guildId: guild.id, userId, joinedAt: now })
        .run();

      const result = getUserGuild(userId);
      return NextResponse.json({ success: true, ...result, costGold: 50 }, { status: 201 });
    }

    // ── 加入公会 ──
    if (action === "join") {
      const { inviteCode } = body;
      if (!inviteCode || typeof inviteCode !== "string" || inviteCode.trim().length === 0) {
        return NextResponse.json({ error: "请输入邀请码" }, { status: 400 });
      }

      // 检查是否已在公会
      const existing = db
        .select()
        .from(schema.guildMember)
        .where(eq(schema.guildMember.userId, userId))
        .get();
      if (existing) {
        return NextResponse.json({ error: "你已加入公会，请先退出当前公会" }, { status: 400 });
      }

      // 查找公会
      const targetGuild = db
        .select()
        .from(schema.guild)
        .where(eq(schema.guild.inviteCode, inviteCode.trim().toUpperCase()))
        .get();
      if (!targetGuild) {
        return NextResponse.json({ error: "无效的邀请码" }, { status: 404 });
      }

      const now = new Date().toISOString();
      db.insert(schema.guildMember)
        .values({ guildId: targetGuild.id, userId, joinedAt: now })
        .run();

      const result = getUserGuild(userId);
      return NextResponse.json({ success: true, ...result });
    }

    // ── 退出公会 ──
    if (action === "leave") {
      const membership = db
        .select()
        .from(schema.guildMember)
        .where(eq(schema.guildMember.userId, userId))
        .get();
      if (!membership) {
        return NextResponse.json({ error: "你不在任何公会中" }, { status: 400 });
      }

      const guildData = db
        .select()
        .from(schema.guild)
        .where(eq(schema.guild.id, membership.guildId))
        .get();
      if (!guildData) {
        // 数据异常：清理孤立成员记录
        db.delete(schema.guildMember)
          .where(eq(schema.guildMember.id, membership.id))
          .run();
        return NextResponse.json({ error: "公会不存在" }, { status: 400 });
      }

      const guildId = membership.guildId;

      // 如果是会长：转让或解散
      if (guildData.leaderId === userId) {
        const otherMembers = db
          .select()
          .from(schema.guildMember)
          .where(
            and(
              eq(schema.guildMember.guildId, guildId),
              sql`${schema.guildMember.userId} != ${userId}`,
            ),
          )
          .orderBy(asc(schema.guildMember.joinedAt))
          .all();

        if (otherMembers.length === 0) {
          // 没有其他成员 → 解散公会
          db.delete(schema.guildChat).where(eq(schema.guildChat.guildId, guildId)).run();
          db.delete(schema.guildMember).where(eq(schema.guildMember.guildId, guildId)).run();
          db.delete(schema.guild).where(eq(schema.guild.id, guildId)).run();
          return NextResponse.json({ success: true, disbanded: true });
        } else {
          // 转让给最早加入的成员
          const newLeader = otherMembers[0];
          db.update(schema.guild)
            .set({ leaderId: newLeader.userId })
            .where(eq(schema.guild.id, guildId))
            .run();
        }
      }

      // 自己退出
      db.delete(schema.guildMember)
        .where(eq(schema.guildMember.id, membership.id))
        .run();

      return NextResponse.json({ success: true, left: true });
    }

    // ── 踢出成员 ──
    if (action === "kick") {
      const { targetUserId } = body;
      if (!targetUserId || typeof targetUserId !== "number") {
        return NextResponse.json({ error: "缺少 targetUserId" }, { status: 400 });
      }

      // 确认当前用户是会长
      const membership = db
        .select()
        .from(schema.guildMember)
        .where(eq(schema.guildMember.userId, userId))
        .get();
      if (!membership) {
        return NextResponse.json({ error: "你不在任何公会中" }, { status: 400 });
      }

      const guildData = db
        .select()
        .from(schema.guild)
        .where(eq(schema.guild.id, membership.guildId))
        .get();
      if (!guildData || guildData.leaderId !== userId) {
        return NextResponse.json({ error: "只有会长可以踢人" }, { status: 403 });
      }

      if (targetUserId === userId) {
        return NextResponse.json({ error: "会长不能踢自己，请使用退出功能" }, { status: 400 });
      }

      const targetMembership = db
        .select()
        .from(schema.guildMember)
        .where(
          and(
            eq(schema.guildMember.guildId, guildData.id),
            eq(schema.guildMember.userId, targetUserId),
          ),
        )
        .get();
      if (!targetMembership) {
        return NextResponse.json({ error: "该用户不在你的公会中" }, { status: 404 });
      }

      db.delete(schema.guildMember)
        .where(eq(schema.guildMember.id, targetMembership.id))
        .run();

      const result = getUserGuild(userId);
      return NextResponse.json({ success: true, ...result });
    }

    return NextResponse.json({ error: "未知操作: " + action }, { status: 400 });
  } catch (e) {
    console.error("Guild POST error:", e);
    return NextResponse.json({ error: "公会操作失败" }, { status: 500 });
  }
}
