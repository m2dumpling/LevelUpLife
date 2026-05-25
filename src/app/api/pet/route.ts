import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { getUserId } from "@/lib/auth";
import { getTodayLocal } from "@/lib/date-utils";
import {
  getPetInfo,
  getAvailablePets,
  PET_TYPES,
  STAGE_NAMES,
  countActiveDaysSince,
} from "@/lib/pet-buffs";

export async function GET(request: Request) {
  const userId = getUserId(request);

  try {
    const pet = getPetInfo(userId);

    if (pet) {
      const activeDays = countActiveDaysSince(userId, pet.hatchedAt!);
      let daysForNextStage: number | null = null;
      let progress = 1;

      if (pet.stage === 0) {
        daysForNextStage = 7;
        progress = Math.min(activeDays / 7, 1);
      } else if (pet.stage === 1) {
        daysForNextStage = 37;
        progress = Math.min(activeDays / 37, 1);
      }

      return NextResponse.json({
        hasPet: true,
        pet: {
          ...pet,
          stageName: STAGE_NAMES[pet.stage] ?? "幼年",
          nextStageName: pet.stage < 2 ? STAGE_NAMES[pet.stage + 1] : null,
          activeDays,
          daysForNextStage,
          progress,
          remaining:
            daysForNextStage != null
              ? Math.max(daysForNextStage - activeDays, 0)
              : 0,
        },
        availablePets: [],
      });
    }

    const user = db
      .select()
      .from(schema.user)
      .where(eq(schema.user.id, userId))
      .get();
    const available = getAvailablePets(userId);

    return NextResponse.json({
      hasPet: false,
      pet: null,
      availablePets: available,
      streakDays: user?.streakDays ?? 0,
    });
  } catch (error) {
    console.error("Pet API error:", error);
    return NextResponse.json(
      { error: "加载宠物数据失败" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const userId = getUserId(request);

  try {
    const body = await request.json();
    const { action, petType } = body;

    if (action !== "hatch") {
      return NextResponse.json({ error: "无效操作" }, { status: 400 });
    }

    if (!petType) {
      return NextResponse.json({ error: "请选择宠物类型" }, { status: 400 });
    }

    const existing = db
      .select()
      .from(schema.pet)
      .where(eq(schema.pet.userId, userId))
      .get();
    if (existing) {
      return NextResponse.json({ error: "你已经有宠物了" }, { status: 400 });
    }

    const config = PET_TYPES.find((p) => p.type === petType);
    if (!config) {
      return NextResponse.json({ error: "无效的宠物类型" }, { status: 400 });
    }

    const available = getAvailablePets(userId);
    if (!available.find((a) => a.type === petType)) {
      return NextResponse.json(
        { error: "你还不满足获得该宠物的条件" },
        { status: 400 },
      );
    }

    const today = getTodayLocal();

    db.insert(schema.pet)
      .values({
        userId,
        petType,
        stage: 0,
        hatchedAt: today,
        fedToday: true,
      })
      .run();

    const petInfo = getPetInfo(userId);

    return NextResponse.json(
      {
        success: true,
        pet: petInfo,
        message: `成功孵化${config.name}！${config.emoji}`,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Pet hatch error:", error);
    return NextResponse.json({ error: "孵化失败" }, { status: 500 });
  }
}
