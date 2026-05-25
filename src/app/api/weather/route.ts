/**
 * GET /api/weather — 获取用户所在城市的天气和加成
 * POST /api/weather {city} — 保存用户城市
 */

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getUserId } from "@/lib/auth";
import { getWeatherBonus } from "@/lib/weather";

export async function GET(request: Request) {
  const userId = getUserId(request);
  const user = db
    .select({ city: schema.user.city })
    .from(schema.user)
    .where(eq(schema.user.id, userId))
    .get() as { city: string | null } | undefined;

  if (!user?.city) {
    return NextResponse.json({
      city: null,
      weather: null,
      message: "未设置城市，请在设置中选择城市以获取天气加成",
    });
  }

  const weather = await getWeatherBonus(user.city);
  return NextResponse.json({
    city: user.city,
    weather,
  });
}

export async function POST(request: Request) {
  try {
    const userId = getUserId(request);
    const { city } = await request.json();

    if (!city || typeof city !== "string") {
      return NextResponse.json({ error: "缺少 city 参数" }, { status: 400 });
    }

    // 验证城市
    const validCities = [
      "北京", "上海", "广州", "深圳", "成都", "杭州", "武汉",
      "南京", "重庆", "西安", "天津", "苏州", "长沙", "郑州",
      "青岛", "厦门", "大连", "昆明",
    ];

    if (!validCities.includes(city)) {
      return NextResponse.json(
        { error: `不支持的城市: ${city}` },
        { status: 400 }
      );
    }

    db.update(schema.user)
      .set({ city, updatedAt: new Date().toISOString() })
      .where(eq(schema.user.id, userId))
      .run();

    const weather = await getWeatherBonus(city);
    return NextResponse.json({ city, weather });
  } catch (error) {
    console.error("Weather update failed:", error);
    return NextResponse.json({ error: "设置失败" }, { status: 500 });
  }
}
