/**
 * Next.js Middleware — JWT 鉴权
 *
 * 所有非公开路由（/login + /api/auth/login 以外）均需验证 JWT cookie
 * 无效/缺少 token → 重定向到 /login
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

// 公开路由（无需登录）
const PUBLIC_PATHS = ["/login", "/api/auth/login"];

// 静态资源（无需拦截）
const STATIC_PREFIXES = ["/_next", "/favicon.ico"];

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  return STATIC_PREFIXES.some((p) => pathname.startsWith(p));
}

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    // 开发环境可以用默认值
    if (process.env.NODE_ENV === "development") {
      return new TextEncoder().encode("dev-secret-do-not-use-in-production");
    }
    throw new Error("JWT_SECRET 环境变量未设置");
  }
  return new TextEncoder().encode(secret);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 公开路由放行
  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  // 检查 JWT cookie
  const token = request.cookies.get("lul_token")?.value;

  if (!token) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  try {
    await jwtVerify(token, getJwtSecret());
    return NextResponse.next();
  } catch {
    // Token 无效或过期
    const loginUrl = new URL("/login", request.url);
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete("lul_token");
    return response;
  }
}

export const config = {
  matcher: [
    /*
     * 匹配所有路径排除:
     * - _next/static (静态文件)
     * - _next/image (图片优化)
     * - favicon.ico (图标)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
