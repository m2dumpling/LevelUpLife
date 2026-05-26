"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Shield } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { GuildPanel } from "./GuildPanel";

interface GuildButtonProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function GuildButton({ open: controlledOpen, onOpenChange: controlledOnChange }: GuildButtonProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const onOpenChange = isControlled ? controlledOnChange! : setInternalOpen;

  const [memberCount, setMemberCount] = useState<number | null>(null);
  const [inGuild, setInGuild] = useState(false);

  const fetchInfo = useCallback(async () => {
    try {
      const res = await fetch("/api/guild");
      const data = await res.json();
      if (data.guild) {
        setInGuild(true);
        setMemberCount(data.members?.length ?? 0);
      } else {
        setInGuild(false);
        setMemberCount(null);
      }
    } catch {
      setInGuild(false);
      setMemberCount(null);
    }
  }, []);

  useEffect(() => {
    fetchInfo();
  }, [fetchInfo]);

  // 监听公会变动事件
  useEffect(() => {
    const handler = () => fetchInfo();
    window.addEventListener("guild-changed", handler);
    return () => window.removeEventListener("guild-changed", handler);
  }, [fetchInfo]);

  return (
    <>
      {!isControlled && (
        <motion.button
          onClick={() => setInternalOpen(true)}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          title={inGuild ? "打开公会" : "加入或创建公会"}
          className={`inline-flex shrink-0 items-center gap-1.5 px-3 py-2 rounded-lg border font-bold text-sm transition-all ${
            inGuild
              ? "border-amber-500/40 bg-amber-500/10 text-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.15)]"
              : "border-border bg-muted/50 text-muted-foreground hover:border-amber-500/30"
          }`}
        >
          <motion.span
            animate={inGuild ? { rotate: [0, -5, 5, -5, 0] } : {}}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          >
            <Shield className={`w-5 h-5 ${inGuild ? "text-amber-400" : ""}`} />
          </motion.span>
          <span>公会</span>
          {inGuild && (
            <span className="text-[10px] bg-amber-500/20 rounded-full px-1.5 py-0.5 leading-none">
              {memberCount}
            </span>
          )}
        </motion.button>
      )}

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="sm:max-w-lg max-h-[90vh] overflow-hidden p-0"
          showCloseButton={false}
        >
          <GuildPanel onClose={() => onOpenChange(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}
