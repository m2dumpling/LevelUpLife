/** 日期工具 — 避免 UTC 偏移问题 */

/** 返回本地日期字符串 YYYY-MM-DD */
export function formatLocalDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** 返回昨天的本地日期字符串 */
export function getYesterdayLocal(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return formatLocalDate(d);
}

/** 返回今天的本地日期字符串 */
export function getTodayLocal(): string {
  return formatLocalDate(new Date());
}
