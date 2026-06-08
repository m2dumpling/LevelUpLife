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
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ error: "请输入用户名和密码" }, { status: 400 });
    }

    // 查询用户
    const user = db.select().from(schema.user).where(eq(schema.user.username, username)).get();

    if (!user) {
      return NextResponse.json({ error: "用户名或密码错误" }, { status: 401 });
    }

    if (user.banned) {
      return NextResponse.json({ error: "账户已被冻结" }, { status: 403 });
    }

    // 验证密码
    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "用户名或密码错误" }, { status: 401 });
    }

    // 更新最后登录时间和 IP
    const loginIp = request.headers.get("cf-connecting-ip") || ip;
    const loginCountry = request.headers.get("cf-ipcountry") || null;
    db.update(schema.user)
      .set({
        lastLoginIp: loginIp,
        lastLoginCountry: loginCountry,
      })
      .where(eq(schema.user.id, user.id))
      .run();

    // 签发 JWT（携带 role）
    const token = await createToken(user.id, user.role || "user");
    const cookie = getCookieOptions();

    const response = NextResponse.json({ success: true });
    response.cookies.set(cookie.name, token, {
      httpOnly: cookie.httpOnly,
      secure: cookie.secure,
      sameSite: cookie.sameSite,
      path: cookie.path,
      maxAge: cookie.maxAge,
      domain: cookie.domain,
    });

    return response;
  } catch {
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
