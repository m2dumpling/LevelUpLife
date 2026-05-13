"use client";

import { CalendarDays, Clock, Flame, Sparkles, Target } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { Task } from "@/hooks/useTasks";
import {
  getDayOfMonth,
  getDayOfWeek,
  getDaysFromTodayLocal,
  getTodayLocal,
} from "@/lib/date-utils";

interface MonthlyViewProps {
  habits: Task[];
  plans: Task[];
}

const DAY_NAMES = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

function getLabel(dateStr: string): string {
  if (dateStr === getTodayLocal()) return "今天";
  if (dateStr === getDaysFromTodayLocal(1)) return "明天";
  return `${Number(dateStr.slice(5, 7))}月${Number(dateStr.slice(8, 10))}日 ${DAY_NAMES[getDayOfWeek(dateStr)]}`;
}

function habitMatchesDate(habit: Task, dateStr: string, today: string): boolean {
  if (habit.startDate && habit.startDate > dateStr) return false;
  if (habit.endDate && habit.endDate < dateStr) return false;

  const frequency = habit.frequency || "daily";
  if (frequency === "daily") return true;
  if (frequency === "weekly") {
    if (!habit.frequencyDays) return getDayOfWeek(dateStr) === getDayOfWeek(today);
    return habit.frequencyDays.split(",").map(Number).includes(getDayOfWeek(dateStr));
  }
  if (frequency === "monthly") {
    return getDayOfMonth(dateStr) === getDayOfMonth(today);
  }
  return true;
}

export function MonthlyView({ habits, plans }: MonthlyViewProps) {
  const today = getTodayLocal();
  const groups = Array.from({ length: 30 }, (_, index) => {
    const dateStr = getDaysFromTodayLocal(index);
    const items: Array<{ task: Task; type: "habit" | "plan" }> = [];

    for (const habit of habits) {
      if (habitMatchesDate(habit, dateStr, today)) {
        items.push({ task: habit, type: "habit" });
      }
    }

    for (const plan of plans) {
      if (plan.completed || plan.status === "completed" || plan.status === "failed") continue;
      if (plan.targetDate === dateStr) {
        items.push({ task: plan, type: "plan" });
      }
    }

    return { dateStr, items };
  }).filter((group) => group.items.length > 0);

  const total = groups.reduce((sum, group) => sum + group.items.length, 0);

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
            共 {groups.length} 天 · {total} 项任务
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto mt-4 space-y-4 pr-1">
          {groups.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CalendarDays className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">未来 30 天暂无待办任务</p>
            </div>
          ) : (
            groups.map((group) => (
              <section key={group.dateStr} className="space-y-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      group.dateStr === today ? "bg-emerald-400" : "bg-border"
                    }`}
                  />
                  <span
                    className={`text-sm font-medium ${
                      group.dateStr === today ? "text-emerald-400" : "text-foreground"
                    }`}
                  >
                    {getLabel(group.dateStr)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {group.items.length} 项
                  </span>
                </div>

                <div className="space-y-1.5 ml-4 border-l-2 border-border pl-3">
                  {group.items.map(({ task, type }) => {
                    const completed = type === "habit" && group.dateStr === today && task.completed;
                    return (
                      <div
                        key={`${group.dateStr}-${type}-${task.id}`}
                        className={`flex items-center gap-2 py-1.5 px-2 rounded-md text-sm ${
                          completed ? "opacity-40 line-through" : ""
                        }`}
                      >
                        {type === "habit" ? (
                          <Flame className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                        ) : (
                          <Target className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        )}
                        <span className="flex-1 truncate">{task.title}</span>
                        {task.reminderTime && (
                          <span className="text-[10px] text-amber-400 shrink-0 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {task.reminderTime}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
