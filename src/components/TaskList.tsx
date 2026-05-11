"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Flame, CalendarDays, ChevronDown, Clock, Target, AlertTriangle } from "lucide-react";
import { TaskCard } from "./TaskCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { Task } from "@/hooks/useTasks";
import { getTodayLocal } from "@/lib/date-utils";

interface TaskListProps {
  habits: Task[];
  plans: Task[];
  pending: Task[];
  completed: Task[];
  loading: boolean;
  onComplete: (id: number) => void;
  onDelete: (id: number) => void;
  onAdd: (data: {
    title: string;
    mode: "habit" | "plan";
    description?: string;
    difficulty?: string;
    frequency?: string;
    timeOfDay?: string;
    dueDate?: string;
    startDate?: string;
    status?: string;
  }) => Promise<Task | null>;
}

type TabMode = "habit" | "plan";

const DIFFICULTY_OPTIONS = [
  ["trivial", "琐碎"],
  ["easy", "简单"],
  ["medium", "中等"],
  ["hard", "困难"],
  ["heroic", "史诗"],
] as const;

const FREQUENCY_OPTIONS = [
  ["daily", "每日"],
  ["weekly", "每周"],
  ["monthly", "每月"],
] as const;

const TIMEOFDAY_OPTIONS = [
  ["anytime", "随时"],
  ["morning", "早晨"],
  ["afternoon", "下午"],
  ["evening", "晚上"],
] as const;

/** 按 dueDate 对 plan 分组 */
function groupPlansByDate(plans: Task[]) {
  const today = getTodayLocal();
  const now = new Date();
  const tomorrowDate = new Date(now);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrow = `${tomorrowDate.getFullYear()}-${String(tomorrowDate.getMonth() + 1).padStart(2, "0")}-${String(tomorrowDate.getDate()).padStart(2, "0")}`;
  const weekEnd = new Date(now);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const weekEndStr = `${weekEnd.getFullYear()}-${String(weekEnd.getMonth() + 1).padStart(2, "0")}-${String(weekEnd.getDate()).padStart(2, "0")}`;

  const overdue: Task[] = [];
  const dueToday: Task[] = [];
  const dueTomorrow: Task[] = [];
  const dueThisWeek: Task[] = [];
  const dueFuture: Task[] = [];
  const noDueDate: Task[] = [];

  for (const plan of plans) {
    if (plan.completed || plan.status === "completed" || plan.status === "failed") continue;
    if (!plan.dueDate) {
      noDueDate.push(plan);
    } else if (plan.dueDate < today) {
      overdue.push(plan);
    } else if (plan.dueDate === today) {
      dueToday.push(plan);
    } else if (plan.dueDate === tomorrow) {
      dueTomorrow.push(plan);
    } else if (plan.dueDate <= weekEndStr) {
      dueThisWeek.push(plan);
    } else {
      dueFuture.push(plan);
    }
  }

  return { overdue, dueToday, dueTomorrow, dueThisWeek, dueFuture, noDueDate };
}

