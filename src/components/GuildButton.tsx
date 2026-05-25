"use client";

import { useState, useEffect, useCallback } from "react";
import { Shield } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { GuildPanel } from "./GuildPanel";

export function GuildButton() {
  const [open, setOpen] = useState(false);
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
      <button
        onClick={() => setOpen(true)}
        title={inGuild ? "打开公会" : "加入或创建公会"}
        className="inline-flex shrink-0 items-center gap-1 px-2 py-1.5 rounded-md border border-border bg-muted/50 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
      >
        <Shield
          className={`w-3.5 h-3.5 ${inGuild ? "text-amber-400" : ""}`}
        />
        <span>{memberCount !== null ? memberCount : "?"}</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="sm:max-w-lg max-h-[90vh] overflow-hidden p-0"
          showCloseButton={false}
        >
          <GuildPanel onClose={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}
