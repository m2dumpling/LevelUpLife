"use client";

import { useEffect, useState, useCallback } from "react";

// ---- GitHub 风格 5 级绿色（暗色主题等效） ----
function getColor(level: number): string {
  const colors = [
    "oklch(0.22 0.02 260)", // 0: 无活动 — 面板底色
    "oklch(0.32 0.06 150)", // 1: 低
    "oklch(0.42 0.10 148)", // 2: 中低
    "oklch(0.55 0.15 145)", // 3: 中高
    "oklch(0.68 0.17 140)", // 4: 高 — GitHub 亮绿等效
  ];
  return colors[level] ?? colors[0];
}

const MONTH_NAMES = ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"];
const DAY_LABELS    = ["", "一", "", "三", "", "五", ""]; // 0=Sun … 6=Sat
const CELL_SIZE      = 12; // px
const CELL_GAP       = 3;  // px
const CELL_STEP      = CELL_SIZE + CELL_GAP; // 15 px per column

// ---- 把 XP 值映射为 0-4 等级 ----
function xpToLevel(xp: number): number {
  if (xp === 0)  return 0;
  if (xp <= 10)  return 1;
  if (xp <= 30)  return 2;
  if (xp <= 60)  return 3;
  return 4;
}

// ---- 扁平 cell 结构 ----
interface FlatCell {
  date: string;
  xp: number;
  isToday: boolean;
  colIdx: number;
  rowIdx: number;   // 0=Sun … 6=Sat
}

// ---- 月份标签 ----
interface MonthLabel {
  colIdx: number;
  label: string;
}

interface LogEntry { date: string; xpEarned: number; }

