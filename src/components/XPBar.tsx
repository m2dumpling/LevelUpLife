"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { xpProgressPercent } from "@/lib/xp-calculator";

interface XPBarProps {
  xp: number;
  xpToNext: number;
  level: number;
}

export function XPBar({ xp, xpToNext, level }: XPBarProps) {
  const [displayPercent, setDisplayPercent] = useState(0);
  const targetPercent = xpProgressPercent(xp, xpToNext);

  useEffect(() => {
    // 平滑过渡到目标百分比
    const timer = setTimeout(() => {
      setDisplayPercent(targetPercent);
    }, 50);
    return () => clearTimeout(timer);
  }, [targetPercent]);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
            Lv.{level}
          </span>
        </div>
        <span className="text-xs text-muted-foreground tabular-nums">
          {xp} / {xpToNext} XP
        </span>
      </div>
      <div className="relative w-full h-3 rounded-full bg-muted overflow-hidden border border-border">
        <motion.div
          className="h-full rounded-full"
          style={{
            background:
              "linear-gradient(90deg, oklch(0.6_0.2_142) 0%, oklch(0.72_0.22_142) 50%, oklch(0.65_0.2_142) 100%)",
            boxShadow: "0 0 12px oklch(0.65_0.2_142 / 0.5), inset 0 1px 0 oklch(1_0_0 / 0.2)",
          }}
          initial={{ width: 0 }}
          animate={{ width: `${displayPercent}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
        {/* 光泽扫过 */}
        <motion.div
          className="absolute top-0 left-0 h-full w-8 bg-gradient-to-r from-transparent via-white/20 to-transparent"
          animate={{ left: ["-2rem", `${displayPercent}%`] }}
          transition={{ duration: 1.5, ease: "easeInOut", delay: 0.2 }}
        />
      </div>
    </div>
  );
}
