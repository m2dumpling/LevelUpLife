"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, Sparkles, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface PetData {
  hasPet: boolean;
  pet: {
    id: number;
    petType: string;
    stage: number;
    hatchedAt: string;
    fedToday: boolean;
    name: string;
    emoji: string;
    xpBonus: number;
    goldBonus: number;
    stageName: string;
    nextStageName: string | null;
    activeDays: number;
    daysForNextStage: number | null;
    progress: number;
    remaining: number;
  } | null;
  availablePets: {
    type: string;
    name: string;
    emoji: string;
    buff: string;
  }[];
  streakDays: number;
}

export function PetWidget() {
  const [data, setData] = useState<PetData | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [hatching, setHatching] = useState(false);
  const [hatchError, setHatchError] = useState("");

  const fetchPet = useCallback(async () => {
    try {
      const res = await fetch("/api/pet");
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch {
      // 静默失败
    }
  }, []);

  useEffect(() => {
    fetchPet();
  }, [fetchPet]);

  // 任务完成时刷新宠物数据
  useEffect(() => {
    const handler = () => fetchPet();
    window.addEventListener("task-completed", handler);
    return () => window.removeEventListener("task-completed", handler);
  }, [fetchPet]);

  const handleHatch = async (petType: string) => {
    setHatching(true);
    setHatchError("");
    try {
      const res = await fetch("/api/pet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "hatch", petType }),
      });
      if (res.ok) {
        await fetchPet();
      } else {
        const err = await res.json();
        setHatchError(err.error ?? "孵化失败");
      }
    } catch {
      setHatchError("网络错误");
    } finally {
      setHatching(false);
    }
  };

  if (!data) return null;

  const STAGE_COLORS = [
    "from-amber-400 to-amber-500",
    "from-orange-400 to-red-500",
    "from-purple-400 to-pink-500",
  ];

  return (
    <>
      {/* 无宠物状态 */}
      {!data.hasPet ? (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-lg p-3 border border-border space-y-2"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl">🥚</span>
              <div>
                <span className="text-sm font-bold text-foreground">
                  宠物系统
                </span>
              </div>
            </div>
            <span className="text-[10px] text-muted-foreground">
              连续打卡 {data.streakDays} 天
            </span>
          </div>

          <p className="text-xs text-muted-foreground">
            连续打卡 3 天可获得宠物！
          </p>

          {/* Streak progress */}
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>距离解锁</span>
              <span>
                {data.streakDays >= 3
                  ? "已达标！"
                  : `还需 ${3 - data.streakDays} 天`}
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{
                  width: `${Math.min((data.streakDays / 3) * 100, 100)}%`,
                }}
                className="h-full rounded-full bg-amber-400 transition-all"
              />
            </div>
          </div>

          {/* 可孵化列表 */}
          {data.availablePets.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[10px] text-muted-foreground">
                可孵化的宠物：
              </span>
              <div className="flex gap-2 flex-wrap">
                {data.availablePets.map((pet) => (
                  <button
                    key={pet.type}
                    disabled={hatching}
                    onClick={() => handleHatch(pet.type)}
                    className="flex items-center gap-1 px-2 py-1 rounded-md bg-muted hover:bg-accent transition-colors disabled:opacity-50 text-xs"
                  >
                    <span>{pet.emoji}</span>
                    <span className="font-medium">{pet.name}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {pet.buff}
                    </span>
                  </button>
                ))}
              </div>
              {hatchError && (
                <p className="text-[10px] text-red-400">{hatchError}</p>
              )}
            </div>
          )}
        </motion.div>
      ) : (
        /* 有宠物状态 */
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ scale: 1.01 }}
          onClick={() => setDialogOpen(true)}
          className="bg-card rounded-lg p-3 border border-border space-y-2 cursor-pointer hover:border-primary/40 transition-colors"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <motion.span
                className="text-2xl"
                animate={{
                  y: [0, -4, 0],
                  rotate: [0, -5, 5, 0],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              >
                {data.pet!.emoji}
              </motion.span>
              <div>
                <div className="flex items-center gap-1">
                  <span className="text-sm font-bold text-foreground">
                    {data.pet!.name}
                  </span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full bg-gradient-to-r ${
                      STAGE_COLORS[data.pet!.stage] ?? STAGE_COLORS[0]
                    } text-white`}
                  >
                    {data.pet!.stageName}
                  </span>
                </div>
                <div className="flex gap-2 text-[10px] text-muted-foreground">
                  {data.pet!.xpBonus > 0 && (
                    <span className="text-blue-400">
                      +{data.pet!.xpBonus}% XP
                    </span>
                  )}
                  {data.pet!.goldBonus > 0 && (
                    <span className="text-amber-400">
                      +{data.pet!.goldBonus}% 金币
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 text-[10px]">
              {data.pet!.fedToday ? (
                <Heart className="w-3 h-3 text-red-400 fill-red-400" />
              ) : (
                <Heart className="w-3 h-3 text-muted-foreground" />
              )}
            </div>
          </div>

          {/* 进化进度条 */}
          {data.pet!.daysForNextStage != null && (
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>进化进度</span>
                <span>
                  {data.pet!.remaining > 0
                    ? `${data.pet!.activeDays}/${data.pet!.daysForNextStage} 天`
                    : "已达标！"}
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{
                    width: `${Math.min(data.pet!.progress * 100, 100)}%`,
                  }}
                  className={`h-full rounded-full bg-gradient-to-r ${
                    STAGE_COLORS[data.pet!.stage] ?? STAGE_COLORS[0]
                  } transition-all`}
                />
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* 宠物详情对话框 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          {data.hasPet && data.pet && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <motion.span
                    className="text-3xl"
                    animate={{
                      y: [0, -6, 0],
                      rotate: [0, -5, 5, 0],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  >
                    {data.pet.emoji}
                  </motion.span>
                  <div>
                    <span>{data.pet.name}</span>
                    {/* Stage badge */}
                    <span
                      className={`ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-gradient-to-r ${
                        STAGE_COLORS[data.pet.stage] ?? STAGE_COLORS[0]
                      } text-white align-middle`}
                    >
                      {data.pet.stageName}
                    </span>
                  </div>
                </DialogTitle>
                <DialogDescription className="space-y-3 mt-2">
                  {/* Buff 信息 */}
                  <div className="grid grid-cols-2 gap-2">
                    {data.pet.xpBonus > 0 && (
                      <div className="bg-muted rounded-lg p-2 text-center">
                        <div className="text-lg">⚡</div>
                        <div className="text-xs text-blue-400 font-bold">
                          +{data.pet.xpBonus}% XP
                        </div>
                      </div>
                    )}
                    {data.pet.goldBonus > 0 && (
                      <div className="bg-muted rounded-lg p-2 text-center">
                        <div className="text-lg">💰</div>
                        <div className="text-xs text-amber-400 font-bold">
                          +{data.pet.goldBonus}% 金币
                        </div>
                      </div>
                    )}
                    {data.pet.xpBonus === 0 &&
                      data.pet.goldBonus === 0 && (
                        <div className="bg-muted rounded-lg p-2 text-center col-span-2">
                          <div className="text-lg">🎁</div>
                          <div className="text-xs text-purple-400 font-bold">
                            +5% 稀有掉落
                          </div>
                        </div>
                      )}
                  </div>

                  {/* 喂食状态 */}
                  <div className="flex items-center gap-2 text-xs">
                    {data.pet.fedToday ? (
                      <>
                        <Heart className="w-4 h-4 text-red-400 fill-red-400" />
                        <span className="text-muted-foreground">
                          今日已喂食 — {data.pet.name}充满活力！
                        </span>
                      </>
                    ) : (
                      <>
                        <Heart className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">
                          今日尚未喂食 — 连续3天未喂食会走失
                        </span>
                      </>
                    )}
                  </div>

                  {/* 进化进度 */}
                  {data.pet.stage < 2 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                          进化至{" "}
                          <span className="font-bold text-foreground">
                            {data.pet.nextStageName}
                          </span>
                        </span>
                        <span className="text-muted-foreground">
                          {data.pet.activeDays}/
                          {data.pet.daysForNextStage ?? "?"} 活跃天
                        </span>
                      </div>
                      <div className="h-3 bg-muted rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{
                            width: `${Math.min(data.pet.progress * 100, 100)}%`,
                          }}
                          className={`h-full rounded-full bg-gradient-to-r ${
                            STAGE_COLORS[data.pet.stage] ?? STAGE_COLORS[0]
                          }`}
                        />
                      </div>
                      {data.pet.remaining > 0 ? (
                        <p className="text-[11px] text-muted-foreground">
                          还需 {data.pet.remaining} 天活跃即可进化
                        </p>
                      ) : (
                        <p className="text-[11px] text-green-400 flex items-center gap-1">
                          <Sparkles className="w-3 h-3" />
                          进化条件已达成！继续打卡将自动进化
                        </p>
                      )}
                    </div>
                  )}

                  {data.pet.stage >= 2 && (
                    <div className="text-center py-2">
                      <Star className="w-5 h-5 text-amber-400 mx-auto mb-1" />
                      <p className="text-xs text-amber-400 font-bold">
                        已达到最高形态 — 传说！
                      </p>
                    </div>
                  )}

                  {/* 孵化日期 */}
                  <p className="text-[10px] text-muted-foreground text-center">
                    孵化于 {data.pet.hatchedAt}
                  </p>
                </DialogDescription>
              </DialogHeader>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