export function TaskList({
  habits,
  plans,
  pending,
  completed,
  loading,
  onComplete,
  onDelete,
  onAdd,
}: TaskListProps) {
  const [activeTab, setActiveTab] = useState<TabMode>("habit");
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newDifficulty, setNewDifficulty] = useState("easy");
  const [newFrequency, setNewFrequency] = useState("daily");
  const [newTimeOfDay, setNewTimeOfDay] = useState("anytime");
  const [newDueDate, setNewDueDate] = useState("");
  const [newStartDate, setNewStartDate] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);

  // 日常任务：全部显示（已完成的也留在列表中，但标记为已完成）
  const habitList = useMemo(() => {
    const sorted = [...habits].sort((a, b) => {
      // 未完成优先
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      return a.sortOrder - b.sortOrder;
    });
    return sorted;
  }, [habits]);

  const currentCompleted = useMemo(
    () => habitList.filter((t) => t.completed),
    [habitList]
  );

  // 主线/支线任务：按时间分组
  const planGroups = useMemo(() => {
    const activePlans = plans.filter(
      (p) => !p.completed && p.status !== "completed" && p.status !== "failed"
    );
    return groupPlansByDate(activePlans);
  }, [plans]);

  const completedPlans = useMemo(
    () => completed.filter((t) => t.mode === "plan"),
    [completed]
  );

  const handleAddTask = async () => {
    if (!newTitle.trim()) return;
    const task = await onAdd({
      title: newTitle.trim(),
      mode: activeTab,
      description: newDescription.trim() || undefined,
      difficulty: newDifficulty,
      frequency: activeTab === "habit" ? newFrequency : undefined,
      timeOfDay: activeTab === "habit" ? newTimeOfDay : undefined,
      dueDate: activeTab === "plan" && newDueDate ? newDueDate : undefined,
      startDate: activeTab === "plan" && newStartDate ? newStartDate : undefined,
      status: activeTab === "plan" ? "pending" : undefined,
    });
    if (task) {
      setNewTitle("");
      setNewDescription("");
      setNewDifficulty("easy");
      setNewFrequency("daily");
      setNewTimeOfDay("anytime");
      setNewDueDate("");
      setNewStartDate("");
      setDialogOpen(false);
    }
  };

  const tabLabel = activeTab === "habit" ? "Habit" : "Plan";
  const tabIcon =
    activeTab === "habit" ? (
      <Flame className="w-4 h-4" />
    ) : (
      <CalendarDays className="w-4 h-4" />
    );

  return (
    <div className="space-y-4">
      {/* Tab 切换 */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 bg-muted rounded-lg p-0.5">
          {(["habit", "plan"] as TabMode[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`
                relative px-4 py-1.5 text-sm font-medium rounded-md transition-colors
                ${
                  activeTab === tab
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }
              `}
            >
              {activeTab === tab && (
                <motion.div
                  layoutId="tabBg"
                  className="absolute inset-0 bg-card rounded-md border border-border"
                  transition={{ duration: 0.2 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-1.5">
                {tab === "habit" ? (
                  <Flame className="w-3.5 h-3.5" />
                ) : (
                  <CalendarDays className="w-3.5 h-3.5" />
                )}
                {tab === "habit" ? "Habit" : "Plan"}
              </span>
            </button>
          ))}
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger
            render={
              <button
                type="button"
                className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md border border-border bg-transparent px-3 py-1.5 text-sm font-medium text-foreground hover:bg-card hover:border-primary/40 transition-colors"
              >
                <Plus className="w-4 h-4" />
                新建{tabLabel}
              </button>
            }
          />
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {tabIcon}
                新建{tabLabel}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              {/* 标题 */}
              <div className="space-y-2">
                <Label htmlFor="title">名称</Label>
                <Input
                  id="title"
                  placeholder={
                    activeTab === "habit"
                      ? "例如：每天运动 30 分钟"
                      : "例如：周五前提交报告"
                  }
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddTask()}
                />
              </div>

              {/* 描述 */}
              <div className="space-y-2">
                <Label htmlFor="desc">描述（可选）</Label>
                <Input
                  id="desc"
                  placeholder="补充说明..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddTask()}
                />
              </div>

              {/* 难度 */}
              <div className="space-y-2">
                <Label>难度</Label>
                <div className="flex gap-2 flex-wrap">
                  {DIFFICULTY_OPTIONS.map(([val, label]) => (
                    <button
                      type="button"
                      key={val}
                      onClick={() => setNewDifficulty(val)}
                      className={`
                        px-2.5 py-1 text-xs rounded-md border transition-colors
                        ${
                          newDifficulty === val
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:border-primary/40"
                        }
                      `}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── 日常任务专属字段 ── */}
              {activeTab === "habit" && (
                <>
                  <div className="space-y-2">
                    <Label>频次</Label>
                    <div className="flex gap-2">
                      {FREQUENCY_OPTIONS.map(([val, label]) => (
                        <button
                          type="button"
                          key={val}
                          onClick={() => setNewFrequency(val)}
                          className={`
                            px-3 py-1.5 text-xs rounded-md border transition-colors
                            ${
                              newFrequency === val
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border text-muted-foreground hover:border-primary/40"
                            }
                          `}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>时间段</Label>
                    <div className="flex gap-2 flex-wrap">
                      {TIMEOFDAY_OPTIONS.map(([val, label]) => (
                        <button
                          type="button"
                          key={val}
                          onClick={() => setNewTimeOfDay(val)}
                          className={`
                            px-3 py-1.5 text-xs rounded-md border transition-colors
                            ${
                              newTimeOfDay === val
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border text-muted-foreground hover:border-primary/40"
                            }
                          `}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* ── 主线/支线任务专属字段 ── */}
              {activeTab === "plan" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="startDate">开始日期</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={newStartDate}
                      onChange={(e) => setNewStartDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dueDate">截止日期</Label>
                    <Input
                      id="dueDate"
                      type="date"
                      value={newDueDate}
                      onChange={(e) => setNewDueDate(e.target.value)}
                    />
                  </div>
                </>
              )}

              <Button
                onClick={handleAddTask}
                className="w-full"
                disabled={!newTitle.trim()}
              >
                <Plus className="w-4 h-4 mr-1.5" />
                添加{tabLabel}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* ═══════════════════════════════════════ */}
      {/* 日常任务列表 */}
      {/* ═══════════════════════════════════════ */}
      {activeTab === "habit" && (
        <>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-card animate-pulse rounded-lg" />
              ))}
            </div>
          ) : habitList.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Flame className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="text-lg mb-2">暂无 Habit</p>
              <p className="text-sm">点击「新建 Habit」创建每日修行！</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              <AnimatePresence mode="popLayout">
                {habitList.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onComplete={onComplete}
                    onDelete={onDelete}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </>
      )}

      {/* ═══════════════════════════════════════ */}
      {/* 主线/支线任务列表（按时间分组） */}
      {/* ═══════════════════════════════════════ */}
      {activeTab === "plan" && (
        <>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-card animate-pulse rounded-lg" />
              ))}
            </div>
          ) : plans.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Target className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="text-lg mb-2">暂无 Plan</p>
              <p className="text-sm">点击「新建 Plan」开启新的冒险！</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* 已过期 */}
              {planGroups.overdue.length > 0 && (
                <PlanGroup label="已过期" icon={<AlertTriangle className="w-4 h-4 text-red-400" />} tasks={planGroups.overdue} onComplete={onComplete} onDelete={onDelete} />
              )}
              {/* 今天截止 */}
              {planGroups.dueToday.length > 0 && (
                <PlanGroup label="今天截止" icon={<Clock className="w-4 h-4 text-amber-400" />} tasks={planGroups.dueToday} onComplete={onComplete} onDelete={onDelete} />
              )}
              {/* 明天截止 */}
              {planGroups.dueTomorrow.length > 0 && (
                <PlanGroup label="明天截止" tasks={planGroups.dueTomorrow} onComplete={onComplete} onDelete={onDelete} />
              )}
              {/* 本周 */}
              {planGroups.dueThisWeek.length > 0 && (
                <PlanGroup label="本周" tasks={planGroups.dueThisWeek} onComplete={onComplete} onDelete={onDelete} />
              )}
              {/* 未来 */}
              {planGroups.dueFuture.length > 0 && (
                <PlanGroup label="未来" tasks={planGroups.dueFuture} onComplete={onComplete} onDelete={onDelete} />
              )}
              {/* 无截止日期 */}
              {planGroups.noDueDate.length > 0 && (
                <PlanGroup label="未设截止" tasks={planGroups.noDueDate} onComplete={onComplete} onDelete={onDelete} />
              )}

              {/* 已完成 */}
              {completedPlans.length > 0 && (
                <div className="mt-4">
                  <button
                    onClick={() => setShowCompleted(!showCompleted)}
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2"
                  >
                    <motion.span
                      animate={{ rotate: showCompleted ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ChevronDown className="w-4 h-4" />
                    </motion.span>
                    已完成 ({completedPlans.length})
                  </button>

                  <AnimatePresence>
                    {showCompleted && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="space-y-1.5 overflow-hidden"
                      >
                        {completedPlans.map((task) => (
                          <TaskCard
                            key={task.id}
                            task={task}
                            onComplete={onComplete}
                            onDelete={onDelete}
                          />
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** 计划分组标题 + 列表 */
function PlanGroup({
  label,
  icon,
  tasks,
  onComplete,
  onDelete,
}: {
  label: string;
  icon?: React.ReactNode;
  tasks: Task[];
  onComplete: (id: number) => void;
  onDelete: (id: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5 text-xs text-muted-foreground">
        {icon}
        <span className="font-medium uppercase tracking-wide">{label}</span>
        <span className="opacity-50">{tasks.length}</span>
      </div>
      <div className="space-y-1.5">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onComplete={onComplete}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  );
}
