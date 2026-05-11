/**
 * JWT 鉴权 + bcrypt 密码验证
 *
 * 使用 jose (Web Crypto API) — 兼容 Edge Runtime
 * 密码使用 bcryptjs 哈希存储与比对
 */

import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";

const JWT_EXPIRATION = "30d";
const COOKIE_NAME = "lul_token";

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret === "change-me-to-a-random-string-at-least-32-chars") {
    throw new Error("JWT_SECRET 环境变量未设置或仍为默认值，请设置一个安全的随机字符串");
  }
  return new TextEncoder().encode(secret);
}

/** 签发 JWT，写入 httpOnly cookie */
export async function createToken(): Promise<string> {
  const secret = getJwtSecret();
  return new SignJWT({ sub: "hero" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRATION)
    .sign(secret);
}

/** 验证 JWT 是否有效 */
export async function verifyToken(token: string): Promise<boolean> {
  try {
    const secret = getJwtSecret();
    await jwtVerify(token, secret);
    return true;
  } catch {
    return false;
  }
}

/** Cookie 配置 */
export function getCookieOptions(): {
  name: string;
  value: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax";
  path: string;
  maxAge: number;
} {
  const thirtyDays = 30 * 24 * 60 * 60;
  return {
    name: COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: thirtyDays,
  };
}

/** Cookie 名称常量 */
export { COOKIE_NAME };

/** 检查明文密码是否与存储的哈希匹配 */
export async function verifyPassword(
  plainPassword: string,
  hashedPassword: string
): Promise<boolean> {
  return bcrypt.compare(plainPassword, hashedPassword);
}

/** 哈希密码 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}
