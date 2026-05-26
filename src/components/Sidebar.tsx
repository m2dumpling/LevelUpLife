"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MoreHorizontal } from "lucide-react";

export interface SidebarItem {
  id: string;
  icon: React.ReactNode;
  label: string;
  blink?: boolean;
}

interface SidebarProps {
  items: SidebarItem[];
  activePanel: string | null;
  onPanelClick: (id: string) => void;
  mobileOverflowIndices?: number[];
}

export function Sidebar({
  items,
  activePanel,
  onPanelClick,
  mobileOverflowIndices = [5, 6],
}: SidebarProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const visibleItems = isMobile
    ? items.filter((_, i) => !mobileOverflowIndices.includes(i))
    : items;
  const overflowItems = isMobile
    ? items.filter((_, i) => mobileOverflowIndices.includes(i))
    : [];

  // Close overflow menu on outside click
  useEffect(() => {
    if (!moreOpen) return;
    const handler = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [moreOpen]);

  const containerClass = isMobile
    ? "fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border flex items-center justify-around px-2 py-1"
    : "fixed left-0 top-0 bottom-0 z-40 w-[60px] bg-card border-r border-border flex flex-col items-center py-3 gap-0.5";

  return (
    <div className={containerClass}>
      {!isMobile && <div className="h-2" />}

      {visibleItems.map((item) => {
        const isActive = activePanel === item.id;
        return (
          <div key={item.id} className="relative group">
            {/* Active indicator - left bar (desktop) */}
            {!isMobile && isActive && (
              <motion.div
                layoutId="sidebar-active-indicator"
                className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-8 bg-emerald-400 rounded-r-full"
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            )}
            {/* Active indicator - top bar (mobile) */}
            {isMobile && isActive && (
              <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-emerald-400 rounded-b-full" />
            )}

            <button
              onClick={() => onPanelClick(item.id)}
              className={[
                "w-11 h-11 flex items-center justify-center rounded-lg transition-all duration-150",
                isActive
                  ? "bg-emerald-500/10 text-emerald-400"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              ].join(" ")}
              title={item.blink ? "有未读信息" : (isMobile ? item.label : undefined)}
            >
              <span className={`w-5 h-5 flex items-center justify-center ${item.blink ? "animate-[pulse_0.6s_ease-in-out_infinite] text-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.6)]" : ""}`}>
                {item.icon}
              </span>
            </button>

            {/* Tooltip (desktop only) */}
            {!isMobile && (
              <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-2 py-1 bg-popover border border-border rounded-md text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-100 z-50">
                {item.label}
              </div>
            )}
          </div>
        );
      })}

      {/* Mobile: "More" overflow button */}
      {isMobile && overflowItems.length > 0 && (
        <div className="relative" ref={moreRef}>
          <button
            onClick={() => setMoreOpen(!moreOpen)}
            className={[
              "w-11 h-11 flex items-center justify-center rounded-lg transition-all duration-150",
              moreOpen
                ? "bg-emerald-500/10 text-emerald-400"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            ].join(" ")}
          >
            <MoreHorizontal className="w-5 h-5" />
          </button>

          <AnimatePresence>
            {moreOpen && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute bottom-full mb-3 right-0 bg-popover border border-border rounded-xl p-2 shadow-2xl min-w-[150px]"
              >
                {overflowItems.map((item) => {
                  const isActive = activePanel === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        onPanelClick(item.id);
                        setMoreOpen(false);
                      }}
                      className={[
                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                        isActive
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "text-foreground hover:bg-accent",
                      ].join(" ")}
                    >
                      <span className="w-5 h-5 flex items-center justify-center">
                        {item.icon}
                      </span>
                      {item.label}
                    </button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
