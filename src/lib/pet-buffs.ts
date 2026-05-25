/**
 * 宠物 Buff 计算引擎
 *
 * 宠物类型、阶段倍率、进化条件
 * 幼年=1x, 成年=1.5x, 传说=2x
 */

import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";

export interface PetBuffResult {
  xpBonus: number;
  goldBonus: number;
}

export interface PetInfo {
  id: number;
  userId: number;
  petType: string;
  stage: number;
  hatchedAt: string | null;
  fedToday: boolean;
  name: string;
  emoji: string;
  xpBonus: number;
  goldBonus: number;
}

interface PetTypeConfig {
  type: string;
  name: string;
  emoji: string;
  xpBonus: number;
  goldBonus: number;
  requirement: string;
  minStreak: number;
  minPlans: number;
}

const STAGE_MULTIPLIER = [1, 1.5, 2];

/** 进化所需活跃天数: stage 0 孵化, stage 1 需要 7 天, stage 2 需要 37 天 */
const STAGE_DAYS = [0, 7, 37];

export const STAGE_NAMES = ["幼年", "成年", "传说"];

export const PET_EMOJIS_BY_STAGE: Record<string, string[]> = {
  chick: ["🐣", "🐔", "🦚"],
  cat: ["🐱", "😺", "🐯"],
  babyDragon: ["🐉", "🐲", "🐉"],
  fox: ["🦊", "🦊", "🦊"],
};

export const PET_TYPES: PetTypeConfig[] = [
  {
    type: "chick",
    name: "小鸡",
    emoji: "🐣",
    xpBonus: 0,
    goldBonus: 2,
    requirement: "连续打卡 3 天",
    minStreak: 3,
    minPlans: 0,
  },
  {
    type: "cat",
    name: "小猫",
    emoji: "🐱",
    xpBonus: 3,
    goldBonus: 0,
    requirement: "连续打卡 7 天",
    minStreak: 7,
    minPlans: 0,
  },
  {
    type: "babyDragon",
    name: "幼龙",
    emoji: "🐉",
    xpBonus: 10,
    goldBonus: 5,
    requirement: "连续打卡 30 天",
    minStreak: 30,
    minPlans: 0,
  },
  {
    type: "fox",
    name: "狐狸",
    emoji: "🦊",
    xpBonus: 0,
    goldBonus: 0,
    requirement: "完成 5 个以上计划",
    minStreak: 0,
    minPlans: 5,
  },
];

/** 统计某个日期之后的不同活跃天数 */
export function countActiveDaysSince(userId: number, since: string): number {
  const rows = db
    .select({ completedAt: schema.habitLog.completedAt })
    .from(schema.habitLog)
    .where(eq(schema.habitLog.userId, userId))
    .all();

  const activeDays = new Set<string>();
  for (const r of rows) {
    if (r.completedAt >= since) {
      activeDays.add(r.completedAt);
    }
  }
  return activeDays.size;
}

/** 根据活跃天数计算当前进化阶段 */
function calculateStage(
  userId: number,
  hatchedAt: string | null,
  currentStage: number,
): number {
  if (!hatchedAt) return 0;
  const activeDays = countActiveDaysSince(userId, hatchedAt);
  if (activeDays >= STAGE_DAYS[2]) return 2;
  if (activeDays >= STAGE_DAYS[1]) return 1;
  return currentStage;
}

/** 获取宠物 buff 加成百分比 */
export function getPetBuff(userId: number): PetBuffResult {
  const pet = db
    .select()
    .from(schema.pet)
    .where(eq(schema.pet.userId, userId))
    .get();
  if (!pet) return { xpBonus: 0, goldBonus: 0 };

  const newStage = calculateStage(userId, pet.hatchedAt, pet.stage);
  if (newStage !== pet.stage) {
    db.update(schema.pet)
      .set({ stage: newStage })
      .where(eq(schema.pet.id, pet.id))
      .run();
  }

  const config = PET_TYPES.find((p) => p.type === pet.petType);
  if (!config) return { xpBonus: 0, goldBonus: 0 };

  const multiplier = STAGE_MULTIPLIER[newStage] ?? 1;
  return {
    xpBonus: Math.round(config.xpBonus * multiplier),
    goldBonus: Math.round(config.goldBonus * multiplier),
  };
}

/** 获取宠物完整信息（含阶段检查与更新） */
export function getPetInfo(userId: number): PetInfo | null {
  const pet = db
    .select()
    .from(schema.pet)
    .where(eq(schema.pet.userId, userId))
    .get();
  if (!pet) return null;

  const newStage = calculateStage(userId, pet.hatchedAt, pet.stage);
  if (newStage !== pet.stage) {
    db.update(schema.pet)
      .set({ stage: newStage })
      .where(eq(schema.pet.id, pet.id))
      .run();
  }

  const config = PET_TYPES.find((p) => p.type === pet.petType);
  const multiplier = STAGE_MULTIPLIER[newStage] ?? 1;

  return {
    id: pet.id,
    userId: pet.userId,
    petType: pet.petType,
    stage: newStage,
    hatchedAt: pet.hatchedAt,
    fedToday: pet.fedToday,
    name: config?.name ?? pet.petType,
    emoji: PET_EMOJIS_BY_STAGE[pet.petType]?.[newStage] ?? config?.emoji ?? "🐾",
    xpBonus: Math.round((config?.xpBonus ?? 0) * multiplier),
    goldBonus: Math.round((config?.goldBonus ?? 0) * multiplier),
  };
}

/** 获取用户当前可孵化的宠物列表 */
export function getAvailablePets(userId: number): {
  type: string;
  name: string;
  emoji: string;
  buff: string;
}[] {
  const user = db
    .select()
    .from(schema.user)
    .where(eq(schema.user.id, userId))
    .get();
  if (!user) return [];

  const available: {
    type: string;
    name: string;
    emoji: string;
    buff: string;
  }[] = [];

  const completedPlans = db
    .select()
    .from(schema.task)
    .where(
      and(
        eq(schema.task.userId, userId),
        eq(schema.task.mode, "plan"),
        eq(schema.task.status, "completed"),
      ),
    )
    .all().length;

  for (const config of PET_TYPES) {
    if (
      user.streakDays >= config.minStreak &&
      completedPlans >= config.minPlans
    ) {
      let buffDesc = "";
      if (config.xpBonus > 0 && config.goldBonus > 0) {
        buffDesc = `+${config.xpBonus}% 经验收益 +${config.goldBonus}% 金币收益`;
      } else if (config.xpBonus > 0) {
        buffDesc = `+${config.xpBonus}% 经验收益`;
      } else if (config.goldBonus > 0) {
        buffDesc = `+${config.goldBonus}% 金币收益`;
      } else {
        buffDesc = "+5% 稀有掉落";
      }
      available.push({
        type: config.type,
        name: config.name,
        emoji: config.emoji,
        buff: buffDesc,
      });
    }
  }

  return available;
}
