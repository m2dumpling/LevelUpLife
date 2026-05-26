"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Gift, X } from "lucide-react";

interface LotteryButtonProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function LotteryButton({ open: controlledOpen, onOpenChange }: LotteryButtonProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = (v: boolean) => {
    if (isControlled) {
      onOpenChange?.(v);
    } else {
      setInternalOpen(v);
    }
  };

  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ canDraw: boolean; drawn: boolean; completedToday: number; required: number } | null>(null);

  const checkStatus = async () => {
    const res = await fetch("/api/lottery");
    if (res.ok) setStatus(await res.json());
    if (!isControlled) setInternalOpen(true);
  };

  // Auto-fetch status when controlled open
  useEffect(() => {
    if (isControlled && open) {
      checkStatus();
    }
  }, [isControlled, open]);

  const draw = async () => {
    setLoading(true);
    const res = await fetch("/api/lottery", { method: "POST" });
    const data = await res.json();
    if (data.success) {
      setResult(data.result);
      window.dispatchEvent(new Event("inventory-changed"));
      window.dispatchEvent(new Event("stats-changed"));
      // refresh status
      const statusRes = await fetch("/api/lottery");
      if (statusRes.ok) setStatus(await statusRes.json());
    } else {
      setResult(data.error || "抽奖失败");
    }
    setLoading(false);
  };

  return (
    <>
      {!isControlled && (
        <button
          onClick={checkStatus}
          className="inline-flex shrink-0 items-center justify-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-xs font-medium text-amber-400 hover:bg-amber-500/20 transition-colors"
        >
          <Gift className="w-3.5 h-3.5" />
          每日抽奖
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setOpen(false)}>
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="relative bg-card border border-border rounded-xl p-6 max-w-sm w-[calc(100%-2rem)] text-center space-y-4"
          >
            <button onClick={() => setOpen(false)} className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
            <div className="text-3xl">🎰</div>
            <h3 className="text-lg font-bold text-foreground">每日抽奖</h3>
            <p className="text-xs text-muted-foreground">完成 {status?.required || 3} 个 Habit 即可免费抽一次</p>
            <p className="text-xs text-muted-foreground">今日已完成: <span className="text-emerald-400">{status?.completedToday || 0}</span></p>

            {result && (
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="bg-muted/50 rounded-lg p-3 text-sm text-foreground">
                {result}
              </motion.div>
            )}

            {status?.drawn && !result && (
              <p className="text-xs text-amber-400">今天已经抽过了，明天再来！</p>
            )}

            {!status?.drawn && !result && (
              <button
                onClick={draw}
                disabled={!status?.canDraw || loading}
                className={`w-full py-2 rounded-lg font-bold text-sm transition-colors ${
                  status?.canDraw
                    ? "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30"
                    : "bg-muted text-muted-foreground cursor-not-allowed"
                }`}
              >
                {loading ? "🎰 抽奖中..." : status?.canDraw ? "🎰 免费抽一次！" : `还需 ${(status?.required || 3) - (status?.completedToday || 0)} 个 Habit`}
              </button>
            )}
          </motion.div>
        </div>
      )}
    </>
  );
}
