"use client";

import { useState, useEffect, useCallback } from "react";
import type { UserStats } from "./useTasks";

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

  return { stats, loading, refreshStats: fetchStats };
}
