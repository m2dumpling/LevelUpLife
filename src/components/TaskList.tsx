"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Flame, CalendarDays, ChevronDown } from "lucide-react";
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

interface TaskListProps {
  habits: Task[];
  plans: Task[];
  pending: Task[];
  completed: Task[];
  loading: boolean;
  onComplete: (id: number) => void;
  onDelete: (id: number) => void;
  onAdd: (data: { title: string; mode: "habit" | "plan"; description?: string; difficulty?: string }) => Promise<Task | null>;
}

type TabMode = "habit" | "plan";

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
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);

  const currentTasks = activeTab === "habit"
    ? pending.filter((t) => t.mode === "habit")
    : pending.filter((t) => t.mode === "plan");

  const currentCompleted = activeTab === "habit"
    ? completed.filter((t) => t.mode === "habit")
    : completed.filter((t) => t.mode === "plan");

  const handleAddTask = async () => {
    if (!newTitle.trim()) return;
    const task = await onAdd({
      title: newTitle.trim(),
      mode: activeTab,
      description: newDescription.trim() || undefined,
      difficulty: newDifficulty,
    });
    if (task) {
      setNewTitle("");
      setNewDescription("");
      setNewDifficulty("easy");
      setDialogOpen(false);
    }
  };

  const tabLabel = activeTab === "habit" ? "习惯" : "计划";
  const tabIcon = activeTab === "habit" ? <Flame className="w-4 h-4" /> : <CalendarDays className="w-4 h-4" />;

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
                ${activeTab === tab ? "text-foreground" : "text-muted-foreground hover:text-foreground"}
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
                {tab === "habit" ? <Flame className="w-3.5 h-3.5" /> : <CalendarDays className="w-3.5 h-3.5" />}
                {tab === "habit" ? "习惯" : "计划"}
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
              <div className="space-y-2">
                <Label htmlFor="title">名称</Label>
                <Input
                  id="title"
                  placeholder={activeTab === "habit" ? "例如：每天运动 30 分钟" : "例如：周五前提交报告"}
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddTask()}
                />
              </div>
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
              <div className="space-y-2">
                <Label>难度</Label>
                <div className="flex gap-2">
                  {[
                    ["trivial", "琐碎"],
                    ["easy", "简单"],
                    ["medium", "中等"],
                    ["hard", "困难"],
                    ["heroic", "史诗"],
                  ].map(([val, label]) => (
                    <button
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
              <Button onClick={handleAddTask} className="w-full" disabled={!newTitle.trim()}>
                <Plus className="w-4 h-4 mr-1.5" />
                添加{tabLabel}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* 任务列表 */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-card animate-pulse rounded-lg" />
          ))}
        </div>
      ) : currentTasks.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-lg mb-2">✨ 暂无{tabLabel}</p>
          <p className="text-sm">点击「新建{tabLabel}」开始你的冒险吧！</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          <AnimatePresence mode="popLayout">
            {currentTasks.map((task) => (
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

      {/* 已完成区域 */}
      {currentCompleted.length > 0 && (
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
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
