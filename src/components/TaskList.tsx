"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Flame, CalendarDays, ChevronDown, Clock, Target, AlertTriangle, Search, Pencil } from "lucide-react";
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
import { getDaysFromTodayLocal, getTodayLocal } from "@/lib/date-utils";

interface TaskListProps {
  habits: Task[];
  plans: Task[];
  pending: Task[];
  completed: Task[];
  loading: boolean;
  onComplete: (id: number) => void;
  onDelete: (id: number) => void;
  onUncomplete: (id: number) => void;
  onEdit: (taskId: number, data: Record<string, unknown>) => Promise<Task | null>;
  onAdd: (data: {
    title: string;
    mode: "habit" | "plan";
    description?: string;
    difficulty?: string;
    frequency?: string;
    timeOfDay?: string;
    frequencyDays?: string;
    targetDate?: string;
    startDate?: string;
    endDate?: string;
    reminderTime?: string;
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

const difficultyLabels: Record<string, string> = {
  trivial: "琐碎",
  easy: "简单",
  medium: "中等",
  hard: "困难",
  heroic: "史诗",
};

const difficultyColors: Record<string, string> = {
  trivial: "text-muted-foreground",
  easy: "text-emerald-400",
  medium: "text-amber-400",
  hard: "text-orange-400",
  heroic: "text-purple-400",
};

const xpRewards: Record<string, number> = {
  trivial: 5,
  easy: 10,
  medium: 20,
  hard: 40,
  heroic: 80,
};

const goldRewards: Record<string, number> = {
  trivial: 1,
  easy: 3,
  medium: 5,
  hard: 10,
  heroic: 20,
};

const frequencyLabels: Record<string, string> = {
  daily: "每日",
  weekly: "每周",
  monthly: "每月",
};

const timeOfDayLabels: Record<string, string> = {
  morning: "早晨",
  afternoon: "下午",
  evening: "晚上",
  anytime: "随时",
};

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

/** 按 targetDate 对 plan 分组 */
function groupPlansByDate(plans: Task[]) {
  const today = getTodayLocal();
  const tomorrow = getDaysFromTodayLocal(1);
  const weekEndStr = getDaysFromTodayLocal(7);

  const overdue: Task[] = [];
  const dueToday: Task[] = [];
  const dueTomorrow: Task[] = [];
  const dueThisWeek: Task[] = [];
  const dueFuture: Task[] = [];
  const noTargetDate: Task[] = [];

  for (const plan of plans) {
    if (plan.completed || plan.status === "completed" || plan.status === "failed") continue;
    if (!plan.targetDate) {
      noTargetDate.push(plan);
    } else if (plan.targetDate < today) {
      overdue.push(plan);
    } else if (plan.targetDate === today) {
      dueToday.push(plan);
    } else if (plan.targetDate === tomorrow) {
      dueTomorrow.push(plan);
    } else if (plan.targetDate <= weekEndStr) {
      dueThisWeek.push(plan);
    } else {
      dueFuture.push(plan);
    }
  }

  return { overdue, dueToday, dueTomorrow, dueThisWeek, dueFuture, noTargetDate };
}

const WEEKDAY_NAMES = ["日", "一", "二", "三", "四", "五", "六"];

export function TaskList({
  habits,
  plans,
  pending,
  completed,
  loading,
  onComplete,
  onDelete,
  onUncomplete,
  onEdit,
  onAdd,
}: TaskListProps) {
  const [activeTab, setActiveTab] = useState<TabMode>("habit");
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newDifficulty, setNewDifficulty] = useState("easy");
  const [newFrequency, setNewFrequency] = useState("daily");
  const [newTimeOfDay, setNewTimeOfDay] = useState("anytime");
  const [newFrequencyDays, setNewFrequencyDays] = useState<string[]>([]);
  const [newTargetDate, setNewTargetDate] = useState("");
  const [newStartDate, setNewStartDate] = useState("");
  const [newEndDate, setNewEndDate] = useState("");
  const [newReminderTime, setNewReminderTime] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [dialogStep, setDialogStep] = useState<"form" | "confirm">("form");
  const [showCompleted, setShowCompleted] = useState(false);

  // 搜索 + 筛选
  const [searchQuery, setSearchQuery] = useState("");
  const [filterDifficulty, setFilterDifficulty] = useState("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "incomplete" | "completed">("all");

  // 过滤函数
  const filterTasks = (list: Task[]) => {
    return list.filter((t) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchTitle = t.title.toLowerCase().includes(q);
        const matchDesc = t.description?.toLowerCase().includes(q);
        if (!matchTitle && !matchDesc) return false;
      }
      if (filterDifficulty !== "all" && t.difficulty !== filterDifficulty) return false;
      if (filterStatus === "completed" && !t.completed) return false;
      if (filterStatus === "incomplete" && t.completed) return false;
      return true;
    });
  };

  // 日常任务：全部显示（已完成的也留在列表中，但标记为已完成）
  const habitList = useMemo(() => {
    const filtered = filterTasks(habits);
    return [...filtered].sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      return a.sortOrder - b.sortOrder;
    });
  }, [habits, searchQuery, filterDifficulty, filterStatus]);

  const currentCompleted = useMemo(
    () => habitList.filter((t) => t.completed),
    [habitList]
  );

  const activeHabitList = useMemo(
    () => habitList.filter((t) => !t.completed),
    [habitList]
  );

  // 主线/支线任务：按时间分组
  const planGroups = useMemo(() => {
    const activePlans = plans.filter(
      (p) => !p.completed && p.status !== "completed" && p.status !== "failed"
    );
    return groupPlansByDate(filterTasks(activePlans));
  }, [plans, searchQuery, filterDifficulty, filterStatus]);

  const completedPlans = useMemo(() => {
    const filtered = filterTasks(completed.filter((t) => t.mode === "plan"));
    return filtered;
  }, [completed, searchQuery, filterDifficulty, filterStatus]);

  const resetForm = () => {
    setNewTitle(""); setNewDescription(""); setNewDifficulty("easy");
    setNewFrequency("daily"); setNewTimeOfDay("anytime");
    setNewFrequencyDays([]); setNewTargetDate("");
    setNewStartDate(""); setNewEndDate(""); setNewReminderTime("");
    setDialogStep("form");
  };

  const prefillEditForm = (task: Task) => {
    setNewTitle(task.title);
    setNewDescription(task.description || "");
    setNewDifficulty(task.difficulty);
    if (task.mode === "habit") {
      setNewFrequency(task.frequency || "daily");
      setNewTimeOfDay(task.timeOfDay || "anytime");
      setNewFrequencyDays(task.frequencyDays ? task.frequencyDays.split(",") : []);
      setNewStartDate(task.startDate || "");
      setNewEndDate(task.endDate || "");
      setNewReminderTime(task.reminderTime || "");
      setNewTargetDate("");
    } else {
      setNewTargetDate(task.targetDate || "");
      setNewReminderTime(task.reminderTime || "");
      setNewFrequency("daily");
      setNewTimeOfDay("anytime");
      setNewFrequencyDays([]);
      setNewStartDate(""); setNewEndDate("");
    }
    setEditingTask(task);
    setDialogMode("edit");
    setDialogStep("form");
    setDialogOpen(true);
  };

  const handleAddTask = async () => {
    if (!newTitle.trim()) return;
    const fd = newFrequencyDays.length > 0 && newFrequencyDays.length < 7
      ? newFrequencyDays.join(",") : undefined;
    const task = await onAdd({
      title: newTitle.trim(),
      mode: activeTab,
      description: newDescription.trim() || undefined,
      difficulty: newDifficulty,
      frequency: activeTab === "habit" ? newFrequency : undefined,
      timeOfDay: activeTab === "habit" ? newTimeOfDay : undefined,
      frequencyDays: activeTab === "habit" ? fd : undefined,
      targetDate: activeTab === "plan" && newTargetDate ? newTargetDate : undefined,
      startDate: activeTab === "habit" && newStartDate ? newStartDate : undefined,
      endDate: activeTab === "habit" && newEndDate ? newEndDate : undefined,
      reminderTime: newReminderTime || undefined,
      status: activeTab === "plan" ? "pending" : undefined,
    });
    if (task) {
      resetForm();
      setDialogOpen(false);
    }
  };

  const handleEditTask = async () => {
    if (!editingTask || !newTitle.trim()) return;
    const fd = newFrequencyDays.length > 0 && newFrequencyDays.length < 7
      ? newFrequencyDays.join(",") : newFrequencyDays.length === 0 ? "" : undefined;
    const data: Record<string, unknown> = {
      title: newTitle.trim(),
      description: newDescription.trim() || null,
      difficulty: newDifficulty,
    };
    if (editingTask.mode === "habit") {
      data.frequency = newFrequency;
      data.timeOfDay = newTimeOfDay;
      data.frequencyDays = fd;
      data.startDate = newStartDate || null;
      data.endDate = newEndDate || null;
      data.reminderTime = newReminderTime || null;
    } else {
      data.targetDate = newTargetDate || null;
      data.reminderTime = newReminderTime || null;
    }
    const result = await onEdit(editingTask.id, data);
    if (result) {
      resetForm();
      setEditingTask(null);
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

        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) { setDialogStep("form"); setEditingTask(null); }
        }}>
          <DialogTrigger
            render={
              <button
                type="button"
                onClick={() => { resetForm(); setDialogMode("create"); setEditingTask(null); }}
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
                {dialogMode === "edit" ? "编辑" : "新建"}{tabLabel}
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
                  {newFrequency === "weekly" && (
                    <div className="space-y-2">
                      <Label>星期</Label>
                      <div className="flex gap-1.5">
                        {WEEKDAY_NAMES.map((name, idx) => {
                          const day = String(idx);
                          const active = newFrequencyDays.includes(day);
                          return (
                            <button
                              type="button"
                              key={day}
                              onClick={() => setNewFrequencyDays((prev) =>
                                active ? prev.filter((d) => d !== day) : [...prev, day]
                              )}
                              className={`
                                w-8 h-8 text-xs rounded-md border transition-colors
                                ${active
                                  ? "border-primary bg-primary/10 text-primary"
                                  : "border-border text-muted-foreground hover:border-primary/40"
                                }
                              `}
                            >
                              {name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
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
                  <div className="space-y-2">
                    <Label htmlFor="reminderTime">时间（可选）</Label>
                    <Input
                      id="reminderTime"
                      type="time"
                      value={newReminderTime}
                      onChange={(e) => setNewReminderTime(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="habitStartDate">开始日期（可选）</Label>
                    <Input
                      id="habitStartDate"
                      type="date"
                      value={newStartDate}
                      onChange={(e) => setNewStartDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="habitEndDate">结束日期（可选，不填=永久）</Label>
                    <Input
                      id="habitEndDate"
                      type="date"
                      value={newEndDate}
                      onChange={(e) => setNewEndDate(e.target.value)}
                    />
                  </div>
                </>
              )}

              {/* ── 主线/支线任务专属字段 ── */}
              {activeTab === "plan" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="targetDate">执行日期</Label>
                    <Input
                      id="targetDate"
                      type="date"
                      value={newTargetDate}
                      onChange={(e) => setNewTargetDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="planReminderTime">时间（可选）</Label>
                    <Input
                      id="planReminderTime"
                      type="time"
                      value={newReminderTime}
                      onChange={(e) => setNewReminderTime(e.target.value)}
                    />
                  </div>
                </>
              )}

              {dialogStep === "form" && dialogMode === "edit" ? (
                <Button
                  onClick={handleEditTask}
                  className="w-full"
                  disabled={!newTitle.trim()}
                >
                  <Pencil className="w-4 h-4 mr-1.5" />
                  保存修改
                </Button>
              ) : dialogStep === "form" ? (
                <Button
                  onClick={() => setDialogStep("confirm")}
                  className="w-full"
                  disabled={!newTitle.trim()}
                >
                  预览
                </Button>
              ) : (
                <div className="space-y-3 pt-2 border-t border-border">
                  {/* 确认卡片 */}
                  <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-base font-medium">
                      {activeTab === "habit" ? (
                        <Flame className="w-4 h-4 text-orange-400" />
                      ) : (
                        <Target className="w-4 h-4 text-amber-400" />
                      )}
                      确认{dialogMode === "edit" ? "修改" : "创建"} {activeTab === "habit" ? "Habit" : "Plan"}
                    </div>
                    <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                      <span className="text-muted-foreground">名称</span>
                      <span className="font-medium">{newTitle}</span>
                      <span className="text-muted-foreground">难度</span>
                      <span className={difficultyColors[newDifficulty] || ""}>
                        {difficultyLabels[newDifficulty]} (+{xpRewards[newDifficulty]} XP, +{goldRewards[newDifficulty]}G)
                      </span>
                      {activeTab === "habit" && (
                        <>
                          <span className="text-muted-foreground">频次</span>
                          <span>{frequencyLabels[newFrequency] || "每日"}</span>
                          {newTimeOfDay && newTimeOfDay !== "anytime" && (
                            <>
                              <span className="text-muted-foreground">时段</span>
                              <span>{timeOfDayLabels[newTimeOfDay]}</span>
                            </>
                          )}
                          {newStartDate && (
                            <>
                              <span className="text-muted-foreground">开始</span>
                              <span>{newStartDate}</span>
                            </>
                          )}
                          {newEndDate && (
                            <>
                              <span className="text-muted-foreground">结束</span>
                              <span>{newEndDate}</span>
                            </>
                          )}
                          {newReminderTime && (
                            <>
                              <span className="text-muted-foreground">时间</span>
                              <span>{newReminderTime}</span>
                            </>
                          )}
                        </>
                      )}
                      {activeTab === "plan" && newTargetDate && (
                        <>
                          <span className="text-muted-foreground">日期</span>
                          <span>{newTargetDate}</span>
                        </>
                      )}
                      {activeTab === "plan" && newReminderTime && (
                        <>
                          <span className="text-muted-foreground">时间</span>
                          <span>{newReminderTime}</span>
                        </>
                      )}
                      {newDescription && (
                        <>
                          <span className="text-muted-foreground">描述</span>
                          <span className="text-muted-foreground">{newDescription}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setDialogStep("form")}
                      className="flex-1"
                    >
                      返回修改
                    </Button>
                    <Button
                      onClick={dialogMode === "edit" ? handleEditTask : handleAddTask}
                      className="flex-1"
                    >
                      {dialogMode === "edit" ? (
                        <>
                          <Pencil className="w-4 h-4 mr-1.5" />
                          确认修改
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4 mr-1.5" />
                          确认创建
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* ═══════════════════════════════════════ */}
      {/* 搜索 & 筛选栏 */}
      {/* ═══════════════════════════════════════ */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="搜索任务..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-9 text-sm"
          />
        </div>
        <select
          value={filterDifficulty}
          onChange={(e) => setFilterDifficulty(e.target.value)}
          className="h-9 px-2 text-xs rounded-md border border-border bg-card text-foreground focus:outline-none focus:border-primary/40"
        >
          <option value="all">全部难度</option>
          {DIFFICULTY_OPTIONS.map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as "all" | "incomplete" | "completed")}
          className="h-9 px-2 text-xs rounded-md border border-border bg-card text-foreground focus:outline-none focus:border-primary/40"
        >
          <option value="all">全部状态</option>
          <option value="incomplete">未完成</option>
          <option value="completed">已完成</option>
        </select>
      </div>
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
            <div className="space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Flame className="w-4 h-4 text-orange-400" />
                  <span className="font-medium uppercase tracking-wide">待完成</span>
                  <span className="opacity-50">{activeHabitList.length}</span>
                </div>
                <AnimatePresence mode="popLayout">
                  {activeHabitList.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onComplete={onComplete}
                      onDelete={onDelete}
                      onEdit={prefillEditForm}
                      onUncomplete={onUncomplete}
                    />
                  ))}
                </AnimatePresence>
              </div>

              {currentCompleted.length > 0 && (
                <div>
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
                    已完成 ({currentCompleted.length})
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
                        {currentCompleted.map((task) => (
                          <TaskCard
                            key={task.id}
                            task={task}
                            onComplete={onComplete}
                            onDelete={onDelete}
                            onEdit={prefillEditForm}
                            onUncomplete={onUncomplete}
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
                <PlanGroup label="已过期" icon={<AlertTriangle className="w-4 h-4 text-red-400" />} tasks={planGroups.overdue} onComplete={onComplete} onDelete={onDelete} onEdit={prefillEditForm} onUncomplete={onUncomplete} />
              )}
              {/* 今天 */}
              {planGroups.dueToday.length > 0 && (
                <PlanGroup label="今天" icon={<Clock className="w-4 h-4 text-amber-400" />} tasks={planGroups.dueToday} onComplete={onComplete} onDelete={onDelete} onEdit={prefillEditForm} onUncomplete={onUncomplete} />
              )}
              {/* 明天 */}
              {planGroups.dueTomorrow.length > 0 && (
                <PlanGroup label="明天" tasks={planGroups.dueTomorrow} onComplete={onComplete} onDelete={onDelete} onEdit={prefillEditForm} onUncomplete={onUncomplete} />
              )}
              {/* 本周 */}
              {planGroups.dueThisWeek.length > 0 && (
                <PlanGroup label="本周" tasks={planGroups.dueThisWeek} onComplete={onComplete} onDelete={onDelete} onEdit={prefillEditForm} onUncomplete={onUncomplete} />
              )}
              {/* 未来 */}
              {planGroups.dueFuture.length > 0 && (
                <PlanGroup label="未来" tasks={planGroups.dueFuture} onComplete={onComplete} onDelete={onDelete} onEdit={prefillEditForm} onUncomplete={onUncomplete} />
              )}
              {/* 无日期 */}
              {planGroups.noTargetDate.length > 0 && (
                <PlanGroup label="未设日期" tasks={planGroups.noTargetDate} onComplete={onComplete} onDelete={onDelete} onEdit={prefillEditForm} onUncomplete={onUncomplete} />
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
                            onEdit={prefillEditForm}
                            onUncomplete={onUncomplete}
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
  onEdit,
  onUncomplete,
}: {
  label: string;
  icon?: React.ReactNode;
  tasks: Task[];
  onComplete: (id: number) => void;
  onDelete: (id: number) => void;
  onEdit: (task: Task) => void;
  onUncomplete: (id: number) => void;
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
            onEdit={onEdit}
            onUncomplete={onUncomplete}
          />
        ))}
      </div>
    </div>
  );
}
