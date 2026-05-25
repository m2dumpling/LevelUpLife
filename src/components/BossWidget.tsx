"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Skull, Swords, Trophy } from "lucide-react";

interface BossData {
  id: number; name: string; emoji: string; hp: number; maxHp: number;
  defeated: boolean; hpPercent: number; weekEnd: string;
  contributions: { userId: number; damage: number; username: string }[];
  totalUsers: number; totalDamage: number;
}

export function BossWidget() {
  const [boss, setBoss] = useState<BossData | null>(null);

  const fetchBoss = async () => {
    try {
      const res = await fetch("/api/boss");
      if (res.ok) setBoss(await res.json());
    } catch {}
  };

  useEffect(() => { fetchBoss(); }, []);

  if (!boss) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card rounded-lg p-3 border border-border space-y-2"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">{boss.emoji}</span>
          <div>
            <span className="text-sm font-bold text-foreground">{boss.name}</span>
            <span className="text-[10px] text-muted-foreground ml-2">本周 BOSS</span>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <Swords className="w-3 h-3" />
          <span>{boss.totalUsers} 人参战</span>
          <span className="text-amber-400">{boss.totalDamage} 伤害</span>
        </div>
      </div>

      {/* HP bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>HP</span>
          <span>{boss.hp} / {boss.maxHp}</span>
        </div>
        <div className="h-3 bg-muted rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${boss.hpPercent}%` }}
            className={`h-full rounded-full transition-all ${boss.defeated ? "bg-emerald-400" : "bg-red-400"}`}
          />
        </div>
      </div>

      {boss.defeated ? (
        <div className="flex items-center gap-1.5 text-xs text-emerald-400">
          <Trophy className="w-3.5 h-3.5" />
          <span className="font-bold">BOSS 已被击败！全体参战者瓜分战利品！</span>
        </div>
      ) : (
        <div className="text-[10px] text-muted-foreground">
          每次打卡对 BOSS 造成伤害（琐碎=1, 简单=2, 中等=4, 困难=8, 史诗=16）
        </div>
      )}

      {/* Top contributors */}
      {boss.contributions.length > 0 && (
        <div className="flex gap-2 text-[10px] text-muted-foreground flex-wrap">
          <span className="text-amber-400">🏆</span>
          {boss.contributions.slice(0, 5).map((c, i) => (
            <span key={i}>
              {c.username}
              <span className="text-amber-400 ml-0.5">{c.damage}</span>
            </span>
          ))}
        </div>
      )}
    </motion.div>
  );
}
