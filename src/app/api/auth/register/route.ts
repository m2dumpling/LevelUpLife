import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { hashPassword, createToken, getCookieOptions } from "@/lib/auth";
import { eq } from "drizzle-orm";

// In-memory rate limiter: max 3 registrations per IP per hour
const rateMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateMap.set(ip, { count: 1, resetAt: now + 3600000 });
    return true;
  }
  if (entry.count >= 3) return false;
  entry.count++;
  return true;
}

export async function POST(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const { username, password } = await request.json();

    // 先校验输入合法性，合法请求才计入限流
    if (!username || !password) {
      return NextResponse.json({ error: "用户名和密码为必填项" }, { status: 400 });
    }
    if (!/^[a-zA-Z0-9_一-鿿]{2,20}$/.test(username)) {
      return NextResponse.json({ error: "用户名 2-20 位，仅支持字母、数字、下划线、中文" }, { status: 400 });
    }
    if (password.length < 4) {
      return NextResponse.json({ error: "密码至少 4 位" }, { status: 400 });
    }

    // 限流放在校验之后，避免无效请求消耗配额
    if (!checkRateLimit(ip)) {
      return NextResponse.json({ error: "注册太频繁，请一小时后再试" }, { status: 429 });
    }

    const existing = db
      .select({ id: schema.user.id })
      .from(schema.user)
      .where(eq(schema.user.username, username))
      .get();

    if (existing) {
      return NextResponse.json({ error: "用户名已被占用" }, { status: 409 });
    }

    const now = new Date().toISOString();
    const passwordHash = await hashPassword(password);
    const registerIp = request.headers.get("cf-connecting-ip") || ip;
    const registerCountry = request.headers.get("cf-ipcountry") || null;

    const user = db
      .insert(schema.user)
      .values({
        username,
        name: username,
        passwordHash,
        registerIp,
        registerCountry,
        createdAt: now,
        updatedAt: now,
      })
      .returning()
      .get();

    // 为新用户播种成就和剧情
    const { SEED_ACHIEVEMENTS, SEED_STORY_EVENTS } = await import("@/lib/seed-data");
    for (const ach of SEED_ACHIEVEMENTS) {
      db.insert(schema.achievement).values({ userId: user.id, key: ach.key, title: ach.title, description: ach.description, icon: ach.icon, isHidden: ach.isHidden, unlocked: false }).run();
    }
    for (const evt of SEED_STORY_EVENTS) {
      db.insert(schema.storyEvent).values({ userId: user.id, chapterKey: evt.chapterKey, triggerCondition: evt.triggerCondition, title: evt.title, dialogue: evt.dialogue, npcName: evt.npcName, reward: evt.reward, isTriggered: false, sortOrder: evt.sortOrder }).run();
    }

    const token = await createToken(user.id, user.role || "user");
    const cookieOpts = getCookieOptions();

    const res = NextResponse.json({ success: true, username: user.username }, { status: 201 });
    res.cookies.set(cookieOpts.name, token, {
      httpOnly: cookieOpts.httpOnly,
      secure: cookieOpts.secure,
      sameSite: cookieOpts.sameSite,
      path: cookieOpts.path,
      maxAge: cookieOpts.maxAge,
    });

    return res;
  } catch (e) {
    console.error("注册失败:", e);
    return NextResponse.json({ error: "注册失败" }, { status: 500 });
  }
}
