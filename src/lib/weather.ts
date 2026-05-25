/**
 * 天气系统
 *
 * getWeatherBonus(city): 调用 Open-Meteo API 获取天气，返回室内/室外加成
 * getWeatherBonusForTask(userId, taskTitle): 直接获取任务适用的加成倍率
 */

import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

// ── 城市经纬度映射 ──
const CITY_COORDS: Record<string, { lat: number; lon: number }> = {
  北京: { lat: 39.9042, lon: 116.4074 },
  上海: { lat: 31.2304, lon: 121.4737 },
  广州: { lat: 23.1291, lon: 113.2644 },
  深圳: { lat: 22.5431, lon: 114.0579 },
  成都: { lat: 30.5728, lon: 104.0668 },
  杭州: { lat: 30.2741, lon: 120.1551 },
  武汉: { lat: 30.5928, lon: 114.3055 },
  南京: { lat: 32.0603, lon: 118.7969 },
  重庆: { lat: 29.4316, lon: 106.9123 },
  西安: { lat: 34.3416, lon: 108.9398 },
  天津: { lat: 39.0842, lon: 117.2009 },
  苏州: { lat: 31.2990, lon: 120.5853 },
  长沙: { lat: 28.2282, lon: 112.9388 },
  郑州: { lat: 34.7466, lon: 113.6253 },
  青岛: { lat: 36.0671, lon: 120.3826 },
  厦门: { lat: 24.4798, lon: 118.0894 },
  大连: { lat: 38.9140, lon: 121.6147 },
  昆明: { lat: 25.0389, lon: 102.7183 },
};

// ── WMO 天气代码映射 ──
type WeatherCategory = "clear" | "cloudy" | "fog" | "rain" | "snow" | "storm";

function categorizeWeather(code: number): WeatherCategory {
  if (code === 0) return "clear";
  if (code >= 1 && code <= 3) return "cloudy";
  if (code >= 45 && code <= 48) return "fog";
  if (code >= 51 && code <= 67) return "rain";
  if (code >= 71 && code <= 77) return "snow";
  if (code >= 80 && code <= 99) return "storm";
  return "cloudy";
}

function weatherEmoji(category: WeatherCategory): string {
  switch (category) {
    case "clear": return "☀️";
    case "cloudy": return "⛅";
    case "fog": return "🌫️";
    case "rain": return "🌧️";
    case "snow": return "🌨️";
    case "storm": return "⛈️";
  }
}

function weatherLabel(category: WeatherCategory): string {
  switch (category) {
    case "clear": return "晴朗";
    case "cloudy": return "多云";
    case "fog": return "雾";
    case "rain": return "下雨";
    case "snow": return "下雪";
    case "storm": return "雷暴";
  }
}

// ── 判定任务是否户外 ──
const OUTDOOR_KEYWORDS = [
  "运动", "跑步", "健身", "锻炼",
  "游泳", "户外", "散步", "登山",
  "骑行", "足球", "篮球", "羽毛球",
  "跳绳", "滑板", "攀岩",
];

export function isOutdoorTask(title: string): boolean {
  return OUTDOOR_KEYWORDS.some((kw) => title.includes(kw));
}

// ── 缓存 ──
interface WeatherCache {
  condition: string;
  category: WeatherCategory;
  emoji: string;
  indoorBonus: number;
  outdoorBonus: number;
  timestamp: number;
}
const weatherCache = new Map<string, WeatherCache>();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 分钟

// ── 周末判定（北京时间） ──
function isWeekendBeijing(): boolean {
  const now = new Date();
  const day = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    weekday: "short",
  }).format(now);
  return day === "Sat" || day === "Sun";
}

// ── 主要 API ──
export interface WeatherBonus {
  condition: string;
  emoji: string;
  indoorBonus: number;
  outdoorBonus: number;
}

export async function getWeatherBonus(city: string): Promise<WeatherBonus> {
  // 检查缓存
  const cached = weatherCache.get(city);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return {
      condition: cached.condition,
      emoji: cached.emoji,
      indoorBonus: cached.indoorBonus,
      outdoorBonus: cached.outdoorBonus,
    };
  }

  const coords = CITY_COORDS[city];
  if (!coords) {
    return { condition: "未知", emoji: "❓", indoorBonus: 1.0, outdoorBonus: 1.0 };
  }

  let category: WeatherCategory = "cloudy";

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&current=weather_code&timezone=Asia/Shanghai`;
    const res = await fetch(url, {
      headers: { "User-Agent": "LevelUpLife/1.0" },
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const data = await res.json();
      const code = data?.current?.weather_code;
      if (typeof code === "number") {
        category = categorizeWeather(code);
      }
    }
  } catch {
    // API 不可用时使用默认值
  }

  // 基础加成
  let indoorBonus = 1.0;
  let outdoorBonus = 1.0;
  const condition = weatherLabel(category);

  switch (category) {
    case "rain":
    case "snow":
    case "storm":
      indoorBonus = 1.2;
      outdoorBonus = 1.0;
      break;
    case "clear":
      indoorBonus = 1.0;
      outdoorBonus = 1.2;
      break;
    default:
      indoorBonus = 1.0;
      outdoorBonus = 1.0;
      break;
  }

  // 周末双倍
  if (isWeekendBeijing()) {
    indoorBonus *= 1.5;
    outdoorBonus *= 1.5;
  }

  // 写入缓存
  weatherCache.set(city, {
    condition,
    category,
    emoji: weatherEmoji(category),
    indoorBonus,
    outdoorBonus,
    timestamp: Date.now(),
  });

  return {
    condition,
    emoji: weatherEmoji(category),
    indoorBonus,
    outdoorBonus,
  };
}

/** 根据用户和任务标题获取适用的天气加成倍率 */
export async function getWeatherBonusForTask(
  userId: number,
  taskTitle: string
): Promise<number> {
  const user = db.select({ city: schema.user.city })
    .from(schema.user)
    .where(eq(schema.user.id, userId))
    .get() as { city: string | null } | undefined;

  if (!user?.city) return 1.0;

  const bonus = await getWeatherBonus(user.city);
  return isOutdoorTask(taskTitle) ? bonus.outdoorBonus : bonus.indoorBonus;
}

/** 同步版：仅读取缓存，无缓存时返回 1.0（用于同步奖励计算） */
export function getWeatherBonusForTaskSync(
  userId: number,
  taskTitle: string
): number {
  const user = db.select({ city: schema.user.city })
    .from(schema.user)
    .where(eq(schema.user.id, userId))
    .get() as { city: string | null } | undefined;

  if (!user?.city) return 1.0;

  const cached = weatherCache.get(user.city);
  if (!cached || Date.now() - cached.timestamp >= CACHE_TTL_MS) return 1.0;

  return isOutdoorTask(taskTitle) ? cached.outdoorBonus : cached.indoorBonus;
}
