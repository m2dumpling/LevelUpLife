"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { User, X, Lock, Shield, Hash } from "lucide-react";
import { Button } from "@/components/ui/button";

interface UserInfo { id: number; username: string; name: string; level: number; xp: number; gold: number; guildName?: string | null; memberCount?: number; }

export function UserMenu() {
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState("");
  const [tab, setTab] = useState<"info" | "password">("info");

  useEffect(() => {
    (async () => {
      const u = await fetch("/api/user").then(r => r.json());
      setUser(u);
      // Get guild info
      try {
        const g = await fetch("/api/guild").then(r => r.json());
        if (g.guild) {
          setUser((prev) => prev ? { ...prev, guildName: g.guild.name, memberCount: g.members?.length } : null);
        }
      } catch {}
    })();
  }, [open]);

  const changePassword = async () => {
    setPwError(""); setPwSuccess("");
    if (!oldPw || !newPw) { setPwError("请填写新旧密码"); return; }
    if (newPw.length < 4) { setPwError("新密码至少4位"); return; }
    const res = await fetch("/api/user", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ oldPassword: oldPw, newPassword: newPw }),
    });
    const data = await res.json();
    if (data.success) {
      setPwSuccess("密码修改成功");
      setOldPw(""); setNewPw("");
    } else {
      setPwError(data.error || "修改失败");
    }
  };

  if (!user) return null;

  const initial = (user.name || user.username)[0].toUpperCase();

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="w-8 h-8 rounded-full bg-primary/20 text-primary font-bold text-sm flex items-center justify-center hover:bg-primary/30 transition-colors border border-primary/30"
        title={user.name}>
        {initial}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setOpen(false)}>
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            onClick={e => e.stopPropagation()}
            className="bg-card border border-border rounded-xl w-[calc(100%-2rem)] max-w-sm overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-br from-primary/10 to-secondary/5 p-5 text-center">
              <div className="w-14 h-14 rounded-full bg-primary/20 text-primary font-bold text-2xl flex items-center justify-center mx-auto mb-2 border-2 border-primary/30">
                {initial}
              </div>
              <h2 className="text-lg font-bold text-foreground">{user.name}</h2>
              <p className="text-xs text-muted-foreground">@{user.username} · Lv.{user.level}</p>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-border">
              {(["info", "password"] as const).map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${tab === t ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"}`}>
                  {t === "info" ? "账户信息" : "修改密码"}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="p-4 space-y-3">
              {tab === "info" ? (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between py-1"><span className="text-muted-foreground">用户名</span><span className="text-foreground font-mono">{user.username}</span></div>
                  <div className="flex justify-between py-1"><span className="text-muted-foreground">昵称</span><span className="text-foreground">{user.name}</span></div>
                  <div className="flex justify-between py-1"><span className="text-muted-foreground">等级</span><span className="text-primary font-bold">Lv.{user.level}</span></div>
                  <div className="flex justify-between py-1"><span className="text-muted-foreground">XP</span><span className="text-emerald-400">{user.xp}</span></div>
                  <div className="flex justify-between py-1"><span className="text-muted-foreground">金币</span><span className="text-amber-400">{user.gold} G</span></div>
                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground">公会</span>
                    <span className="text-foreground">{user.guildName ? `${user.guildName} (${user.memberCount}人)` : "未加入"}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground pt-2 border-t border-border mt-2">用户名是唯一凭证，不可修改</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <input type="password" value={oldPw} onChange={e => setOldPw(e.target.value)}
                    placeholder="当前密码" className="w-full px-3 py-2 bg-muted/50 border border-border rounded-md text-sm" />
                  <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)}
                    placeholder="新密码（至少4位）" className="w-full px-3 py-2 bg-muted/50 border border-border rounded-md text-sm" />
                  {pwError && <p className="text-xs text-red-400">{pwError}</p>}
                  {pwSuccess && <p className="text-xs text-emerald-400">{pwSuccess}</p>}
                  <Button onClick={changePassword} className="w-full">修改密码</Button>
                </div>
              )}
            </div>

            <div className="px-4 py-3 border-t border-border">
              <button onClick={() => setOpen(false)} className="w-full text-xs text-muted-foreground hover:text-foreground">关闭</button>
            </div>
          </motion.div>
        </div>
      )}
    </>
  );
}
