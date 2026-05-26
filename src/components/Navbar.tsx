"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Swords, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { MEDAL_RECIPES, sortByRarity, type MedalConfig } from "@/lib/shop-data";
import type { UserStats } from "@/hooks/useTasks";

interface NavbarProps {
  stats: UserStats | null;
}

export function Navbar({ stats }: NavbarProps) {
  const router = useRouter();
  const [equippedMedals, setEquippedMedals] = useState<MedalConfig[]>([]);

  const fetchEquipped = useCallback(async () => {
    try {
      const res = await fetch("/api/inventory");
      if (!res.ok) return;
      const data: Record<string, { quantity: number; equipped: boolean }> = await res.json();
      const equipped = MEDAL_RECIPES.filter((m) => data[m.medalKey]?.equipped);
      setEquippedMedals(sortByRarity(equipped));
    } catch {
      // 静默失败
    }
  }, []);

  useEffect(() => {
    fetchEquipped();
  }, [fetchEquipped]);

  useEffect(() => {
    const handler = () => fetchEquipped();
    window.addEventListener("inventory-changed", handler);
    return () => window.removeEventListener("inventory-changed", handler);
  }, [fetchEquipped]);

  const handleLogout = async () => {
    if (!confirm("确定要退出登录吗？")) return;
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="max-w-4xl mx-auto px-3 md:px-4 h-14 flex items-center w-full gap-3 md:gap-4">
        {/* Logo */}
        <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
          <Swords className="w-5 h-5 text-primary" />
          <span className="text-sm font-bold text-foreground">LevelUp Life</span>
          {equippedMedals.map((medal) => (
            <span key={medal.medalKey} title={`${medal.medalName} · +${medal.xpBonusPercent}% XP`} className="text-sm cursor-default">{medal.medalEmoji}</span>
          ))}
        </div>

        <div className="flex-1" />

        {/* 状态概览 */}
        {stats && (
          <div className="flex items-center gap-3 md:gap-5 shrink-0">
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-muted-foreground uppercase">Lv</span>
              <span className="text-sm font-bold text-primary">{stats.level}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-muted-foreground uppercase">XP</span>
              <span className="text-sm font-bold text-emerald-400">{stats.role === "admin" ? "∞" : stats.xp}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-muted-foreground uppercase">G</span>
              <span className="text-sm font-bold text-amber-400">{stats.role === "admin" ? "∞" : stats.gold}</span>
            </div>
            <ThemeToggle />
            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground hover:text-destructive">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
    </nav>
  );
}
