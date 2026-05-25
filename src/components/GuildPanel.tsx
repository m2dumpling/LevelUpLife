"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Shield,
  Users,
  MessageSquare,
  Copy,
  Check,
  Send,
  Crown,
  LogOut,
  UserX,
  X,
  Swords,
} from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/* ── 类型 ── */

interface GuildData {
  guild: {
    id: number;
    name: string;
    motto: string;
    inviteCode: string;
    leaderId: number;
    hp: number;
    maxHp: number;
    createdAt: string;
  };
  members: {
    id: number;
    userId: number;
    username: string;
    joinedAt: string;
  }[];
  isLeader: boolean;
  leaderboardRank: number | null;
}

interface ChatMessage {
  id: number;
  userId: number;
  username: string;
  message: string;
  createdAt: string;
}

/* ── 工具 ── */

function formatTime(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

/* ── 组件 ── */

export function GuildPanel({ onClose }: { onClose: () => void }) {
  // 公会数据
  const [guildData, setGuildData] = useState<GuildData | null>(null);
  const [loading, setLoading] = useState(true);

  // 创建 / 加入表单
  const [createName, setCreateName] = useState("");
  const [createMotto, setCreateMotto] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // Tab
  const [tab, setTab] = useState<"members" | "chat">("chat");

  // 聊天
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatMsg, setChatMsg] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  /* ── 数据获取 ── */

  const fetchGuild = useCallback(async () => {
    try {
      const res = await fetch("/api/guild");
      const data = await res.json();
      setGuildData(data.guild ? data : null);
    } catch {
      setGuildData(null);
    }
    setLoading(false);
  }, []);

  const fetchChat = useCallback(async () => {
    try {
      const res = await fetch("/api/guild/chat");
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch {
      // 静默
    }
  }, []);

  useEffect(() => {
    fetchGuild();
  }, [fetchGuild]);

  // 进入公会后拉取聊天 + 定时刷新
  useEffect(() => {
    if (!guildData?.guild) return;
    fetchChat();
    const iv = setInterval(fetchChat, 5000);
    return () => clearInterval(iv);
  }, [guildData?.guild, fetchChat]);

  // 聊天滚动
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* ── 操作 ── */

  const doCreate = async () => {
    if (!createName.trim()) return;
    setError("");
    setActionLoading(true);
    try {
      const res = await fetch("/api/guild", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          name: createName.trim(),
          motto: createMotto.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "创建失败");
      } else {
        // 刷新数据 — 触发 window 事件通知 GuildButton
        window.dispatchEvent(new Event("guild-changed"));
        await fetchGuild();
        setCreateName("");
        setCreateMotto("");
      }
    } catch {
      setError("网络错误");
    }
    setActionLoading(false);
  };

  const doJoin = async () => {
    if (!joinCode.trim()) return;
    setError("");
    setActionLoading(true);
    try {
      const res = await fetch("/api/guild", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "join", inviteCode: joinCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "加入失败");
      } else {
        window.dispatchEvent(new Event("guild-changed"));
        await fetchGuild();
        setJoinCode("");
      }
    } catch {
      setError("网络错误");
    }
    setActionLoading(false);
  };

  const doLeave = async () => {
    setError("");
    setActionLoading(true);
    try {
      const res = await fetch("/api/guild", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "leave" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "退出失败");
      } else {
        window.dispatchEvent(new Event("guild-changed"));
        setGuildData(null);
        setMessages([]);
      }
    } catch {
      setError("网络错误");
    }
    setActionLoading(false);
  };

  const doKick = async (targetUserId: number) => {
    setError("");
    try {
      const res = await fetch("/api/guild", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "kick", targetUserId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "踢人失败");
      } else {
        window.dispatchEvent(new Event("guild-changed"));
        await fetchGuild();
      }
    } catch {
      setError("网络错误");
    }
  };

  const doSend = async () => {
    if (!chatMsg.trim()) return;
    setError("");
    try {
      const res = await fetch("/api/guild/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: chatMsg.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "发送失败");
      } else {
        setChatMsg("");
        await fetchChat();
      }
    } catch {
      setError("网络错误");
    }
  };

  const copyCode = async () => {
    if (!guildData?.guild) return;
    try {
      await navigator.clipboard.writeText(guildData.guild.inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 不支持
    }
  };

  /* ── 渲染 ── */

  if (loading) {
    return (
      <div className="p-5 space-y-3">
        <div className="h-5 bg-muted animate-pulse rounded w-1/3" />
        <div className="h-4 bg-muted animate-pulse rounded w-2/3" />
        <div className="h-32 bg-muted animate-pulse rounded" />
      </div>
    );
  }

  return (
    <div className="flex flex-col max-h-[82vh]">
      {/* 顶栏 */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-amber-400" />
          <span className="font-bold text-foreground text-base">公会大厅</span>
        </div>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="px-5 pt-3 shrink-0">
          <div className="bg-destructive/10 text-destructive text-xs rounded-md px-3 py-2">
            {error}
          </div>
        </div>
      )}

      {/* ── 无公会状态 ── */}
      {!guildData?.guild && (
        <div className="flex-1 overflow-auto px-5 py-4 space-y-5">
          {/* 创建公会 */}
          <div className="bg-card rounded-xl border border-border p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Swords className="w-4 h-4 text-amber-400" />
              <span>创建公会</span>
            </div>
            <Input
              placeholder="公会名称（最多 20 字）"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && doCreate()}
              maxLength={20}
            />
            <Input
              placeholder="公会宣言（选填，最多 60 字）"
              value={createMotto}
              onChange={(e) => setCreateMotto(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && doCreate()}
              maxLength={60}
            />
            <Button
              onClick={doCreate}
              disabled={actionLoading || !createName.trim()}
              className="w-full"
            >
              {actionLoading ? "创建中..." : "创建公会 · 50G"}
            </Button>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">或</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* 加入公会 */}
          <div className="bg-card rounded-xl border border-border p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Users className="w-4 h-4 text-emerald-400" />
              <span>加入公会</span>
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="输入 6 位邀请码"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && doJoin()}
                maxLength={6}
                className="flex-1 uppercase"
              />
              <Button
                onClick={doJoin}
                disabled={actionLoading || joinCode.trim().length < 3}
                variant="outline"
              >
                {actionLoading ? "加入..." : "加入"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── 已加入公会 ── */}
      {guildData?.guild && (
        <>
          {/* 公会信息头 */}
          <div className="px-5 py-3 border-b border-border shrink-0 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-foreground">
                  {guildData.guild.name}
                </span>
                {guildData.leaderboardRank && (
                  <span className="text-[10px] bg-amber-400/10 text-amber-400 px-1.5 py-0.5 rounded font-semibold">
                    #{guildData.leaderboardRank}
                  </span>
                )}
              </div>

              {/* 邀请码 + 复制 */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-muted-foreground font-mono bg-muted px-2 py-0.5 rounded">
                  {guildData.guild.inviteCode}
                </span>
                <button
                  onClick={copyCode}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  title="复制邀请码"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>

            {/* 宣言 */}
            {guildData.guild.motto && (
              <p className="text-xs text-muted-foreground italic">
                &ldquo;{guildData.guild.motto}&rdquo;
              </p>
            )}

            {/* HP 条 */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground w-6">HP</span>
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{
                    width: `${Math.max(
                      0,
                      Math.round(
                        (guildData.guild.hp / guildData.guild.maxHp) * 100
                      )
                    )}%`,
                  }}
                  className="h-full rounded-full bg-red-400"
                />
              </div>
              <span className="text-[10px] text-muted-foreground tabular-nums">
                {guildData.guild.hp}/{guildData.guild.maxHp}
              </span>
            </div>
          </div>

          {/* Tab 切换 */}
          <div className="flex gap-1 px-5 py-2 bg-muted/30 border-b border-border shrink-0">
            {(["chat", "members"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`relative px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  tab === t
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab === t && (
                  <motion.div
                    layoutId="guildTab"
                    className="absolute inset-0 bg-card rounded-md border border-border"
                    transition={{ duration: 0.15 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-1.5">
                  {t === "chat" ? (
                    <MessageSquare className="w-3 h-3" />
                  ) : (
                    <Users className="w-3 h-3" />
                  )}
                  {t === "chat" ? "聊天" : `成员 (${guildData.members.length})`}
                </span>
              </button>
            ))}
          </div>

          {/* ── 成员列表 Tab ── */}
          {tab === "members" && (
            <div className="flex-1 overflow-auto px-5 py-3 space-y-1">
              {guildData.members.map((m) => (
                <div
                  key={m.userId}
                  className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {m.userId === guildData.guild.leaderId && (
                      <Crown className="w-3.5 h-3.5 text-amber-400" />
                    )}
                    <span className="text-sm text-foreground">
                      {m.username}
                    </span>
                    {m.userId === guildData.guild.leaderId && (
                      <span className="text-[10px] bg-amber-400/10 text-amber-400 px-1.5 py-0.5 rounded font-medium">
                        会长
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-muted-foreground">
                      加入于 {m.joinedAt.slice(0, 10)}
                    </span>
                    {/* 会长踢人按钮 */}
                    {guildData.isLeader &&
                      m.userId !== guildData.guild.leaderId && (
                        <button
                          onClick={() => doKick(m.userId)}
                          className="text-muted-foreground hover:text-destructive transition-colors"
                          title="踢出公会"
                        >
                          <UserX className="w-3.5 h-3.5" />
                        </button>
                      )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── 聊天 Tab ── */}
          {tab === "chat" && (
            <>
              <div className="flex-1 overflow-auto px-4 py-3 space-y-1 min-h-0">
                {messages.length === 0 && (
                  <div className="text-center py-10 text-muted-foreground text-sm">
                    <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p>暂无消息</p>
                    <p className="text-xs mt-1">发送第一条消息开始聊天吧</p>
                  </div>
                )}
                {messages.map((msg) => (
                  <div key={msg.id} className="py-1">
                    <span className="text-[10px] text-muted-foreground/60 mr-1.5 tabular-nums">
                      {formatTime(msg.createdAt)}
                    </span>
                    <span className="text-xs font-semibold text-foreground/80 mr-1">
                      {msg.username}
                    </span>
                    <span className="text-xs text-foreground break-words">
                      {msg.message}
                    </span>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>

              {/* 输入区 */}
              <div className="shrink-0 px-4 py-3 border-t border-border bg-muted/20">
                <div className="flex gap-2">
                  <Input
                    placeholder="输入消息..."
                    value={chatMsg}
                    onChange={(e) => setChatMsg(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && doSend()}
                    maxLength={500}
                    className="flex-1"
                  />
                  <Button
                    onClick={doSend}
                    disabled={!chatMsg.trim()}
                    size="sm"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </>
          )}

          {/* 底部操作 */}
          <div className="shrink-0 px-5 py-3 border-t border-border flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">
              {guildData.isLeader ? "你是会长" : "成员"}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={doLeave}
              disabled={actionLoading}
              className="text-muted-foreground hover:text-destructive"
            >
              <LogOut className="w-3.5 h-3.5 mr-1" />
              {guildData.isLeader && guildData.members.length > 1
                ? "退出并转让"
                : "退出公会"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
