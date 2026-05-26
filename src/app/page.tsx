"use client";

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Cloud, Store, Package, Gift, Swords, Shield, Users } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { UserMenu } from "@/components/UserMenu";
import { Sidebar, type SidebarItem } from "@/components/Sidebar";
import { BossWidget } from "@/components/BossWidget";
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
import { LotteryButton } from "@/components/LotteryButton";
import { MonthlyView } from "@/components/MonthlyView";
import { PvPArena } from "@/components/PvPArena";
import { GuildButton } from "@/components/GuildButton";
import { FriendButton } from "@/components/FriendButton";
import { WeatherBadge } from "@/components/WeatherBadge";
import { VillageWidget } from "@/components/VillageWidget";
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

/** Sidebar panel definitions */
const SIDEBAR_ITEMS: SidebarItem[] = [
  { id: "weather", icon: <Cloud className="w-5 h-5" />, label: "天气" },
  { id: "shop", icon: <Store className="w-5 h-5" />, label: "商店" },
  { id: "backpack", icon: <Package className="w-5 h-5" />, label: "背包" },
  { id: "lottery", icon: <Gift className="w-5 h-5" />, label: "每日抽奖" },
  { id: "pvp", icon: <Swords className="w-5 h-5" />, label: "PvP 竞技场" },
  { id: "guild", icon: <Shield className="w-5 h-5" />, label: "公会" },
  { id: "friends", icon: <Users className="w-5 h-5" />, label: "好友" },
];

/** Simple weather display data */
interface WeatherDisplay {
  city: string;
  emoji: string;
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

  // ── Panel state (sidebar controlled) ──
  const [activePanel, setActivePanel] = useState<string | null>(null);

  // ── Weather display badge data ──
  const [weatherDisplay, setWeatherDisplay] = useState<WeatherDisplay | null>(null);

  const fetchWeatherDisplay = useCallback(async () => {
    try {
      const res = await fetch("/api/weather");
      if (res.ok) {
        const data = await res.json();
        if (data.city && data.weather) {
          setWeatherDisplay({ city: data.city, emoji: data.weather.emoji });
        } else {
          setWeatherDisplay(null);
        }
      }
    } catch {
      // 静默
    }
  }, []);

  useEffect(() => {
    fetchWeatherDisplay();
  }, [fetchWeatherDisplay]);

  // Refresh weather display when changed from WeatherBadge
  useEffect(() => {
    const handler = () => fetchWeatherDisplay();
    window.addEventListener("weather-changed", handler);
    return () => window.removeEventListener("weather-changed", handler);
  }, [fetchWeatherDisplay]);

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

  const [classData, setClassData] = useState<{ name: string; emoji: string } | null>(null);

  const fetchClass = useCallback(async () => {
    try {
      const res = await fetch("/api/class");
      if (res.ok) {
        const data = await res.json();
        if (data.name) setClassData(data);
      }
    } catch {
      // 静默失败
    }
  }, []);

  useEffect(() => {
    fetchClass();
  }, [fetchClass]);

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

  const [npcMessage, setNpcMessage] = useState("");
  useEffect(() => {
    const handler = (e: Event) => {
      const msg = (e as CustomEvent).detail;
      setNpcMessage(msg);
      setTimeout(() => setNpcMessage(""), 5000);
    };
    window.addEventListener("npc-speak", handler);
    return () => window.removeEventListener("npc-speak", handler);
  }, []);

  useEffect(() => {
    const handler = () => refreshInventory();
    window.addEventListener("inventory-changed", handler);
    return () => window.removeEventListener("inventory-changed", handler);
  }, [refreshInventory]);

  useEffect(() => {
    const handler = () => refreshStats();
    window.addEventListener("stats-changed", handler);
    return () => window.removeEventListener("stats-changed", handler);
  }, [refreshStats]);

  const handlePanelClick = (id: string) => {
    setActivePanel((prev) => (prev === id ? null : id));
  };

