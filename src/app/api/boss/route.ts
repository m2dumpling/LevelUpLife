/**
 * GET  /api/boss — 当前 BOSS 状态 + 贡献排行
 * POST /api/boss — (内部调用) 每次打卡时记录伤害
 */

import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, desc, sql, and } from "drizzle-orm";
import { getUserId } from "@/lib/auth";
import { getTodayLocal } from "@/lib/date-utils";

const BOSS_NAMES = [
  { name: "拖延之龙", emoji: "🐉" },
  { name: "懒惰巨魔", emoji: "👹" },
  { name: "散漫女巫", emoji: "🧙‍♀️" },
  { name: "手机成瘾兽", emoji: "📱" },
  { name: "熬夜恶魔", emoji: "😈" },
  { name: "垃圾食品史莱姆", emoji: "🟢" },
  { name: "焦虑幻影", emoji: "👻" },
  { name: "完美主义石像", emoji: "🗿" },
];

const DAMAGE_PER_DIFFICULTY: Record<string, number> = {
  trivial: 1, easy: 2, medium: 4, hard: 8, heroic: 16,
};

function getMonday(): string {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay() + (d.getDay() === 0 ? -6 : 1));
  return d.toISOString().split("T")[0];
}

function getToday(): string { return new Date().toISOString().split("T")[0]; }

function countActiveUsers(): number {
  const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString().split("T")[0];
  return db.select().from(schema.user).all().filter(u => (u.lastLoginDate || "") >= threeDaysAgo).length;
}

function spawnBoss() {
  const today = getToday();
  const existing = db.select().from(schema.boss).where(eq(schema.boss.weekStart, today)).get();
  if (existing) return existing;

  const bossDef = BOSS_NAMES[Math.floor(Math.random() * BOSS_NAMES.length)];
  const activeUsers = Math.max(1, countActiveUsers());
  const maxHp = activeUsers * 20 + Math.floor(Math.random() * 50);
  const rewardGold = 50 + Math.floor(Math.random() * 100);
  const boss = db.insert(schema.boss).values({
    name: bossDef.name, emoji: bossDef.emoji, hp: maxHp, maxHp, weekStart: today, defeated: false,
    rewardGold,
  }).returning().get();
  return boss;
}

export async function GET(request: Request) {
  try {
    getUserId(request);
    const boss = spawnBoss();

    const contributions = db.select({
      userId: schema.bossContribution.userId,
      damage: sql<number>`SUM(${schema.bossContribution.damage})`,
      username: schema.user.username,
    })
      .from(schema.bossContribution)
      .innerJoin(schema.user, eq(schema.bossContribution.userId, schema.user.id))
      .where(eq(schema.bossContribution.bossId, boss.id))
      .groupBy(schema.bossContribution.userId)
      .orderBy(desc(sql`SUM(${schema.bossContribution.damage})`))
      .limit(10)
      .all();

    const totalUsers = contributions.length;
    const totalDamage = contributions.reduce((s, c) => s + Number(c.damage), 0);

    // 如果击败了且未通知过，标记已通知
    if (boss.defeated && !boss.notified) {
      db.update(schema.boss).set({ notified: true }).where(eq(schema.boss.id, boss.id)).run();
    }

    return NextResponse.json({
      ...boss,
      contributions,
      totalUsers,
      totalDamage,
      hpPercent: Math.max(0, Math.round((boss.hp / boss.maxHp) * 100)),
      dayEnd: getToday(),
      activeUsers: countActiveUsers(),
      reward: { gold: boss.rewardGold || 80, description: "击败BOSS所有参战者瓜分金币奖励" },
      damageTable: DAMAGE_PER_DIFFICULTY,
    });
  } catch (e) {
    return NextResponse.json({ error: "获取BOSS信息失败" }, { status: 500 });
  }
}

/** 内部调用：记录打卡伤害。同一用户+同一任务+同一天只造成一次伤害 */
export async function recordBossDamage(userId: number, difficulty: string, taskId?: number): Promise<void> {
  const boss = spawnBoss();
  if (boss.defeated) return;

  const dmg = DAMAGE_PER_DIFFICULTY[difficulty] || 1;
  const today = new Date().toISOString().split("T")[0];

  // 防刷：同一用户+同一任务+同一天只造成一次伤害
  if (taskId) {
    const existing = db.select().from(schema.bossContribution).where(
      and(
        eq(schema.bossContribution.bossId, boss.id),
        eq(schema.bossContribution.userId, userId),
        eq(schema.bossContribution.taskId, taskId),
        eq(schema.bossContribution.damageDate, today),
      )
    ).get();
    if (existing) return;
  }

  db.insert(schema.bossContribution).values({ bossId: boss.id, userId, taskId: taskId || 0, damage: dmg, damageDate: today }).run();

  const newHp = Math.max(0, boss.hp - dmg);
  db.update(schema.boss).set({ hp: newHp, defeated: newHp <= 0 }).where(eq(schema.boss.id, boss.id)).run();
}

/** 内部调用：BOSS被击败后分发奖励 */
export async function checkBossDefeatedReward(): Promise<string | null> {
  const boss = spawnBoss();
  if (!boss.defeated) return null;

  const contributed = db.select({ userId: schema.bossContribution.userId })
    .from(schema.bossContribution)
    .where(eq(schema.bossContribution.bossId, boss.id))
    .all();

  const rewardGold = boss.rewardGold || 80;
  const rewarded = new Set<number>();
  for (const c of contributed) {
    if (rewarded.has(c.userId)) continue;
    rewarded.add(c.userId);
    const reward = rewardGold;
    db.update(schema.user)
      .set({ gold: sql`${schema.user.gold} + ${reward}` })
      .where(eq(schema.user.id, c.userId))
      .run();
  }

  return `🎉 ${boss.emoji} ${boss.name} 被击败了！${rewarded.size} 名勇士瓜分了战利品！`;
}
