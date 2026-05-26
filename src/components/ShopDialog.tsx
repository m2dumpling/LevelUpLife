"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Store, Coins } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { SHOP_ORES, type OreConfig } from "@/lib/shop-data";

interface ShopDialogProps {
  gold: number;
  inventory: Record<string, { quantity: number; equipped: boolean }>;
  onBuy: (itemKey: string) => Promise<void>;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function ShopDialog({ gold, inventory, onBuy, open: controlledOpen, onOpenChange: controlledOnChange }: ShopDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const handleOpenChange = isControlled
    ? (v: boolean) => { if (!v) setError(""); controlledOnChange?.(v); }
    : (v: boolean) => { setInternalOpen(v); setError(""); };

  const [buying, setBuying] = useState<string | null>(null);
  const [error, setError] = useState("");

  const handleBuy = async (ore: OreConfig) => {
    setError("");
    setBuying(ore.oreKey);
    try {
      const res = await fetch("/api/shop/buy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemKey: ore.oreKey }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "购买失败");
        return;
      }
      await onBuy(ore.oreKey);
      window.dispatchEvent(new Event("inventory-changed"));
      window.dispatchEvent(new Event("stats-changed"));
    } catch {
      setError("网络错误，请重试");
    } finally {
      setBuying(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {isControlled ? null : (
        <DialogTrigger
          render={
            <button
              type="button"
              className="inline-flex shrink-0 items-center justify-center gap-1 rounded-md border border-border bg-transparent px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-card hover:border-primary/40 transition-colors"
            >
              <Store className="w-3.5 h-3.5" />
              商店
            </button>
          }
        />
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Store className="w-4 h-4" />
            矿石商店
          </DialogTitle>
          <div className="flex items-center gap-1.5 text-sm">
            <Coins className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-amber-400 font-semibold">{gold}</span>
            <span className="text-muted-foreground">金币</span>
          </div>
        </DialogHeader>

        {error && (
          <p className="text-xs text-red-400 bg-red-400/5 rounded-md px-3 py-2">{error}</p>
        )}

        <div className="grid grid-cols-2 gap-2">
          {SHOP_ORES.map((ore) => {
            const owned = inventory[ore.oreKey]?.quantity ?? 0;
            const canBuy = gold >= ore.cost;
            const isBuying = buying === ore.oreKey;

            return (
              <motion.div
                key={ore.oreKey}
                whileHover={{ scale: 1.02 }}
                className="bg-card rounded-lg p-3 border border-border flex flex-col items-center gap-2"
              >
                <span className="text-2xl">{ore.oreEmoji}</span>
                <span className="text-sm font-medium">{ore.oreName}</span>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Coins className="w-3 h-3 text-amber-400" />
                  <span className="text-amber-400 font-semibold">{ore.cost}</span>
                  G
                </div>
                {owned > 0 && (
                  <span className="text-[10px] text-muted-foreground">拥有: {owned}</span>
                )}
                <button
                  type="button"
                  disabled={!canBuy || !!isBuying}
                  onClick={() => handleBuy(ore)}
                  className={`
                    w-full mt-1 px-3 py-1.5 text-xs rounded-md font-medium transition-colors
                    ${canBuy
                      ? "bg-primary/10 text-primary hover:bg-primary/20 border border-primary/30"
                      : "bg-muted text-muted-foreground cursor-not-allowed border border-border"
                    }
                  `}
                >
                  {isBuying ? "购买中..." : canBuy ? "购买" : "金币不足"}
                </button>
              </motion.div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