  const handleComplete = useCallback(
    async (taskId: number) => {
      const result: any = await completeTask(taskId);
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
        if (result.npcVoice) {
          window.dispatchEvent(new CustomEvent("npc-speak", { detail: result.npcVoice }));
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
      {/* ── Global overlays ── */}
      <FloatingNumberContainer />
      <AchievementPopup />
      <LevelUpModal
        open={levelUpData.open}
        level={levelUpData.level}
        levelsGained={levelUpData.levelsGained}
        onClose={() => setLevelUpData({ open: false, level: 0, levelsGained: 0 })}
      />
      <StoryDialog event={storyDialog} onClose={() => setStoryDialog(null)} />

      {/* NPC 语音气泡 */}
      <AnimatePresence>
        {npcMessage && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="fixed bottom-20 md:bottom-4 left-1/2 -translate-x-1/2 z-50 bg-card border border-border rounded-lg px-4 py-2 shadow-lg text-sm text-foreground max-w-sm text-center"
          >
            {npcMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Discord-Style Sidebar ── */}
      <Sidebar
        items={SIDEBAR_ITEMS}
        activePanel={activePanel}
        onPanelClick={handlePanelClick}
      />

      {/* ── Main content area (offset for sidebar) ── */}
      <div className="ml-0 md:ml-[60px] pb-[72px] md:pb-0">
        <div className="flex items-center gap-2">
          <Navbar stats={stats} />
          <UserMenu />
        </div>

        <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
          {/* Inline badges: weather + class + calendar */}
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="flex items-center gap-2 flex-wrap"
          >
            {weatherDisplay && (
              <span
                className="flex items-center gap-1 text-xs bg-muted/30 px-2 py-0.5 rounded-full cursor-default"
                title={`当前天气: ${weatherDisplay.city}`}
              >
                <span>{weatherDisplay.emoji}</span>
                <span className="text-muted-foreground">{weatherDisplay.city}</span>
              </span>
            )}
            {classData && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="flex items-center gap-1 text-xs bg-muted/30 px-2 py-0.5 rounded-full cursor-default"
                title={`职业: ${classData.name}`}
              >
                <span>{classData.emoji}</span>
                <span className="text-foreground">{classData.name}</span>
              </motion.span>
            )}
            <MonthlyView habits={habits} plans={plans} />
          </motion.div>

          {/* 世界 BOSS */}
          <BossWidget />

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

          {/* 村庄 */}
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.25 }}
          >
            <VillageWidget />
          </motion.section>

          <motion.div
            className="grid grid-cols-1 lg:grid-cols-2 gap-6"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
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

      {/* ── Controlled dialogs (portals) ── */}
      <WeatherBadge
        open={activePanel === "weather"}
        onOpenChange={(v) => {
          if (!v) setActivePanel(null);
          if (v) window.dispatchEvent(new Event("weather-changed"));
        }}
      />
      <ShopDialog
        open={activePanel === "shop"}
        onOpenChange={(v) => { if (!v) setActivePanel(null); }}
        gold={stats?.gold ?? 0}
        inventory={inventory}
        onBuy={refreshInventory}
      />
      <BackpackDialog
        open={activePanel === "backpack"}
        onOpenChange={(v) => { if (!v) setActivePanel(null); }}
        inventory={inventory}
        onCraft={refreshInventory}
        onEquip={refreshInventory}
      />
      <LotteryButton
        open={activePanel === "lottery"}
        onOpenChange={(v) => { if (!v) setActivePanel(null); }}
      />
      <PvPArena
        open={activePanel === "pvp"}
        onOpenChange={(v) => { if (!v) setActivePanel(null); }}
      />
      <GuildButton
        open={activePanel === "guild"}
        onOpenChange={(v) => { if (!v) setActivePanel(null); }}
      />
      <FriendButton
        open={activePanel === "friends"}
        onOpenChange={(v) => { if (!v) setActivePanel(null); }}
      />
    </div>
  );
}
