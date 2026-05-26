"use client";

import { useState } from "react";
import { Package, Hammer } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { SHOP_ORES, MEDAL_RECIPES, sortByRarity, type OreConfig, type MedalConfig } from "@/lib/shop-data";

interface BackpackDialogProps {
  inventory: Record<string, { quantity: number; equipped: boolean }>;
  onCraft: (medalKey: string) => Promise<void>;
  onEquip: (itemKey: string, equipped: boolean) => Promise<void>;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function BackpackDialog({ inventory, onCraft, onEquip, open: controlledOpen, onOpenChange: controlledOnChange }: BackpackDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const handleOpenChange = isControlled
    ? (v: boolean) => { if (!v) setError(""); controlledOnChange?.(v); }
    : (v: boolean) => { setInternalOpen(v); setError(""); };

  const [crafting, setCrafting] = useState<string | null>(null);
  const [error, setError] = useState("");

  const handleCraft = async (medal: MedalConfig) => {
    setError("");
    setCrafting(medal.medalKey);
    try {
      const res = await fetch("/api/craft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ medalKey: medal.medalKey }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "合成失败");
        return;
      }
      await onCraft(medal.medalKey);
      window.dispatchEvent(new Event("inventory-changed"));
    } catch {
      setError("网络错误，请重试");
    } finally {
      setCrafting(null);
    }
  };

  const handleEquip = async (medal: MedalConfig) => {
    setError("");
    const currentlyEquipped = inventory[medal.medalKey]?.equipped ?? false;
    try {
      const res = await fetch("/api/inventory/equip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemKey: medal.medalKey, equipped: !currentlyEquipped }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "操作失败");
        return;
      }
      await onEquip(medal.medalKey, !currentlyEquipped);
      window.dispatchEvent(new Event("inventory-changed"));
    } catch {
      setError("网络错误，请重试");
    }
  };

  const hasAnyItem = SHOP_ORES.some((o) => (inventory[o.oreKey]?.quantity ?? 0) > 0)
    || MEDAL_RECIPES.some((m) => (inventory[m.medalKey]?.quantity ?? 0) > 0);

  const sortedMedals = sortByRarity(MEDAL_RECIPES.filter((m) => (inventory[m.medalKey]?.quantity ?? 0) > 0));

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {isControlled ? null : (
        <DialogTrigger
          render={
            <button
              type="button"
              className="inline-flex shrink-0 items-center justify-center gap-1 rounded-md border border-border bg-transparent px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-card hover:border-primary/40 transition-colors"
            >
              <Package className="w-3.5 h-3.5" />
              背包
            </button>
          }
        />
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-4 h-4" />
            背包
          </DialogTitle>
        </DialogHeader>

        {error && (
          <p className="text-xs text-red-400 bg-red-400/5 rounded-md px-3 py-2">{error}</p>
        )}

        {!hasAnyItem ? (
          <div className="text-center py-8 text-muted-foreground">
            <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">背包空空如也</p>
            <p className="text-xs mt-1">去商店买些矿石吧！</p>
          </div>
        ) : (
          <div className="space-y-4 max-h-[50vh] overflow-y-auto">
            {/* 矿石区 */}
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground mb-2">矿石</h4>
              <div className="grid grid-cols-5 gap-2">
                {SHOP_ORES.map((ore) => {
                  const qty = inventory[ore.oreKey]?.quantity ?? 0;
                  if (qty === 0) return null;
                  const medal = MEDAL_RECIPES.find((m) => m.oreKey === ore.oreKey)!;
                  const canCraft = qty >= medal.oreRequired;
                  const isCrafting = crafting === medal.medalKey;

                  return (
                    <div
                      key={ore.oreKey}
                      className="bg-card rounded-lg p-2 border border-border flex flex-col items-center gap-1"
                    >
                      <span className="text-lg">{ore.oreEmoji}</span>
                      <span className="text-[10px] text-muted-foreground">{ore.oreName}</span>
                      <span className="text-xs font-bold text-foreground">×{qty}</span>
                      <button
                        type="button"
                        disabled={!canCraft || !!isCrafting}
                        onClick={() => handleCraft(medal)}
                        className={`
                          w-full mt-0.5 px-1.5 py-0.5 text-[10px] rounded font-medium transition-colors
                          ${canCraft
                            ? "bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/30"
                            : "bg-muted text-muted-foreground cursor-not-allowed border border-border"
                          }
                        `}
                      >
                        {isCrafting
                          ? "合成中..."
                          : canCraft
                            ? `合成(${qty}/${medal.oreRequired})`
                            : `${qty}/${medal.oreRequired}`}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 奖牌区 */}
            {sortedMedals.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground mb-2">奖牌</h4>
                <div className="space-y-1.5">
                  {sortedMedals.map((medal) => {
                    const item = inventory[medal.medalKey];
                    const qty = item?.quantity ?? 0;
                    const isEquipped = item?.equipped ?? false;
                    const rarityColors: Record<string, string> = {
                      common: "border-amber-700/30 bg-amber-900/10",
                      uncommon: "border-gray-400/30 bg-gray-400/5",
                      rare: "border-amber-400/30 bg-amber-400/5",
                      epic: "border-purple-400/30 bg-purple-400/5",
                      legendary: "border-orange-400/30 bg-orange-400/5",
                    };

                    return (
                      <button
                        key={medal.medalKey}
                        type="button"
                        onClick={() => handleEquip(medal)}
                        className={`
                          w-full flex items-center justify-between p-2.5 rounded-lg border text-left transition-colors
                          ${isEquipped
                            ? "border border-l-2 border-l-emerald-400 bg-emerald-500/5"
                            : `border ${rarityColors[medal.rarity] ?? "border-border"} hover:border-emerald-500/20`
                          }
                        `}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{medal.medalEmoji}</span>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-medium">{medal.medalName}</span>
                              {isEquipped && (
                                <span className="text-[9px] px-1 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-medium">
                                  佩戴中
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-muted-foreground">
                              +{medal.xpBonusPercent}% XP
                            </span>
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground">×{qty}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
