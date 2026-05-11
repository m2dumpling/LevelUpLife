"use client";

import { useState, useCallback, useEffect } from "react";

export interface Task {
  id: number;
  mode: "habit" | "plan";
  title: string;
  description: string | null;
  difficulty: "trivial" | "easy" | "medium" | "hard" | "heroic";
  xpReward: number;
  goldReward: number;
  streakCount: number;
  bestStreak: number;
  dueDate: string | null;
  completed: boolean;
  completedAt: string | null;
  sortOrder: number;
  createdAt: string;
  leveledUp?: boolean;
  levelsGained?: number;
  newLevel?: number;
  newXp?: number;
  newXpToNext?: number;
  newGold?: number;
}

export interface UserStats {
  id: number;
  name: string;
  level: number;
  xp: number;
  xpToNext: number;
  gold: number;
  hp: number;
  maxHp: number;
  totalDays: number;
  streakDays: number;
  bestStreak: number;
  storyProgress: string;
}

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTasks = useCallback(async () => {
    const res = await fetch("/api/tasks");
    if (res.ok) {
      const data = await res.json();
      setTasks(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const addTask = useCallback(
    async (data: {
      title: string;
      mode: "habit" | "plan";
      description?: string;
      difficulty?: string;
    }) => {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const newTask = await res.json();
        setTasks((prev) => [...prev, newTask]);
        return newTask as Task;
      }
      return null;
    },
    []
  );

  const completeTask = useCallback(async (taskId: number) => {
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: true }),
    });
    if (res.ok) {
      const updated = await res.json();
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, ...updated } : t)));
      return updated as Task;
    }
    return null;
  }, []);

  const uncompleteTask = useCallback(async (taskId: number) => {
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: false }),
    });
    if (res.ok) {
      const updated = await res.json();
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, ...updated } : t)));
      return updated as Task;
    }
    return null;
  }, []);

  const deleteTask = useCallback(async (taskId: number) => {
    const res = await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
    if (res.ok) {
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      return true;
    }
    return false;
  }, []);

  // 分类
  const habits = tasks.filter((t) => t.mode === "habit");
  const plans = tasks.filter((t) => t.mode === "plan");
  const pending = tasks.filter((t) => !t.completed);
  const completed = tasks.filter((t) => t.completed);

  return {
    tasks,
    habits,
    plans,
    pending,
    completed,
    loading,
    addTask,
    completeTask,
    uncompleteTask,
    deleteTask,
    refreshTasks: fetchTasks,
  };
}
