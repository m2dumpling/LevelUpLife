"use client";

import { useRef } from "react";
import { motion } from "framer-motion";
import { Check, Trash2, Flame, Calendar, Star, Clock, Target, AlertTriangle, Pencil, RotateCcw } from "lucide-react";
import { spawnFloatingNumber } from "./FloatingNumber";
import type { Task } from "@/hooks/useTasks";
import { getTodayLocal, compareDates } from "@/lib/date-utils";

interface TaskCardProps {
  task: Task;
  onComplete: (id: number) => void;
  onDelete: (id: number) => void;
  onEdit: (task: Task) => void;
  onUncomplete: (id: number) => void;
}

const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"];

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

const difficultyBorder: Record<string, string> = {
  trivial: "border-muted-foreground/20",
  easy: "border-emerald-500/20",
  medium: "border-amber-500/20",
  hard: "border-orange-500/20",
  heroic: "border-purple-500/20",
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

export function TaskCard({ task, onComplete, onDelete, onEdit, onUncomplete }: TaskCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const today = getTodayLocal();

  const handleComplete = (e: React.MouseEvent) => {
    e.stopPropagation();
    const x = e.clientX;
    const y = e.clientY;
    spawnFloatingNumber(x, y, `+${task.xpReward} XP`, "#4ade80");
    setTimeout(() => {
      spawnFloatingNumber(x + 15, y - 20, `+${task.goldReward} 🪙`, "#fbbf24");
    }, 200);
    onComplete(task.id);
  };

  const isHabit = task.mode === "habit";
  const isPlan = task.mode === "plan";
  const diffColor = difficultyColors[task.difficulty] || "";

  // 是否当天可完成
  let isToday = true;
  let isExpired = false;

  if (isHabit) {
    // Habit: startDate 未到 → 不可完成；endDate 已过 → 不可完成
    if (task.startDate && compareDates(task.startDate, today) > 0) {
      isToday = false;
    }
    if (task.endDate && compareDates(task.endDate, today) < 0) {
      isToday = false;
      isExpired = true;
    }
  }

  if (isPlan) {
    if (task.targetDate) {
      const cmp = compareDates(task.targetDate, today);
      if (cmp < 0) {
        isToday = false;
        isExpired = true;
      } else if (cmp > 0) {
        isToday = false;
      }
    }
  }

  const canComplete = isToday && !task.completed;

  return (
    <motion.div
      ref={cardRef}
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -100, height: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={`
        group relative flex items-center gap-3 p-3 rounded-lg border select-none
        transition-colors duration-200
        ${
          task.completed
            ? "bg-muted/50 border-border/30 opacity-60"
            : isExpired
            ? "bg-destructive/5 border-destructive/10 opacity-50"
            : canComplete
            ? `bg-card border-border hover:border-primary/40 hover:bg-accent/50 cursor-pointer ${difficultyBorder[task.difficulty]}`
            : "bg-card border-border opacity-70"
        }
      `}
      whileHover={canComplete ? { scale: 1.01 } : {}}
      onClick={canComplete ? handleComplete : undefined}
    >
      {/* ── 完成按钮 ── */}
      {canComplete ? (
        <button
          onClick={handleComplete}
          className={`
            relative flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center
            transition-all duration-200
            border-muted-foreground/40 hover:border-primary hover:bg-primary/10
          `}
        >
          {task.completed && <Check className="w-3.5 h-3.5 text-primary-foreground" />}
        </button>
      ) : (
        <div
          className={`
            relative flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center
            ${task.completed ? "bg-primary border-primary" : "border-muted-foreground/20"}
          `}
        >
          {task.completed && <Check className="w-3.5 h-3.5 text-primary-foreground" />}
          {isExpired && !task.completed && (
            <AlertTriangle className="w-3 h-3 text-red-400/50" />
          )}
        </div>
      )}


      {/* ── 内容 ── */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={`text-sm font-medium truncate ${
              task.completed
                ? "line-through text-muted-foreground"
                : "text-foreground"
            }`}
          >
            {task.title}
          </span>

          {/* 类型图标 */}
          {isHabit ? (
            <Flame className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />
          ) : (
            <Calendar className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
          )}

          {/* 连击天数 (日常任务) */}
          {isHabit && task.streakCount > 0 && (
            <span className="text-[10px] font-bold text-orange-400 flex-shrink-0 flex items-center gap-0.5">
              <Star className="w-3 h-3" />
              {task.streakCount}天
            </span>
          )}
        </div>

        {/* 描述 */}
        {task.description && (
          <p
            className={`text-xs mt-0.5 ${
              task.completed ? "text-muted-foreground/50" : "text-muted-foreground"
            }`}
          >
            {task.description}
          </p>
        )}

        {/* 日常任务元信息 */}
        {isHabit && (
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {frequencyLabels[task.frequency || "daily"]}
            </span>
            {task.frequency === "weekly" && task.frequencyDays && (
              <span className="text-[10px] text-muted-foreground">
                · {task.frequencyDays.split(",").map((d) => WEEKDAY_LABELS[parseInt(d)]).join("")}
              </span>
            )}
            {task.timeOfDay && task.timeOfDay !== "anytime" && (
              <span className="text-[10px] text-muted-foreground">
                · {timeOfDayLabels[task.timeOfDay]}
              </span>
            )}
            {task.reminderTime && (
              <span className="text-[10px] text-amber-400 flex items-center gap-0.5">
                <Clock className="w-3 h-3" />
                {task.reminderTime}
              </span>
            )}
          </div>
        )}

        {/* 任务日期 */}
        {isPlan && task.targetDate && (
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="flex items-center gap-1">
              <Target className="w-3 h-3 text-muted-foreground" />
              <span className={`text-[10px] ${isExpired ? "text-red-400" : diffColor}`}>
                {task.targetDate}
                {isExpired && " · 已过期"}
              </span>
            </span>
            {task.reminderTime && (
              <span className="text-[10px] text-amber-400 flex items-center gap-0.5">
                <Clock className="w-3 h-3" />
                {task.reminderTime}
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── 右侧信息 ── */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* 难度标签 */}
        <span
          className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${
            difficultyBorder[task.difficulty]
          } ${diffColor}`}
        >
          {difficultyLabels[task.difficulty]}
        </span>

        {/* 奖励 */}
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-[10px] font-bold text-emerald-400">
            +{task.xpReward} XP
          </span>
          <span className="text-[10px] font-bold text-amber-400">
            +{task.goldReward} G
          </span>
        </div>

        {/* 历史最佳 (日常任务) */}
        {isHabit && task.bestStreak > 0 && (
          <div className="flex items-center gap-0.5">
            <Star className="w-3 h-3 text-amber-400" />
            <span className="text-[10px] text-amber-400">{task.bestStreak}</span>
          </div>
        )}

        {/* 编辑 */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit(task);
          }}
          className="p-1.5 hover:bg-accent rounded"
        >
          <Pencil className="w-4 h-4 text-muted-foreground hover:text-foreground" />
        </button>

        {/* 撤销 */}
        {task.completed && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onUncomplete(task.id);
            }}
            className="p-1.5 hover:bg-amber-500/10 rounded"
          >
            <RotateCcw className="w-4 h-4 text-amber-400" />
          </button>
        )}

        {/* 删除 */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(task.id);
          }}
          className="p-1.5 hover:bg-destructive/10 rounded"
        >
          <Trash2 className="w-4 h-4 text-destructive/60 hover:text-destructive" />
        </button>
      </div>

      {/* ── CLEAR 印章（已完成日常任务）── */}
      {task.completed && isHabit && (
        <motion.div
          initial={{ scale: 0, rotate: -15 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ duration: 0.3, ease: "backOut" }}
          className="absolute right-3 top-1/2 -translate-y-1/2 -rotate-12 pointer-events-none"
        >
          <span className="text-[10px] font-black text-emerald-400/30 border-2 border-emerald-400/20 rounded px-2 py-1 tracking-widest select-none">
            CLEAR
          </span>
        </motion.div>
      )}

      {/* 完成删除线动画 */}
      {task.completed && (
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.4, ease: "easeOut", delay: 0.1 }}
          className="absolute left-10 right-0 top-1/2 h-[2px] bg-primary/40 origin-left"
        />
      )}
    </motion.div>
  );
}
