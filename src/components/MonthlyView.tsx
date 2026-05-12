"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { CalendarDays, Flame, Clock, Target, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { Task } from "@/hooks/useTasks";
import { getTodayLocal } from "@/lib/date-utils";

interface MonthlyViewProps {
  habits: Task[];
  plans: Task[];
}

/** 难度配色 */
const DIFFICULTY_COLORS: Record<string, string> = {
  trivial: "text-muted-foreground",
  easy: "text-emerald-400",
  medium: "text-sky-400",
  hard: "text-purple-400",
  heroic: "text-amber-400",
};

const DIFFICULTY_BADGES: Record<string, string> = {
  trivial: "bg-muted",
  easy: "bg-emerald-500/10 border-emerald-500/30",
  medium: "bg-sky-500/10 border-sky-500/30",
  hard: "bg-purple-500/10 border-purple-500/30",
  heroic: "bg-amber-500/10 border-amber-500/30",
};

const FREQUENCY_LABELS: Record<string, string> = {
  daily: "每日",
  weekly: "每周",
  monthly: "每月",
};

const TIMEOFDAY_LABELS: Record<string, string> = {
  morning: "早晨",
  afternoon: "下午",
  evening: "晚上",
  anytime: "随时",
};

function formatLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDateCN(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

function getDayLabel(dateStr: string, today: string): string {
  if (dateStr === today) return "今天";
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (dateStr === formatLocalDateStr(tomorrow)) return "明天";
  const d = new Date(dateStr + "T12:00:00");
  const dayNames = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  return `${formatDateCN(dateStr)} ${dayNames[d.getDay()]}`;
}

export function MonthlyView({ habits, plans }: MonthlyViewProps) {
  const today = getTodayLocal();

  const dateGroups = useMemo(() => {
    const groups: {
      label: string;
      dateStr: string;
      items: Array<{ task: Task; type: "habit" | "plan" }>;
    }[] = [];

    // 生成未来 30 天
    const dates: string[] = [];
    for (let i = 0; i < 30; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      dates.push(formatLocalDateStr(d));
    }

    // 统计每个 weekday 的索引（用于每周习惯的匹配）
    const todayDate = new Date();
    const todayDayOfWeek = todayDate.getDay(); // 0=Sun
    const todayDayOfMonth = todayDate.getDate();

    for (const dateStr of dates) {
      const items: { task: Task; type: "habit" | "plan" }[] = [];
      const d = new Date(dateStr + "T12:00:00");

      // ── 日常任务 ──
      for (const habit of habits) {
        if (habit.frequency === "daily" || !habit.frequency) {
          // 每日任务每天都出现
          items.push({ task: habit, type: "habit" });
        } else if (habit.frequency === "weekly") {
          if (habit.frequencyDays) {
            const days = habit.frequencyDays.split(",").map(Number);
            if (days.includes(d.getDay())) {
              items.push({ task: habit, type: "habit" });
            }
          } else {
            // 向后兼容：与今天同 weekday
            if (d.getDay() === todayDayOfWeek) {
              items.push({ task: habit, type: "habit" });
            }
          }
        } else if (habit.frequency === "monthly") {
          // 每月任务：同月同日出现
          if (d.getDate() === todayDayOfMonth) {
            items.push({ task: habit, type: "habit" });
          }
        }
      }

      // ── 主线/支线任务 ──
      for (const plan of plans) {
        if (plan.completed) continue;
        if (plan.status === "completed" || plan.status === "failed") continue;
        if (plan.targetDate === dateStr) {
          items.push({ task: plan, type: "plan" });
        }
      }

      // 按时间排序：每日习惯在前，计划在后
      items.sort((a) => (a.type === "habit" ? -1 : 1));

      if (items.length > 0) {
        groups.push({
          label: getDayLabel(dateStr, today),
          dateStr,
          items,
        });
      }
    }

    // 按日期分组：近日优先
    return groups;
  }, [habits, plans]);

  const totalItems = dateGroups.reduce((sum, g) => sum + g.items.length, 0);

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className="gap-2 bg-card border-border hover:bg-accent"
          >
            <CalendarDays className="w-4 h-4" />
            月度视图
          </Button>
        }
      />
      <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="w-5 h-5 text-amber-400" />
            未来 30 天任务一览
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            共 {dateGroups.length} 天 · {totalItems} 项任务
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto mt-4 space-y-4 pr-1">
          {dateGroups.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CalendarDays className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">未来 30 天暂无待办任务</p>
              <p className="text-xs mt-1 opacity-60">
                创建 Habit 或设置 Plan 截止日期吧
              </p>
            </div>
          ) : (
            dateGroups.map((group) => (
              <motion.div
                key={group.dateStr}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                {/* 日期标题 */}
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      group.dateStr === today
                        ? "bg-emerald-400 animate-pulse"
                        : "bg-border"
                    }`}
                  />
                  <span
                    className={`text-sm font-medium ${
                      group.dateStr === today
                        ? "text-emerald-400"
                        : "text-foreground"
                    }`}
                  >
                    {group.label}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {group.items.length} 项
                  </span>
                </div>

                {/* 任务列表 */}
                <div className="space-y-1.5 ml-4 border-l-2 border-border pl-3">
                  {group.items.map(({ task, type }) => {
                    // habit 的 completed 仅对"今天"有意义（来自今日 habitLog）；
                    // 未来日期的 habit 尚未发生，始终视为未完成。
                    const isCompleted =
                      type === "habit"
                        ? group.dateStr === today && task.completed
                        : task.completed;

                    return (
                      <div
                        key={`${task.id}-${type}`}
                        className={`flex items-center gap-2 py-1.5 px-2 rounded-md text-sm ${
                          isCompleted
                            ? "opacity-40 line-through"
                            : type === "plan"
                            ? "bg-amber-500/5"
                            : ""
                        }`}
                      >
                        {/* 类型图标 */}
                        {type === "habit" ? (
                          <Flame className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                        ) : (
                          <Target className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        )}

                        {/* 标题 */}
                        <span className="flex-1 truncate">{task.title}</span>

                        {/* 元信息 */}
                        {type === "habit" && (
                          <span className="text-[10px] text-muted-foreground shrink-0 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {FREQUENCY_LABELS[task.frequency || "daily"]}
                            {task.frequency !== "daily" &&
                              ` · ${TIMEOFDAY_LABELS[task.timeOfDay || "anytime"]}`}
                          </span>
                        )}

                        {/* 难度标记 */}
                        {type === "plan" && (
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded border shrink-0 ${
                              DIFFICULTY_BADGES[task.difficulty] || ""
                            } ${DIFFICULTY_COLORS[task.difficulty] || ""}`}
                          >
                            {task.difficulty === "heroic"
                              ? "史诗"
                              : task.difficulty === "hard"
                              ? "困难"
                              : task.difficulty === "medium"
                              ? "中等"
                              : task.difficulty === "trivial"
                              ? "简单"
                              : "普通"}
                          </span>
                        )}

                        {/* 完成标记 */}
                        {isCompleted && (
                          <span className="text-[10px] text-emerald-400 font-bold shrink-0 border border-emerald-400/30 rounded px-1 py-0.5">
                            CLEAR
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
