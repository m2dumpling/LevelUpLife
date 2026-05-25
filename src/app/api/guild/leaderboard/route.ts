/**
 * GET /api/guild/leaderboard — 返回 TOP 10 公会（按成员总 XP 排名）
 */

import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, desc, sql } from "drizzle-orm";
import { getUserId } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    getUserId(request);

    const leaderboard = db
      .select({
        rank: sql<number>`ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(${schema.user.xp}), 0) DESC)`.as("rank"),
        guildId: schema.guildMember.guildId,
        guildName: schema.guild.name,
        memberCount: sql<number>`COUNT(DISTINCT ${schema.guildMember.userId})`,
        totalXp: sql<number>`COALESCE(SUM(${schema.user.xp}), 0)`,
      })
      .from(schema.guildMember)
      .innerJoin(schema.guild, eq(schema.guildMember.guildId, schema.guild.id))
      .innerJoin(schema.user, eq(schema.guildMember.userId, schema.user.id))
      .groupBy(schema.guildMember.guildId)
      .orderBy(desc(sql`COALESCE(SUM(${schema.user.xp}), 0)`))
      .limit(10)
      .all();

    return NextResponse.json({ leaderboard });
  } catch (e) {
    console.error("Guild leaderboard error:", e);
    return NextResponse.json({ error: "获取排行榜失败" }, { status: 500 });
  }
}
