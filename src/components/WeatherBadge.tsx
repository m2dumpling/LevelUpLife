"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface WeatherData {
  city: string | null;
  weather: {
    condition: string;
    emoji: string;
    indoorBonus: number;
    outdoorBonus: number;
  } | null;
  message?: string;
}

const AVAILABLE_CITIES = [
  "北京", "上海", "广州", "深圳", "成都", "杭州", "武汉",
  "南京", "重庆", "西安", "天津", "苏州", "长沙", "郑州",
  "青岛", "厦门", "大连", "昆明",
];

function formatBonus(bonus: number): string {
  const pct = Math.round((bonus - 1) * 100);
  return pct > 0 ? `+${pct}%` : "";
}

interface WeatherBadgeProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function WeatherBadge({ open: controlledOpen, onOpenChange: controlledOnChange }: WeatherBadgeProps = {}) {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : dialogOpen;
  const setOpen = (v: boolean) => {
    if (isControlled) {
      controlledOnChange?.(v);
    } else {
      setDialogOpen(v);
    }
  };

  const [saving, setSaving] = useState(false);

  const fetchWeather = useCallback(async () => {
    try {
      const res = await fetch("/api/weather");
      if (res.ok) {
        const data = await res.json();
        setWeather(data);
      }
    } catch {
      // 静默失败
    }
  }, []);

  useEffect(() => {
    fetchWeather();
  }, [fetchWeather]);

  const handleSelectCity = async (city: string) => {
    setSaving(true);
    try {
      const res = await fetch("/api/weather", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ city }),
      });
      if (res.ok) {
        const data = await res.json();
        setWeather(data);
        setDialogOpen(false);
      }
    } catch {
      // 静默失败
    } finally {
      setSaving(false);
    }
  };

  if (!weather?.city || !weather?.weather) {
    return (
      <>
        {!isControlled && (
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setDialogOpen(true)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            title="设置城市获取天气加成"
          >
            🌍 设置城市
          </motion.button>
        )}

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>选择你的城市</DialogTitle>
            </DialogHeader>
            <p className="text-xs text-muted-foreground mb-2">
              设置城市后可获取实时天气加成：晴天户外任务 +20% XP，雨雪天室内任务 +20% XP，周末双倍。
            </p>
            <div className="grid grid-cols-3 gap-2">
              {AVAILABLE_CITIES.map((city) => (
                <Button
                  key={city}
                  variant="outline"
                  size="sm"
                  disabled={saving}
                  onClick={() => handleSelectCity(city)}
                >
                  {city}
                </Button>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  const w = weather.weather;
  const outdoorBonus = formatBonus(w.outdoorBonus);
  const indoorBonus = formatBonus(w.indoorBonus);

  return (
    <>
      {!isControlled && (
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setDialogOpen(true)}
          className="flex items-center gap-1 text-xs text-foreground hover:text-primary transition-colors cursor-pointer bg-muted/30 px-2 py-0.5 rounded-full"
          title={`室内: ${indoorBonus || "无"} · 室外: ${outdoorBonus || "无"}`}
        >
          <span>{w.emoji}</span>
          <span>{weather.city}</span>
          {(indoorBonus || outdoorBonus) && (
            <span className="text-emerald-400">↑</span>
          )}
        </motion.button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {w.emoji} {weather.city} · {w.condition}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-muted/30 rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground">室内任务加成</p>
                <p className="text-lg font-bold text-foreground">
                  {indoorBonus || "无"}
                </p>
              </div>
              <div className="bg-muted/30 rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground">室外任务加成</p>
                <p className="text-lg font-bold text-foreground">
                  {outdoorBonus || "无"}
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              晴天: 室外 +20% · 雨雪: 室内 +20% · 周末: 双倍
            </p>

            <div>
              <p className="text-xs text-muted-foreground mb-2">切换城市:</p>
              <div className="grid grid-cols-3 gap-1.5">
                {AVAILABLE_CITIES.map((city) => (
                  <Button
                    key={city}
                    variant={city === weather.city ? "default" : "outline"}
                    size="sm"
                    disabled={saving}
                    onClick={() => handleSelectCity(city)}
                  >
                    {city}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
