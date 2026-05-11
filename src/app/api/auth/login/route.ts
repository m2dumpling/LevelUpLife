/**
 * POST /api/auth/login
 * 验证密码 → 签发 JWT → 写入 httpOnly cookie
 * 内建 rate limiting：同一 IP 每分钟最多 5 次尝试
 */

import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { createToken, getCookieOptions, verifyPassword } from "@/lib/auth";

// 简单的内存 rate limiting Map（单进程有效，重启清空）
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 60_000; // 1 分钟

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }

  if (entry.count >= MAX_ATTEMPTS) {
    return false;
  }

  entry.count++;
  return true;
}

export async function POST(request: Request) {
  // Rate limiting
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "127.0.0.1";

  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: "尝试次数过多，请 1 分钟后再试" },
      { status: 429 }
    );
  }

  try {
    const { password } = await request.json();

    if (!password || typeof password !== "string") {
      return NextResponse.json({ error: "请输入密码" }, { status: 400 });
    }

    // 查询用户
    const user = db.select().from(schema.user).where(eq(schema.user.id, 1)).get();

    if (!user) {
      return NextResponse.json(
        { error: "系统未初始化，请先运行种子脚本" },
        { status: 500 }
      );
    }

    // 验证密码
    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "密码错误" }, { status: 401 });
    }

    // 签发 JWT
    const token = await createToken();
    const cookie = getCookieOptions();

    const response = NextResponse.json({ success: true });
    response.cookies.set(cookie.name, token, {
      httpOnly: cookie.httpOnly,
      secure: cookie.secure,
      sameSite: cookie.sameSite,
      path: cookie.path,
      maxAge: cookie.maxAge,
    });

    return response;
  } catch {
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
