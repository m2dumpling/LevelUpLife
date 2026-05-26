/** Date helpers. The app's business day is always Beijing time. */

const BEIJING_TIME_ZONE = "Asia/Shanghai";
const DAY_MS = 24 * 60 * 60 * 1000;

/** Return YYYY-MM-DD in the app business timezone. */
export function formatLocalDate(d: Date): string {
  return formatBeijingDate(d);
}

/** Return YYYY-MM-DD in Beijing time, independent of server timezone. */
export function formatBeijingDate(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BEIJING_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

/** Return yesterday's Beijing date. */
export function getYesterdayLocal(): string {
  return getDaysAgoLocal(1);
}

/** Return today's Beijing date. */
export function getTodayLocal(): string {
  return formatBeijingDate(new Date());
}

/** Return the Beijing date N days ago. */
export function getDaysAgoLocal(n: number): string {
  return formatBeijingDate(new Date(Date.now() - n * DAY_MS));
}

/** Return the Beijing date N days from today. */
export function getDaysFromTodayLocal(n: number): string {
  return formatBeijingDate(new Date(Date.now() + n * DAY_MS));
}

/** Format an ISO date string as HH:MM in Beijing time. */
export function formatBeijingTime(iso: string): string {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BEIJING_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const hh = parts.find((p) => p.type === "hour")?.value ?? "00";
  const mm = parts.find((p) => p.type === "minute")?.value ?? "00";
  return `${hh}:${mm}`;
}

/** Format a Date object as YYYY年M月D日 in Beijing time. */
export function formatBeijingDateFull(d: Date): string {
  const parts = new Intl.DateTimeFormat("zh-CN", {
    timeZone: BEIJING_TIME_ZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  return `${y}年${m}月${day}日`;
}

/** Return day of week for a Beijing date string. 0=Sun, 6=Sat. */
export function getDayOfWeek(dateStr: string): number {
  return new Date(`${dateStr}T12:00:00+08:00`).getUTCDay();
}

/** Return day of month for a YYYY-MM-DD date string. */
export function getDayOfMonth(dateStr: string): number {
  return Number(dateStr.slice(8, 10));
}

/** Compare YYYY-MM-DD date strings. */
export function compareDates(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}