export function Heatmap() {
  const [data, setData] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; date: string; xp: number } | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/logs?limit=366");
      const logs: LogEntry[] = await res.json();
      const m = new Map<string, number>();
      for (const l of logs) m.set(l.date, (m.get(l.date) ?? 0) + l.xpEarned);
      setData(m);
    } catch {
      // 静默失败
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 监听任务完成事件，自动刷新
  useEffect(() => {
    const handler = () => fetchData();
    window.addEventListener("task-completed", handler);
    return () => window.removeEventListener("task-completed", handler);
  }, [fetchData]);

  // ---- 构建 53 周扁平 cell 数组（本地日期，避免 UTC 偏移） ----
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = formatLocalDate(today);

  const start = new Date(today);
  start.setDate(start.getDate() - 370);
  while (start.getDay() !== 0) start.setDate(start.getDate() - 1);

  const rawCells: { date: string; dayOfWeek: number; isToday: boolean }[] = [];
  const cursor = new Date(start);
  while (cursor <= today) {
    const ds = formatLocalDate(cursor);
    rawCells.push({ date: ds, dayOfWeek: cursor.getDay(), isToday: ds === todayStr });
    cursor.setDate(cursor.getDate() + 1);
  }

  const cols: { date: string; dayOfWeek: number; isToday: boolean }[][] = [];
  let col: typeof rawCells = [];
  for (const c of rawCells) {
    col.push(c);
    if (c.dayOfWeek === 6) { cols.push(col); col = []; }
  }
  if (col.length > 0) cols.push(col);

  const recentCols = cols.slice(-53);

  const mLabels: MonthLabel[] = [];
  recentCols.forEach((c, ci) => {
    if (c.length === 0) return;
    const month = new Date(c[0].date).getMonth();
    const label = MONTH_NAMES[month];
    if (mLabels.length === 0 || mLabels[mLabels.length - 1].label !== label) {
      mLabels.push({ colIdx: ci, label });
    }
  });

  const cells: FlatCell[] = [];
  recentCols.forEach((c, ci) => {
    for (let r = 0; r < 7; r++) {
      const day = c.find(d => d.dayOfWeek === r);
      const xp = day ? data.get(day.date) ?? 0 : 0;
      cells.push({
        date: day?.date ?? "",
        xp,
        isToday: day?.isToday ?? false,
        colIdx: ci,
        rowIdx: r,
      });
    }
  });

  // ---- 加载态 ----
  if (loading) {
    return (
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-muted-foreground">活跃度热力图</h3>
        <div className="h-28 bg-card animate-pulse rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-2" onMouseLeave={() => setTooltip(null)}>
      <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
        <span>活跃度热力图</span>
        <span className="text-[10px] text-muted-foreground/50">最近一年</span>
      </h3>

      <div className="overflow-x-auto">
        <div className="inline-flex" style={{ gap: 0 }}>
          {/* ====== 左侧：星期标签 ====== */}
          <div
            className="flex flex-col shrink-0"
            style={{ gap: CELL_GAP, paddingTop: 18, marginRight: 4 }}
          >
            {DAY_LABELS.map((label, i) => (
              <div
                key={i}
                className="flex items-center justify-end"
                style={{ width: 22, height: CELL_SIZE }}
              >
                <span className="text-[9px] text-muted-foreground/60">{label}</span>
              </div>
            ))}
          </div>

          {/* ====== 右侧：月份标签 + 网格 + 图例 ====== */}
          <div>
            {/* 月份标签 */}
            <div className="relative" style={{ height: 18 }}>
              {mLabels.map((m, i) => (
                <span
                  key={i}
                  className="absolute text-[9px] text-muted-foreground/60"
                  style={{ left: m.colIdx * CELL_STEP }}
                >
                  {m.label}
                </span>
              ))}
            </div>

            {/* 网格 */}
            <div
              style={{
                display: "grid",
                gridTemplateRows: `repeat(7, ${CELL_SIZE}px)`,
                gridAutoFlow: "column",
                gridAutoColumns: `${CELL_SIZE}px`,
                gap: CELL_GAP,
              }}
            >
              {cells.map((cell, i) => {
                const level = xpToLevel(cell.xp);
                return (
                  <div
                    key={i}
                    className="relative rounded-[2px] cursor-pointer transition-transform hover:scale-125 hover:z-10"
                    style={{
                      width: CELL_SIZE,
                      height: CELL_SIZE,
                      backgroundColor: getColor(level),
                    }}
                    onMouseEnter={(e) => {
                      if (!cell.date) return;
                      const rect = (e.target as HTMLElement).getBoundingClientRect();
                      setTooltip({ x: rect.left + rect.width / 2, y: rect.top - 8, date: cell.date, xp: cell.xp });
                    }}
                    onMouseLeave={() => setTooltip(null)}
                  >
                    {/* 今日高亮 */}
                    {cell.isToday && (
                      <div className="absolute inset-0 rounded-[2px] border-2 border-foreground/60 pointer-events-none" />
                    )}
                    {/* 0 XP 但有日期的格子显示微弱边框（仿 GitHub） */}
                    {level === 0 && cell.date && !cell.isToday && (
                      <div className="absolute inset-0 rounded-[2px] border border-border/20 pointer-events-none" />
                    )}
                  </div>
                );
              })}
            </div>

            {/* 图例 */}
            <div className="flex items-center gap-1 mt-2 justify-end">
              <span className="text-[10px] text-muted-foreground/60 mr-0.5">少</span>
              {[0, 1, 2, 3, 4].map((lv) => (
                <div
                  key={lv}
                  className="rounded-[2px]"
                  style={{ width: CELL_SIZE, height: CELL_SIZE, backgroundColor: getColor(lv) }}
                />
              ))}
              <span className="text-[10px] text-muted-foreground/60 ml-0.5">多</span>
            </div>
          </div>
        </div>
      </div>

      {/* 悬浮提示 */}
      {tooltip && (
        <div
          className="fixed z-50 pointer-events-none bg-popover border border-border rounded-md px-2.5 py-1.5 shadow-lg"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            transform: "translate(-50%, -100%)",
          }}
        >
          <p className="text-xs font-medium whitespace-nowrap">
            {formatDateCN(tooltip.date)}
          </p>
          <p className="text-xs text-muted-foreground">
            <span className="text-emerald-400 font-semibold">{tooltip.xp}</span> XP
          </p>
        </div>
      )}
    </div>
  );
}

function formatDateCN(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00"); // 避免 UTC 偏移
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

/** 本地日期 → YYYY-MM-DD 字符串（避免 toISOString 的 UTC 偏移问题） */
function formatLocalDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
