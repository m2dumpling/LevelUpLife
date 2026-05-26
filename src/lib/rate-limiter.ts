import { eq, and } from "drizzle-orm";
import { db, schema } from "@/lib/db";

const ONE_MINUTE_MS = 60_000;
const ONE_DAY_MS = 86_400_000;

/**
 * 检查操作频率限制
 * @param userId 用户ID
 * @param actionType 操作类型: "task_create" | "task_complete" | "pvp_match"
 * @param maxPerWindow 时间窗口内的最大操作数
 * @returns { allowed: boolean, message?: string }
 */
export function checkRate(
  userId: number,
  actionType: "task_create" | "task_complete" | "pvp_match",
  maxPerWindow: number
): { allowed: boolean; message?: string } {
  const now = Date.now();

  // 判断时间窗口大小
  const windowMs = actionType === "pvp_match" ? ONE_DAY_MS : ONE_MINUTE_MS;
  const windowStart = new Date(now - windowMs).toISOString();

  // 查找当前窗口内的记录
  const record = db
    .select()
    .from(schema.rateLimit)
    .where(
      and(
        eq(schema.rateLimit.userId, userId),
        eq(schema.rateLimit.actionType, actionType)
      )
    )
    .get();

  if (!record) {
    // 首次操作，创建记录
    db.insert(schema.rateLimit)
      .values({
        userId,
        actionType,
        count: 1,
        windowStart: new Date(now).toISOString(),
      })
      .run();
    return { allowed: true };
  }

  // 检查窗口是否过期
  const recordWindowStart = new Date(record.windowStart).getTime();
  if (now - recordWindowStart > windowMs) {
    // 窗口已过期，重置
    db.update(schema.rateLimit)
      .set({ count: 1, windowStart: new Date(now).toISOString() })
      .where(
        and(
          eq(schema.rateLimit.userId, userId),
          eq(schema.rateLimit.actionType, actionType)
        )
      )
      .run();
    return { allowed: true };
  }

  // 窗口内，检查计数
  if (record.count >= maxPerWindow) {
    const messages: Record<string, string> = {
      task_create: "操作太频繁了，每分钟最多创建 3 个任务，请稍后再试",
      task_complete: "操作太频繁了，每分钟最多完成 2 个任务，请稍后再试",
      pvp_match: "今日 PvP 对战次数已达上限（每日 10 次），明天再来吧",
    };
    return { allowed: false, message: messages[actionType] };
  }

  // 增加计数
  db.update(schema.rateLimit)
    .set({ count: record.count + 1 })
    .where(
      and(
        eq(schema.rateLimit.userId, userId),
        eq(schema.rateLimit.actionType, actionType)
      )
    )
    .run();

  return { allowed: true };
}
