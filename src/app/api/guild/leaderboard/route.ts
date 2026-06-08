/**
 * GET /api/guild/leaderboard — 返回 TOP 10 公会（按成员总 XP 排名）
 */

import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { getUserId } from "@/lib/auth";
import { totalXpFromLevelState } from "@/lib/xp-calculator";

export async function GET(request: Request) {
  try {
    getUserId(request);

    const rows = db
      .select({
        guildId: schema.guildMember.guildId,
        guildName: schema.guild.name,
        userId: schema.guildMember.userId,
        level: schema.user.level,
        xp: schema.user.xp,
      })
      .from(schema.guildMember)
      .innerJoin(schema.guild, eq(schema.guildMember.guildId, schema.guild.id))
      .innerJoin(schema.user, eq(schema.guildMember.userId, schema.user.id))
      .all();

    const guilds = new Map<number, { guildId: number; guildName: string; memberIds: Set<number>; totalXp: number }>();
    for (const row of rows) {
      const entry = guilds.get(row.guildId) || {
        guildId: row.guildId,
        guildName: row.guildName,
        memberIds: new Set<number>(),
        totalXp: 0,
      };
      entry.memberIds.add(row.userId);
      entry.totalXp += totalXpFromLevelState(row.level, row.xp);
      guilds.set(row.guildId, entry);
    }

    const leaderboard = [...guilds.values()]
      .sort((a, b) => b.totalXp - a.totalXp || a.guildId - b.guildId)
      .slice(0, 10)
      .map((guild, index) => ({
        rank: index + 1,
        guildId: guild.guildId,
        guildName: guild.guildName,
        memberCount: guild.memberIds.size,
        totalXp: guild.totalXp,
      }));

    return NextResponse.json({ leaderboard });
  } catch (e) {
    console.error("Guild leaderboard error:", e);
    return NextResponse.json({ error: "获取排行榜失败" }, { status: 500 });
  }
}
