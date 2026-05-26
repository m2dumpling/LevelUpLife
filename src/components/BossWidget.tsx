"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Skull, Swords, Trophy, Gift, X } from "lucide-react";

interface BossData {
  id: number; name: string; emoji: string; hp: number; maxHp: number;
  defeated: boolean; hpPercent: number; dayEnd: string;
  contributions: { userId: number; damage: number; username: string }[];
  totalUsers: number; totalDamage: number; activeUsers: number;
  reward?: { gold: number; description: string } | null;
  damageTable: Record<string, number>;
}

export function BossWidget() {
  const [boss, setBoss] = useState<BossData | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const [celebrateBoss, setCelebrateBoss] = useState<BossData | null>(null);
  const celebratedBossId = useRef<number>(
    typeof window !== "undefined" ? Number(localStorage.getItem("celebratedBossId") || "0") : 0
  );

  const fetchBoss = async () => {
    try {
      const res = await fetch("/api/boss");
      if (res.ok) {
        const data = await res.json();
        setBoss(data);
        if (data.defeated && data.notified && data.id !== celebratedBossId.current) {
          setCelebrateBoss(data);
          setCelebrate(true);
          celebratedBossId.current = data.id;
          localStorage.setItem("celebratedBossId", String(data.id));
        }
        if (!data.defeated && celebratedBossId.current !== 0) {
          celebratedBossId.current = 0;
          localStorage.removeItem("celebratedBossId");
        }
      }
    } catch {}
  };

  const dismiss = () => { setCelebrate(false); };
  useEffect(() => { fetchBoss(); const iv = setInterval(fetchBoss, 5000); return () => clearInterval(iv); }, []);

  if (!boss) return null;

  return (
    <>
      <AnimatePresence>
        {celebrate && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          >
            <div className="bg-card border border-amber-500/30 rounded-2xl p-8 text-center space-y-3 shadow-2xl max-w-sm w-[calc(100%-2rem)]">
              <div className="text-5xl">{celebrateBoss?.emoji || "🐉"}</div>
              <h2 className="text-2xl font-black text-amber-400">BOSS 被击败了！</h2>
              <p className="text-sm text-muted-foreground">{celebrateBoss?.name || ""} 已被 {celebrateBoss?.totalUsers || 0} 名勇者联手击败</p>
              <p className="text-amber-400 font-bold text-lg">🏆 每位参战者获得 {celebrateBoss?.reward?.gold || 0} G 奖励！</p>
              <button onClick={dismiss}
                className="mt-3 px-6 py-2 bg-amber-500/20 text-amber-400 rounded-lg font-bold hover:bg-amber-500/30 transition-colors">
                知道了
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        className="bg-card rounded-lg p-3 border border-border space-y-2 cursor-pointer hover:border-primary/30 transition-colors"
        onClick={() => setShowDetail(true)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">{boss.emoji}</span>
            <div>
              <span className="text-sm font-bold text-foreground">{boss.name}</span>
              <span className="text-[10px] text-muted-foreground ml-2">今日 BOSS</span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <Swords className="w-3 h-3" />
            <span>{boss.totalUsers} 人 · {boss.totalDamage} 伤害</span>
          </div>
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>HP</span><span>{boss.hp} / {boss.maxHp}</span>
          </div>
          <div className="h-3 bg-muted rounded-full overflow-hidden">
            <motion.div animate={{ width: `${boss.hpPercent}%` }}
              className={`h-full rounded-full ${boss.defeated ? "bg-emerald-400" : "bg-red-400"}`} />
          </div>
        </div>
        {boss.defeated ? (
          <div className="flex items-center gap-1.5 text-xs text-emerald-400"><Trophy className="w-3.5 h-3.5" /><span className="font-bold">已击败！奖励已发放</span></div>
        ) : (
          <div className="text-[10px] text-muted-foreground">打卡造成伤害（琐碎1·简单2·中等4·困难8·史诗16）</div>
        )}

        {boss.contributions.length > 0 && (
          <div className="flex gap-2 text-[10px] text-muted-foreground flex-wrap">
            <span className="text-amber-400">🏆</span>
            {boss.contributions.slice(0, 5).map((c, i) => (
              <span key={i}>{c.username}<span className="text-amber-400 ml-0.5">{c.damage}</span></span>
            ))}
          </div>
        )}
      </motion.div>

      {/* Detail dialog */}
      {showDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowDetail(false)}>
          <div onClick={e => e.stopPropagation()} className="bg-card border border-border rounded-xl w-[calc(100%-2rem)] max-w-sm p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-foreground flex items-center gap-2"><span className="text-xl">{boss.emoji}</span>{boss.name}</h3>
              <button onClick={() => setShowDetail(false)}><X className="w-4 h-4" /></button>
            </div>
            <div className="text-xs text-muted-foreground space-y-2">
              <p>每日 BOSS — 北京时间每天凌晨刷新</p>
              <p>HP 根据社群活跃度动态生成</p>
              <p className="text-amber-400 font-bold">击败奖励: 每位参战者 ~{boss.reward?.gold || "?"} G</p>
              <div className="bg-muted/50 rounded-lg p-2 space-y-1">
                <p className="text-foreground font-medium">伤害表</p>
                {Object.entries(boss.damageTable).map(([diff, dmg]) => (
                  <p key={diff} className="flex justify-between">{diff} <span className="text-red-400">{dmg} 伤害</span></p>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
