"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface VillageData {
  id: number;
  userId: number;
  stone: number;
  houses: number;
  library: number;
  market: number;
  fountain: number;
  castle: number;
  effects?: {
    maxHpBonus: number;
    xpMultiplier: number;
    shopDiscount: number;
    hpRecoveryBonus: number;
    guildContributionBonus: number;
  };
}

const BUILDINGS = [
  { key: "houses", label: "房屋", emoji: "🏠", desc: "每级 +1 最大HP" },
  { key: "library", label: "图书馆", emoji: "📚", desc: "每级 +1% XP" },
  { key: "market", label: "市场", emoji: "🏪", desc: "每级 -5% 商店价格" },
  { key: "fountain", label: "喷泉", emoji: "⛲", desc: "每级 +1 HP 每日恢复" },
  { key: "castle", label: "城堡", emoji: "🏰", desc: "每级 +1 公会贡献" },
];

export function VillageWidget() {
  const [village, setVillage] = useState<VillageData | null>(null);
  const [selectedBuilding, setSelectedBuilding] = useState<string | null>(null);
  const [upgradeResult, setUpgradeResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchVillage = useCallback(async () => {
    try {
      const res = await fetch("/api/village");
      if (res.ok) {
        const data = await res.json();
        setVillage(data);
      }
    } catch {
      // 静默失败
    }
  }, []);

  useEffect(() => {
    fetchVillage();
  }, [fetchVillage]);

  // 监听任务完成事件刷新村庄
  useEffect(() => {
    const handler = () => fetchVillage();
    window.addEventListener("task-completed", handler);
    return () => window.removeEventListener("task-completed", handler);
  }, [fetchVillage]);

  const handleUpgrade = async () => {
    if (!selectedBuilding) return;
    setError(null);
    setUpgradeResult(null);

    try {
      const res = await fetch("/api/village", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ building: selectedBuilding, action: "upgrade" }),
      });
      const data = await res.json();
      if (res.ok) {
        setVillage({ ...(data.village as VillageData) });
        setUpgradeResult(
          `${getBuildingName(selectedBuilding)} 升级成功！消耗 ${data.cost} 金币`
        );
        window.dispatchEvent(new Event("stats-changed"));
        setSelectedBuilding(null);
      } else {
        setError(data.error || "升级失败");
      }
    } catch {
      setError("升级失败，请重试");
    }
  };

  const getBuildingName = (key: string) =>
    BUILDINGS.find((b) => b.key === key)?.label ?? key;

  const getUpgradeCost = (level: number) => level * 10;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card rounded-xl p-4 border border-border"
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-foreground">我的村庄</h3>
          {village && (
            <span className="text-xs text-muted-foreground">
              🪨 石料:{" "}
              <span className="font-bold text-amber-400">{village.stone}</span>
            </span>
          )}
        </div>

        {/* 村庄地图 */}
        <div className="grid grid-cols-3 gap-3 mb-3">
          {BUILDINGS.map((b) => {
            const level = village ? (village as any)[b.key] : 1;
            return (
              <motion.button
                key={b.key}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setSelectedBuilding(b.key)}
                className="flex flex-col items-center gap-1 p-2 rounded-lg bg-muted/30 hover:bg-muted/60 transition-colors cursor-pointer border border-transparent hover:border-border"
              >
                <span className="text-2xl">{b.emoji}</span>
                <span className="text-[10px] text-muted-foreground">
                  {b.label}
                </span>
                <span className="text-xs font-bold text-primary">
                  Lv.{level}
                </span>
              </motion.button>
            );
          })}
        </div>
      </motion.div>

      {/* 升级对话框 */}
      <Dialog
        open={!!selectedBuilding}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedBuilding(null);
            setError(null);
            setUpgradeResult(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              升级{" "}
              {selectedBuilding
                ? BUILDINGS.find((b) => b.key === selectedBuilding)?.emoji +
                  " " +
                  BUILDINGS.find((b) => b.key === selectedBuilding)?.label
                : ""}
            </DialogTitle>
          </DialogHeader>

          {selectedBuilding && village && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {BUILDINGS.find((b) => b.key === selectedBuilding)?.desc}
              </p>

              <div className="flex items-center justify-between text-sm">
                <span>当前等级</span>
                <span className="font-bold">Lv.{(village as any)[selectedBuilding]}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>升级费用</span>
                <span className="font-bold text-amber-400">
                  {getUpgradeCost((village as any)[selectedBuilding])} 金币
                </span>
              </div>

              {error && (
                <p className="text-xs text-destructive">{error}</p>
              )}
              {upgradeResult && (
                <p className="text-xs text-emerald-400">{upgradeResult}</p>
              )}

              <Button
                className="w-full"
                onClick={handleUpgrade}
              >
                确认升级
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
