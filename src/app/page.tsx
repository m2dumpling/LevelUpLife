"use client";

import { useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { Navbar } from "@/components/Navbar";
import { StatDashboard } from "@/components/StatDashboard";
import { TaskList } from "@/components/TaskList";
import { Heatmap } from "@/components/Heatmap";
import { Timeline } from "@/components/Timeline";
import { FloatingNumberContainer } from "@/components/FloatingNumber";
import { LevelUpModal } from "@/components/LevelUpModal";
import { AchievementPopup, triggerAchievementPopup } from "@/components/AchievementPopup";
import { StoryDialog } from "@/components/StoryDialog";
import { ShopDialog } from "@/components/ShopDialog";
import { BackpackDialog } from "@/components/BackpackDialog";
import { MonthlyView } from "@/components/MonthlyView";
import { useTasks } from "@/hooks/useTasks";
import { useStats } from "@/hooks/useStats";
import type { Task } from "@/hooks/useTasks";

/** 简易成就检测 */
function checkAchievements(
  task: Task & { leveledUp?: boolean; newLevel?: number },
  stats: { level: number; streakDays: number; gold: number },
  allTasks: Task[]
) {
  const completedCount = allTasks.filter((t) => t.completed).length;
  if (completedCount === 1) {
    triggerAchievementPopup({ title: "初出茅庐", description: "完成第一个任务", icon: "⚔️" });
  }
  if (completedCount === 50) {
    triggerAchievementPopup({ title: "勤劳的勇者", description: "累计完成 50 个任务", icon: "📋" });
  }
  if (task.leveledUp && task.newLevel) {
    if (task.newLevel >= 10) {
      triggerAchievementPopup({ title: "英雄降临", description: "升至第 10 级", icon: "🗡️" });
    } else if (task.newLevel >= 5) {
      triggerAchievementPopup({ title: "初级冒险者", description: "升至第 5 级", icon: "🛡️" });
    }
  }
  if (task.streakCount === 10 && task.mode === "habit") {
    triggerAchievementPopup({ title: "持之以恒", description: "习惯连续坚持 10 天", icon: "🔥" });
  } else if (task.streakCount === 5 && task.mode === "habit") {
    triggerAchievementPopup({ title: "小有所成", description: "习惯连续坚持 5 天", icon: "🌱" });
  }
}

export default function HomePage() {
  const { stats, loading: statsLoading, refreshStats } = useStats();
  const {
    habits,
    plans,
    pending,
    completed,
    loading: tasksLoading,
    completeTask,
    deleteTask,
    addTask,
    editTask,
    uncompleteTask,
  } = useTasks();

  const [levelUpData, setLevelUpData] = useState<{
    open: boolean;
    level: number;
    levelsGained: number;
  }>({ open: false, level: 0, levelsGained: 0 });

  const [storyDialog, setStoryDialog] = useState<{
    id: number;
    chapterKey: string;
    title: string;
    dialogue: string;
    npcName: string;
    reward: string | null;
  } | null>(null);

  const [inventory, setInventory] = useState<Record<string, { quantity: number; equipped: boolean }>>({});

  const refreshInventory = useCallback(async () => {
    try {
      const res = await fetch("/api/inventory");
      if (res.ok) {
        const data = await res.json();
        setInventory(data);
      }
    } catch {
      // 静默失败
    }
  }, []);

  useEffect(() => {
    refreshInventory();
  }, [refreshInventory]);

  useEffect(() => {
    const handler = () => refreshInventory();
    window.addEventListener("inventory-changed", handler);
    return () => window.removeEventListener("inventory-changed", handler);
  }, [refreshInventory]);


  const handleComplete = useCallback(
    async (taskId: number) => {
      const result = await completeTask(taskId);
      if (result) {
        window.dispatchEvent(new Event("task-completed"));
        refreshStats();
        if (result.leveledUp && result.newLevel) {
          setLevelUpData({
            open: true,
            level: result.newLevel,
            levelsGained: result.levelsGained || 1,
          });
        }
        if (stats) {
          checkAchievements(result, stats, [...habits, ...plans]);
        }
      }
    },
    [completeTask, refreshStats, stats, habits, plans]
  );

  const handleDelete = useCallback(async (id: number) => {
    await deleteTask(id);
    window.dispatchEvent(new Event("task-completed"));
    refreshStats();
  }, [deleteTask, refreshStats]);

  const handleEdit = useCallback(
    async (taskId: number, data: Record<string, unknown>) => {
      const result = await editTask(taskId, data);
      if (result) refreshStats();
      return result;
    },
    [editTask, refreshStats]
  );

  const handleUncomplete = useCallback(
    async (taskId: number) => {
      const result = await uncompleteTask(taskId);
      if (result) {
        window.dispatchEvent(new Event("task-completed"));
        refreshStats();
      }
    },
    [uncompleteTask, refreshStats]
  );

  const handleAdd = useCallback(
    async (data: {
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
    }) => addTask(data),
    [addTask]
  );

  return (
    <div className="min-h-screen bg-background">
      <FloatingNumberContainer />
      <AchievementPopup />
      <LevelUpModal
        open={levelUpData.open}
        level={levelUpData.level}
        levelsGained={levelUpData.levelsGained}
        onClose={() => setLevelUpData({ open: false, level: 0, levelsGained: 0 })}
      />
      <StoryDialog event={storyDialog} onClose={() => setStoryDialog(null)} />
      <Navbar stats={stats} />

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* 商店 + 背包快捷入口 */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex items-center gap-2"
        >
          <MonthlyView habits={habits} plans={plans} />
          <ShopDialog
            gold={stats?.gold ?? 0}
            inventory={inventory}
            onBuy={refreshInventory}
          />
          <BackpackDialog
            inventory={inventory}
            onCraft={refreshInventory}
            onEquip={refreshInventory}
          />
        </motion.div>

        <motion.section
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <StatDashboard stats={stats} loading={statsLoading} />
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <TaskList
            habits={habits}
            plans={plans}
            pending={pending}
            completed={completed}
            loading={tasksLoading}
            onComplete={handleComplete}
            onDelete={handleDelete}
            onUncomplete={handleUncomplete}
            onEdit={handleEdit}
            onAdd={handleAdd}
          />
        </motion.section>

        <motion.div
          className="grid grid-cols-1 lg:grid-cols-2 gap-6"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <div className="bg-card rounded-xl p-4 border border-border">
            <Heatmap />
          </div>
          <div className="bg-card rounded-xl p-4 border border-border">
            <Timeline />
          </div>
        </motion.div>
      </main>
    </div>
  );
}
