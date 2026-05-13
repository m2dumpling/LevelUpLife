"use client";

import { useState, useEffect, useCallback } from "react";
import type { UserStats } from "./useTasks";
import { getTodayLocal } from "@/lib/date-utils";

export function useStats() {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    const res = await fetch("/api/user");
    if (res.ok) {
      const data = await res.json();
      setStats(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    let activeDate = getTodayLocal();

    const refreshIfDateChanged = () => {
      const today = getTodayLocal();
      if (today !== activeDate) {
        activeDate = today;
        fetchStats();
      }
    };

    const refreshOnVisible = () => {
      if (document.visibilityState === "visible") {
        refreshIfDateChanged();
      }
    };

    window.addEventListener("focus", refreshIfDateChanged);
    document.addEventListener("visibilitychange", refreshOnVisible);
    const timer = window.setInterval(refreshIfDateChanged, 60_000);

    return () => {
      window.removeEventListener("focus", refreshIfDateChanged);
      document.removeEventListener("visibilitychange", refreshOnVisible);
      window.clearInterval(timer);
    };
  }, [fetchStats]);

  return { stats, loading, refreshStats: fetchStats };
}
