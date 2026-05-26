"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Shield, Hash, Send, ArrowLeft, Users, Copy, Check, Crown, LogOut, Menu, X, Reply, XCircle, Gift, UserPlus, Coins,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatBeijingTime } from "@/lib/date-utils";

/* ── 类型 ── */
interface GuildInfo {
  guild: { id: number; name: string; motto: string; inviteCode: string; leaderId: number; hp: number; maxHp: number };
  members: { id: number; userId: number; username: string; joinedAt: string }[];
  isLeader: boolean;
}
interface ChatMessage {
  id: number; userId: number; username: string; message: string; createdAt: string;
  replyTo?: number | null; replyUsername?: string | null; replyPreview?: string | null;
}

function formatStamp(iso: string): string { return formatBeijingTime(iso); }

const COLORS = ["#f87171","#fb923c","#fbbf24","#a3e635","#34d399","#22d3ee","#60a5fa","#a78bfa","#f472b6"];
function userColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return COLORS[Math.abs(h) % COLORS.length];
}

/* ── 工具：截断文本 ── */
function truncate(s: string, len: number): string {
  return s.length > len ? s.slice(0, len) + "..." : s;
}

/* ── 组件 ── */
export default function ChatPage() {
  const router = useRouter();
  const [guild, setGuild] = useState<GuildInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // 回复
  const [replyTarget, setReplyTarget] = useState<ChatMessage | null>(null);

  // 右键菜单
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; msg: ChatMessage } | null>(null);

  // 通知：被回复的消息 ID 集合
  const [myUserId, setMyUserId] = useState<number | null>(null);
  const [notifiedIds, setNotifiedIds] = useState<Set<number>>(new Set());

  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 送礼
  const [giftTarget, setGiftTarget] = useState<{ userId: number; username: string } | null>(null);
  const [giftType, setGiftType] = useState<"gold" | "ore">("gold");
  const [giftAmount, setGiftAmount] = useState("10");
  const [giftOre, setGiftOre] = useState("ore_copper");
  const [giftMsg, setGiftMsg] = useState("");

  const handleGift = (userId: number, username: string) => { setGiftTarget({ userId, username }); setGiftMsg(""); };
  const handleAddFriend = async (friendId: number) => {
    await fetch("/api/friend", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "request", friendId }) });
  };
  const doGift = async () => {
    if (!giftTarget) return;
    const value = giftType === "gold" ? giftAmount : giftOre;
    const res = await fetch("/api/guild/gift", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ toUserId: giftTarget.userId, giftType, giftValue: value }) });
    const data = await res.json();
    setGiftMsg(data.success ? data.message : (data.error || "送礼失败"));
    if (data.success) { window.dispatchEvent(new Event("stats-changed")); window.dispatchEvent(new Event("inventory-changed")); setTimeout(() => { setGiftTarget(null); setGiftMsg(""); }, 1500); }
  };

  /* ── 数据 ── */
  const fetchGuild = useCallback(async () => {
    const r = await fetch("/api/guild");
    if (r.ok) { const d = await r.json(); setGuild(d.guild ? d : null); }
    else setGuild(null);
    setLoading(false);
  }, []);

  const fetchChat = useCallback(async () => {
    const r = await fetch("/api/guild/chat");
    if (r.ok) {
      const msgs = (await r.json()).messages || [];
      setMessages(msgs);
      if (msgs.length > 0) localStorage.setItem("last_guild_msg_id", String(msgs[msgs.length - 1].id));
    }
  }, []);

  useEffect(() => { fetchGuild(); }, [fetchGuild]);
  useEffect(() => {
    fetch("/api/user").then(r => r.json()).then(u => setMyUserId(u.id)).catch(() => {});
  }, []);

  // 动态轮询
  useEffect(() => {
    if (!guild?.guild) return;
    const POLL_ACTIVE = 2000;
    const POLL_INACTIVE = 5000;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const poll = () => { fetchChat(); timer = setTimeout(poll, active ? POLL_ACTIVE : POLL_INACTIVE); };
    const onActive = () => { active = true; };
    const onInactive = () => { active = false; };
    document.addEventListener("visibilitychange", () => { active = !document.hidden; });
    window.addEventListener("focus", onActive);
    window.addEventListener("blur", onInactive);
    fetchChat();
    timer = setTimeout(poll, POLL_ACTIVE);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", onActive);
      window.removeEventListener("blur", onInactive);
    };
  }, [guild?.guild, fetchChat]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // 通知检测：新消息中如果有回复当前用户的，高亮
  useEffect(() => {
    if (!myUserId) return;
    const newReplies = messages.filter(m => m.replyTo && m.userId !== myUserId && !notifiedIds.has(m.id));
    if (newReplies.length > 0) {
      setNotifiedIds(prev => { const s = new Set(prev); newReplies.forEach(m => s.add(m.id)); return s; });
    }
  }, [messages, myUserId, notifiedIds]);

  /* ── 操作 ── */
  const send = async () => {
    if (!input.trim() || sending) return;
    setSending(true);
    const body: Record<string, unknown> = { message: input.trim() };
    if (replyTarget) body.replyTo = replyTarget.id;
    await fetch("/api/guild/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setInput("");
    setReplyTarget(null);
    setSending(false);
    await fetchChat();
    inputRef.current?.focus();
  };

  const copyCode = async () => {
    if (!guild?.guild) return;
    await navigator.clipboard.writeText(guild.guild.inviteCode);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  const doLeave = async () => {
    if (!confirm("确定要退出公会吗？")) return;
    await fetch("/api/guild", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "leave" }),
    });
    window.dispatchEvent(new Event("guild-changed"));
    router.push("/");
  };

  // 右键处理
  const handleContextMenu = (e: React.MouseEvent, msg: ChatMessage) => {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY, msg });
  };

  const handleReply = (msg: ChatMessage) => {
    setReplyTarget(msg);
    setCtxMenu(null);
    inputRef.current?.focus();
  };

  // 关闭右键菜单
  useEffect(() => {
    if (!ctxMenu) return;
    const close = () => setCtxMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [ctxMenu]);

  /* ── 辅助 ── */
  const sidebarContent = guild && (
    <>
      <div className="px-4 py-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <Shield className="w-5 h-5 text-amber-400 shrink-0" />
            <span className="font-bold text-foreground truncate">{guild.guild.name}</span>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="md:hidden text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>
        {guild.guild.motto && (
          <p className="text-[11px] text-muted-foreground italic mb-3">&ldquo;{guild.guild.motto}&rdquo;</p>
        )}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[10px] text-muted-foreground">HP</span>
          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-red-400 transition-all"
              style={{ width: `${Math.max(0, Math.round((guild.guild.hp / guild.guild.maxHp) * 100))}%` }} />
          </div>
          <span className="text-[10px] text-muted-foreground tabular-nums">{guild.guild.hp}/{guild.guild.maxHp}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground font-mono bg-muted px-2 py-0.5 rounded flex-1 text-center">{guild.guild.inviteCode}</span>
          <button onClick={copyCode} className="text-muted-foreground hover:text-foreground shrink-0" title="复制">
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto py-2">
        <div className="px-4 py-1.5"><span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">频道</span></div>
        <div className="px-2">
          <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-primary/10 text-primary text-sm font-medium">
            <Hash className="w-4 h-4" />公会大厅
          </div>
        </div>
        <div className="px-4 py-2 mt-2"><span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">成员 — {guild.members.length}</span></div>
        <div className="px-2 space-y-0.5">
          {guild.members.map((m) => (
            <div key={m.userId} className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-muted/50 transition-colors">
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0" style={{ backgroundColor: userColor(m.username) }}>{m.username[0]}</div>
              <span className="text-sm text-foreground truncate">{m.username}</span>
              {m.userId !== myUserId && (
                <div className="flex items-center gap-1 ml-auto">
                  <button onClick={() => handleGift(m.userId, m.username)} className="p-1 hover:bg-accent rounded text-amber-400" title="送礼物"><Gift className="w-4 h-4" /></button>
                  <button onClick={() => handleAddFriend(m.userId)} className="p-1 hover:bg-accent rounded text-emerald-400" title="加好友"><UserPlus className="w-4 h-4" /></button>
                </div>
              )}
              {m.userId === guild.guild.leaderId && <Crown className="w-3 h-3 text-amber-400 shrink-0" />}
            </div>
          ))}
        </div>
      </div>
      <div className="p-3 border-t border-border space-y-2">
        <Button variant="ghost" size="sm" onClick={() => { setSidebarOpen(false); router.push("/"); }} className="w-full justify-start text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />返回主页
        </Button>
        <Button variant="ghost" size="sm" onClick={doLeave} className="w-full justify-start text-destructive/60 hover:text-destructive hover:bg-destructive/10">
          <LogOut className="w-3.5 h-3.5 mr-1.5" />退出公会
        </Button>
      </div>
    </>
  );

  if (loading) {
    return (
      <div className="flex h-dvh bg-background items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!guild?.guild) {
    return (
      <div className="flex h-dvh bg-background items-center justify-center">
        <div className="text-center space-y-4">
          <Shield className="w-12 h-12 mx-auto text-muted-foreground/30" />
          <p className="text-muted-foreground">你还没有加入公会</p>
          <Button onClick={() => router.push("/")}><ArrowLeft className="w-4 h-4 mr-1.5" />返回主页</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-dvh bg-background overflow-hidden" onContextMenu={(e) => e.preventDefault()}>
      {/* ── 桌面端侧边栏 ── */}
      <aside className="hidden md:flex w-60 shrink-0 bg-muted/20 border-r border-border flex-col">
        {sidebarContent}
      </aside>

      {/* ── 移动端侧边栏 ── */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-72 bg-background border-r border-border flex flex-col shadow-2xl z-50">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* ══ 聊天主区域 ══ */}
      <main className="flex-1 flex flex-col min-w-0">
        <div className="h-12 shrink-0 border-b border-border flex items-center px-3 md:px-4 gap-2">
          <button onClick={() => setSidebarOpen(true)} className="md:hidden text-muted-foreground hover:text-foreground -ml-1 p-1">
            <Menu className="w-5 h-5" />
          </button>
          <Hash className="w-5 h-5 text-muted-foreground" />
          <span className="font-semibold text-foreground truncate">公会大厅</span>
          <span className="text-xs text-muted-foreground ml-auto hidden sm:inline">{guild.members.length} 位冒险者</span>
        </div>

        {/* 消息列表 */}
        <div className="flex-1 overflow-y-auto px-2 md:px-4 py-2 overscroll-contain" style={{ WebkitOverflowScrolling: "touch" }}>
          {messages.length === 0 && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center px-4">
                <Hash className="w-12 h-12 mx-auto text-muted-foreground/20 mb-3" />
                <p className="text-muted-foreground font-medium">欢迎来到 {guild.guild.name}！</p>
                <p className="text-xs text-muted-foreground/60 mt-1">右键消息可回复</p>
              </div>
            </div>
          )}
          {messages.map((msg, i) => {
            const prevMsg = i > 0 ? messages[i - 1] : null;
            const showHeader = !prevMsg || prevMsg.userId !== msg.userId;
            const isReply = !!msg.replyTo;
            const isNotified = myUserId && msg.replyTo && notifiedIds.has(msg.id);

            const isMine = myUserId && msg.userId === myUserId;
            return (
              <div
                key={msg.id}
                onContextMenu={(e) => handleContextMenu(e, msg)}
                className={`${showHeader ? "mt-3" : "mt-0"} group transition-colors cursor-default ${
                  isNotified ? "bg-amber-500/10 border-l-2 border-amber-400" : ""
                } ${isMine ? "flex flex-col items-end" : "hover:bg-muted/30 rounded px-2 py-0.5"}`}
              >
                {/* 回复引用 */}
                {isReply && (
                  <div className={`mb-1 flex items-center gap-1.5 text-[11px] text-muted-foreground ${isMine ? "mr-0" : "ml-9"}`}>
                    <Reply className="w-3 h-3" />
                    <span className="text-primary/60">回复</span>
                    <span className="font-medium text-foreground/60">{msg.replyUsername}</span>
                    <span className="text-muted-foreground/40 truncate max-w-[120px] md:max-w-[200px]">{msg.replyPreview}</span>
                  </div>
                )}
                {isMine ? (
                  <div className="flex items-center gap-2 justify-end mb-0.5">
                    <span className="text-[10px] text-muted-foreground/50 tabular-nums">{formatStamp(msg.createdAt)}</span>
                    <span className="text-sm font-semibold text-primary/80">我</span>
                  </div>
                ) : showHeader ? (
                  <div className="flex items-baseline gap-2 mb-0.5">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0" style={{ backgroundColor: userColor(msg.username) }}>{msg.username[0]}</div>
                    <span className="text-sm font-semibold" style={{ color: userColor(msg.username) }}>{msg.username}</span>
                    <span className="text-[10px] text-muted-foreground/50 tabular-nums">{formatStamp(msg.createdAt)}</span>
                  </div>
                ) : (
                  <div className="flex">
                    <span className="w-7 shrink-0" />
                    <span className="text-[10px] text-muted-foreground/30 tabular-nums opacity-0 group-hover:opacity-100 transition-opacity mr-1.5">{formatStamp(msg.createdAt)}</span>
                  </div>
                )}
                <div className={`text-sm leading-relaxed break-words whitespace-pre-wrap px-3 py-1.5 rounded-2xl max-w-[75%] ${
                  isMine ? "bg-primary/20 text-foreground mr-0" : "ml-9 text-foreground/90"
                }`}>
                  {msg.message}
                </div>
              </div>
            );
          })}
          <div ref={chatEndRef} />
        </div>

        {/* ── 回复预览条 ── */}
        {replyTarget && (
          <div className="shrink-0 px-3 py-2 bg-muted/30 border-t border-border flex items-center gap-2">
            <Reply className="w-4 h-4 text-primary/60 shrink-0" />
            <span className="text-xs text-muted-foreground flex-1 truncate">
              回复 <span className="text-foreground font-medium">{replyTarget.username}</span>: {truncate(replyTarget.message, 40)}
            </span>
            <button onClick={() => setReplyTarget(null)} className="text-muted-foreground hover:text-foreground">
              <XCircle className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ── 输入区 ── */}
        <div className="shrink-0 px-2 md:px-4 py-2 md:py-3 border-t border-border bg-muted/10">
          <div className="flex gap-2 items-end max-w-3xl mx-auto">
            <input
              ref={inputRef}
              type="text"
              placeholder={replyTarget ? `回复 ${replyTarget.username}...` : "发送消息..."}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              maxLength={500}
              style={{ fontSize: "16px" }}
              className="flex-1 bg-card border border-border rounded-lg px-3 py-2.5 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-colors"
            />
            <Button onClick={send} disabled={!input.trim() || sending} size="sm" className="shrink-0">
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </main>

      {/* 送礼弹窗 */}
      {giftTarget && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60" onClick={() => setGiftTarget(null)}>
          <div onClick={e => e.stopPropagation()} className="bg-card border border-border rounded-xl p-5 w-[calc(100%-2rem)] max-w-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-foreground flex items-center gap-2"><Gift className="w-4 h-4 text-amber-400" />送礼给 {giftTarget.username}</h3>
              <button onClick={() => setGiftTarget(null)}><X className="w-4 h-4" /></button>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setGiftType("gold")} className={`flex-1 py-2 rounded-lg text-sm font-bold ${giftType === "gold" ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" : "bg-muted/50 text-muted-foreground"}`}>
                <Coins className="w-4 h-4 mx-auto mb-0.5" />金币</button>
              <button onClick={() => setGiftType("ore")} className={`flex-1 py-2 rounded-lg text-sm font-bold ${giftType === "ore" ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" : "bg-muted/50 text-muted-foreground"}`}>
                🪨 矿石</button>
            </div>
            {giftType === "gold" ? (
              <input type="number" value={giftAmount} onChange={e => setGiftAmount(e.target.value)} min="1"
                className="w-full px-3 py-1.5 bg-muted/50 border border-border rounded-md text-sm text-center" />
            ) : (
              <select value={giftOre} onChange={e => setGiftOre(e.target.value)} className="w-full px-3 py-1.5 bg-muted/50 border border-border rounded-md text-sm">
                <option value="ore_copper">🪨 铜矿石</option><option value="ore_iron">⛏️ 铁矿石</option>
                <option value="ore_gold">✨ 金矿石</option><option value="ore_mithril">💎 秘银矿石</option>
                <option value="ore_adamantite">🔮 精金矿石</option>
              </select>
            )}
            {giftMsg && <p className="text-xs text-emerald-400 text-center">{giftMsg}</p>}
            <Button onClick={doGift} className="w-full">送出礼物</Button>
          </div>
        </div>
      )}

      {/* ── 右键菜单 ── */}
      {ctxMenu && (
        <div
          className="fixed z-50 bg-popover border border-border rounded-lg shadow-xl py-1 min-w-[120px]"
          style={{ left: ctxMenu.x, top: ctxMenu.y }}
        >
          <button
            onClick={() => handleReply(ctxMenu.msg)}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-foreground hover:bg-muted transition-colors text-left"
          >
            <Reply className="w-4 h-4" />
            回复
          </button>
        </div>
      )}
    </div>
  );
}
