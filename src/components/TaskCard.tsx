"use client";

import { useRef } from "react";
import { motion } from "framer-motion";
import { Check, Trash2, Flame, Calendar, Star } from "lucide-react";
import { spawnFloatingNumber } from "./FloatingNumber";
import type { Task } from "@/hooks/useTasks";

interface TaskCardProps {
  task: Task;
  onComplete: (id: number) => void;
  onDelete: (id: number) => void;
}

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

export function TaskCard({ task, onComplete, onDelete }: TaskCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  const handleComplete = (e: React.MouseEvent) => {
    e.stopPropagation();

    // 获取鼠标位置
    const x = e.clientX;
    const y = e.clientY;

    // 浮动数值
    spawnFloatingNumber(x, y, `+${task.xpReward} XP`, "#4ade80");
    setTimeout(() => {
      spawnFloatingNumber(x + 15, y - 20, `+${task.goldReward} 🪙`, "#fbbf24");
    }, 200);

    onComplete(task.id);
  };

  return (
    <motion.div
      ref={cardRef}
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -100, height: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={`
        group relative flex items-center gap-3 p-3 rounded-lg border cursor-pointer select-none
        transition-colors duration-200
        ${
          task.completed
            ? "bg-[oklch(0.15_0.02_260)] border-[oklch(0.22_0.02_260)] opacity-70"
            : "bg-card border-border hover:border-primary/40 hover:bg-[oklch(0.19_0.02_260)]"
        }
      `}
      whileHover={task.completed ? {} : { scale: 1.01 }}
      onClick={() => !task.completed && onComplete(task.id)}
    >
      {/* 完成按钮 */}
      <button
        onClick={handleComplete}
        className={`
          relative flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center
          transition-all duration-200
          ${
            task.completed
              ? "bg-primary border-primary"
              : "border-muted-foreground/40 hover:border-primary hover:bg-primary/10"
          }
        `}
      >
        {task.completed && <Check className="w-3.5 h-3.5 text-primary-foreground" />}
      </button>

      {/* 任务内容 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={`text-sm font-medium truncate ${
              task.completed ? "line-through text-muted-foreground" : "text-foreground"
            }`}
          >
            {task.title}
          </span>

          {/* 模式标签 */}
          {task.mode === "habit" ? (
            <Flame className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />
          ) : (
            <Calendar className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
          )}

          {/* 连续天数 */}
          {task.mode === "habit" && task.streakCount > 0 && (
            <span className="text-[10px] font-bold text-orange-400 flex-shrink-0">
              {task.streakCount}天
            </span>
          )}
        </div>

        {task.description && (
          <p className={`text-xs mt-0.5 ${task.completed ? "text-muted-foreground/60" : "text-muted-foreground"}`}>
            {task.description}
          </p>
        )}
      </div>

      {/* 右侧信息 */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* 难度标签 */}
        <span className={`text-[10px] font-medium ${difficultyColors[task.difficulty]}`}>
          {difficultyLabels[task.difficulty]}
        </span>

        {/* 奖励 */}
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-[10px] font-bold text-emerald-400">+{task.xpReward} XP</span>
          <span className="text-[10px] font-bold text-amber-400">+{task.goldReward} G</span>
        </div>

        {/* 最佳连续（习惯模式） */}
        {task.mode === "habit" && task.bestStreak > 0 && (
          <div className="flex items-center gap-0.5">
            <Star className="w-3 h-3 text-amber-400" />
            <span className="text-[10px] text-amber-400">{task.bestStreak}</span>
          </div>
        )}

        {/* 删除按钮 */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(task.id);
          }}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-destructive/10 rounded"
        >
          <Trash2 className="w-3.5 h-3.5 text-destructive/60 hover:text-destructive" />
        </button>
      </div>

      {/* 删除线动画覆盖层 */}
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
