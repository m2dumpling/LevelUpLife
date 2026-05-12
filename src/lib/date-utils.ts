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

/** 返回 N 天前的本地日期字符串 */
export function getDaysAgoLocal(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return formatLocalDate(d);
}

/** 返回指定日期是星期几 (0=Sun, 6=Sat) */
export function getDayOfWeek(dateStr: string): number {
  return new Date(dateStr + "T12:00:00").getDay();
}

/** 返回指定日期是几号 (1-31) */
export function getDayOfMonth(dateStr: string): number {
  return new Date(dateStr + "T12:00:00").getDate();
}

/** 比较两个日期字符串: a < b 返回 -1, a === b 返回 0, a > b 返回 1 */
export function compareDates(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}
