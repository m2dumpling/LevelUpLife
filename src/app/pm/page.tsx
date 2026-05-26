"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { Send, ArrowLeft, Users, Menu, X, Reply, XCircle, Gift, Coins, MessageCircle, Hash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatBeijingTime } from "@/lib/date-utils";

interface Friend { id: number; username: string; name: string; level: number; note?: string | null; }
interface ChatMessage { id: number; userId: number; message: string; createdAt: string; }

function formatStamp(iso: string): string { return formatBeijingTime(iso); }

const COLORS = ["#f87171","#fb923c","#fbbf24","#a3e635","#34d399","#22d3ee","#60a5fa","#a78bfa","#f472b6"];
function userColor(name: string): string { let h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0; return COLORS[Math.abs(h) % COLORS.length]; }
function truncate(s: string, len: number): string { return s.length > len ? s.slice(0, len) + "..." : s; }

export default function PmPage() {
  const router = useRouter();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [activeFriend, setActiveFriend] = useState<Friend | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reply
  const [replyTarget, setReplyTarget] = useState<ChatMessage | null>(null);
  // Right-click menu
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; msg: ChatMessage } | null>(null);

  // Gift
  const [giftOpen, setGiftOpen] = useState(false);
  const [giftType, setGiftType] = useState<"gold" | "ore">("gold");
  const [giftAmount, setGiftAmount] = useState("10");
  const [giftOre, setGiftOre] = useState("ore_copper");
  const [giftMsg, setGiftMsg] = useState("");

  // Load
  const loadFriends = useCallback(async () => {
    const r = await fetch("/api/friend");
    if (r.ok) setFriends(await r.json());
  }, []);

  const loadMessages = useCallback(async (friendId: number) => {
    const r = await fetch(`/api/friend?action=messages&friendId=${friendId}`);
    if (r.ok) {
      const msgs: ChatMessage[] = await r.json();
      setMessages(msgs);
      if (msgs.length > 0) {
        const lastSeen: Record<string, string> = {};
        try {
          const raw = localStorage.getItem("last_friend_msg_ids") || "";
          for (const part of raw.split(",")) { const [f, m] = part.split(":"); if (f && m) lastSeen[f] = m; }
        } catch {}
        lastSeen[String(friendId)] = String(msgs[msgs.length - 1].id);
        localStorage.setItem("last_friend_msg_ids", Object.entries(lastSeen).map(([f, m]) => `${f}:${m}`).join(","));
      }
    }
  }, []);

  useEffect(() => {
    fetch("/api/user").then(r => r.json()).then(u => setCurrentUserId(u.id)).catch(() => {});
    (async () => {
      const list = await (await fetch("/api/friend")).json();
      setFriends(list);
      const params = new URLSearchParams(window.location.search);
      const fid = parseInt(params.get("friend") || "0");
      if (fid) { const f = list.find((fr: Friend) => fr.id === fid); if (f) selectFriend(f); }
    })();
  }, []);

  // Poll messages when active friend selected
  useEffect(() => {
    if (!activeFriend) return;
    const POLL = 2000;
    loadMessages(activeFriend.id);
    const iv = setInterval(() => loadMessages(activeFriend.id), POLL);
    return () => clearInterval(iv);
  }, [activeFriend, loadMessages]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const selectFriend = (f: Friend) => { setActiveFriend(f); setSidebarOpen(false); loadMessages(f.id); };

  const send = async () => {
    if (!input.trim() || !activeFriend || sending) return;
    setSending(true);
    const body: Record<string, unknown> = { action: "send", friendId: activeFriend.id, message: input.trim() };
    if (replyTarget) { body.replyTo = replyTarget.id; body.replyPreview = replyTarget.message.slice(0, 40); }
    await fetch("/api/friend", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setInput(""); setSending(false); setReplyTarget(null); loadMessages(activeFriend.id); inputRef.current?.focus();
  };

  const doGift = async () => {
    if (!activeFriend) return;
    const value = giftType === "gold" ? giftAmount : giftOre;
    const res = await fetch("/api/guild/gift", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ toUserId: activeFriend.id, giftType, giftValue: value }) });
    const data = await res.json();
    setGiftMsg(data.success ? data.message : (data.error || "送礼失败"));
    if (data.success) { window.dispatchEvent(new Event("stats-changed")); window.dispatchEvent(new Event("inventory-changed")); setTimeout(() => { setGiftOpen(false); setGiftMsg(""); }, 1500); }
  };

  const handleContextMenu = (e: React.MouseEvent, msg: ChatMessage) => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, msg }); };
  const handleReply = (msg: ChatMessage) => { setReplyTarget(msg); setCtxMenu(null); inputRef.current?.focus(); };
  useEffect(() => { if (!ctxMenu) return; const close = () => setCtxMenu(null); window.addEventListener("click", close); return () => window.removeEventListener("click", close); }, [ctxMenu]);

  const sidebarContent = (
    <>
      <div className="flex items-center justify-between px-4 py-3 border-b border-border h-12">
        <h2 className="text-sm font-bold text-foreground flex items-center gap-2"><MessageCircle className="w-4 h-4 text-emerald-400" />私聊</h2>
        <button onClick={() => setSidebarOpen(false)} className="md:hidden text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
      </div>
      <div className="flex-1 overflow-auto py-2">
        <div className="px-4 py-1.5"><span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">好友 — {friends.length}</span></div>
        <div className="px-2 space-y-0.5">
          {friends.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">暂无好友</p>
          ) : (
            friends.map(f => (
              <button key={f.id} onClick={() => selectFriend(f)}
                className={`w-full text-left px-2 py-1.5 rounded-md text-sm transition-colors flex items-center gap-2 ${activeFriend?.id === f.id ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted/50 text-muted-foreground"}`}>
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0" style={{ backgroundColor: userColor(f.name || f.username) }}>{(f.name || f.username)[0]}</div>
                <span className="truncate">{f.name || f.username}{f.note && <span className="text-[10px] text-muted-foreground ml-1">({f.note})</span>}</span>
              </button>
            ))
          )}
        </div>
      </div>
      <div className="p-3 border-t border-border">
        <Button variant="ghost" size="sm" onClick={() => router.push("/")} className="w-full justify-start text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />返回主页
        </Button>
      </div>
    </>
  );

  const renderMessages = () => {
    if (messages.length === 0) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center px-4">
            <Hash className="w-12 h-12 mx-auto text-muted-foreground/20 mb-3" />
            <p className="text-muted-foreground font-medium">开始和 {activeFriend?.name || activeFriend?.username} 聊天吧</p>
            <p className="text-xs text-muted-foreground/60 mt-1">右键消息可回复</p>
          </div>
        </div>
      );
    }
    return messages.map((msg, i) => {
      const prevMsg = i > 0 ? messages[i - 1] : null;
      const showHeader = !prevMsg || prevMsg.userId !== msg.userId;
      const isMine = msg.userId === currentUserId;
      const senderName = isMine ? "我" : (activeFriend?.name || activeFriend?.username || "好友");
      return (
        <div key={msg.id}
          onContextMenu={(e) => handleContextMenu(e, msg)}
          className={`${showHeader ? "mt-3" : "mt-0"} group transition-colors cursor-default ${isMine ? "flex flex-col items-end" : "hover:bg-muted/30 rounded px-2 py-0.5"}`}>
          {isMine ? (
            <div className="flex items-center gap-2 justify-end mb-0.5">
              <span className="text-[10px] text-muted-foreground/50 tabular-nums">{formatStamp(msg.createdAt)}</span>
              <span className="text-sm font-semibold text-primary/80">我</span>
            </div>
          ) : showHeader ? (
            <div className="flex items-baseline gap-2 mb-0.5">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0" style={{ backgroundColor: userColor(senderName) }}>{senderName[0]}</div>
              <span className="text-sm font-semibold" style={{ color: userColor(senderName) }}>{senderName}</span>
              <span className="text-[10px] text-muted-foreground/50 tabular-nums">{formatStamp(msg.createdAt)}</span>
            </div>
          ) : (
            <div className="flex">
              <span className="w-7 shrink-0" />
              <span className="text-[10px] text-muted-foreground/30 tabular-nums opacity-0 group-hover:opacity-100 transition-opacity mr-1.5">{formatStamp(msg.createdAt)}</span>
            </div>
          )}
          <div className={`text-sm leading-relaxed break-words whitespace-pre-wrap px-3 py-1.5 rounded-2xl max-w-[75%] ${isMine ? "bg-primary/20 text-foreground mr-0" : "ml-9 text-foreground/90"}`}>
            {!isMine && msg.message.startsWith("[回复] ") ? (
              <>
                <span className="text-[11px] text-primary/60 block">{msg.message.split("\n")[0]}</span>
                <span>{msg.message.split("\n").slice(1).join("\n")}</span>
              </>
            ) : msg.message}
          </div>
        </div>
      );
    });
  };

  if (!activeFriend) {
    return (
      <div className="flex h-dvh bg-background overflow-hidden">
        <aside className="hidden md:flex w-60 shrink-0 bg-muted/20 border-r border-border flex-col">{sidebarContent}</aside>
        {sidebarOpen && (
          <div className="md:hidden fixed inset-0 z-40">
            <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
            <aside className="absolute left-0 top-0 h-full w-72 bg-background border-r border-border flex flex-col shadow-2xl z-50">{sidebarContent}</aside>
          </div>
        )}
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-2">
            <MessageCircle className="w-12 h-12 mx-auto text-muted-foreground/20" />
            <p className="text-muted-foreground">选择一个好友开始私聊</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-dvh bg-background overflow-hidden" onContextMenu={(e) => e.preventDefault()}>
      <aside className="hidden md:flex w-60 shrink-0 bg-muted/20 border-r border-border flex-col">{sidebarContent}</aside>
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-72 bg-background border-r border-border flex flex-col shadow-2xl z-50">{sidebarContent}</aside>
        </div>
      )}

      <main className="flex-1 flex flex-col min-w-0">
        <div className="h-12 shrink-0 border-b border-border flex items-center px-3 md:px-4 gap-2">
          <button onClick={() => setSidebarOpen(true)} className="md:hidden text-muted-foreground hover:text-foreground -ml-1 p-1"><Menu className="w-5 h-5" /></button>
          <Hash className="w-5 h-5 text-muted-foreground" />
          <span className="font-semibold text-foreground truncate">{activeFriend.name || activeFriend.username}</span>
          <span className="text-xs text-muted-foreground ml-auto">Lv.{activeFriend.level}</span>
          <button onClick={() => setGiftOpen(true)} className="p-1 hover:bg-accent rounded text-amber-400" title="送礼物"><Gift className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 md:px-4 py-2 overscroll-contain" style={{ WebkitOverflowScrolling: "touch" }}>
          {renderMessages()}
          <div ref={chatEndRef} />
        </div>

        {replyTarget && (
          <div className="shrink-0 px-3 py-2 bg-muted/30 border-t border-border flex items-center gap-2">
            <Reply className="w-4 h-4 text-primary/60 shrink-0" />
            <span className="text-xs text-muted-foreground flex-1 truncate">
              回复: {truncate(replyTarget.message, 40)}
            </span>
            <button onClick={() => setReplyTarget(null)} className="text-muted-foreground hover:text-foreground"><XCircle className="w-4 h-4" /></button>
          </div>
        )}

        <div className="shrink-0 px-2 md:px-4 py-2 md:py-3 border-t border-border bg-muted/10">
          <div className="flex gap-2 items-end max-w-3xl mx-auto">
            <input ref={inputRef} type="text"
              placeholder="发送消息..."
              value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              maxLength={500}
              style={{ fontSize: "16px" }}
              className="flex-1 bg-card border border-border rounded-lg px-3 py-2.5 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-colors" />
            <Button onClick={send} disabled={!input.trim() || sending} size="sm" className="shrink-0"><Send className="w-4 h-4" /></Button>
          </div>
        </div>
      </main>

      {/* Gift dialog */}
      {giftOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setGiftOpen(false)}>
          <div onClick={e => e.stopPropagation()} className="bg-card border border-border rounded-xl p-5 w-[calc(100%-2rem)] max-w-xs space-y-3">
            <h3 className="font-bold text-foreground flex items-center gap-2"><Gift className="w-4 h-4 text-amber-400" />送礼给 {activeFriend?.username}</h3>
            <div className="flex gap-2">
              <button onClick={() => setGiftType("gold")} className={`flex-1 py-2 rounded-lg text-sm font-bold ${giftType === "gold" ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" : "bg-muted/50 text-muted-foreground"}`}><Coins className="w-4 h-4 mx-auto mb-0.5" />金币</button>
              <button onClick={() => setGiftType("ore")} className={`flex-1 py-2 rounded-lg text-sm font-bold ${giftType === "ore" ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" : "bg-muted/50 text-muted-foreground"}`}>🪨矿石</button>
            </div>
            {giftType === "gold" ? (
              <input type="number" value={giftAmount} onChange={e => setGiftAmount(e.target.value)} min="1" className="w-full px-3 py-1.5 bg-muted/50 border border-border rounded-md text-sm text-center" />
            ) : (
              <select value={giftOre} onChange={e => setGiftOre(e.target.value)} className="w-full px-3 py-1.5 bg-muted/50 border border-border rounded-md text-sm">
                <option value="ore_copper">🪨 铜矿石</option><option value="ore_iron">⛏️ 铁矿石</option><option value="ore_gold">✨ 金矿石</option><option value="ore_mithril">💎 秘银矿石</option><option value="ore_adamantite">🔮 精金矿石</option>
              </select>
            )}
            {giftMsg && (
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300 }}
                className="text-sm text-emerald-400 text-center bg-emerald-500/10 rounded-lg py-2 px-3">
                {giftMsg} 🎉
              </motion.div>
            )}
            <Button onClick={doGift} className="w-full">送出礼物</Button>
          </div>
        </div>
      )}

      {/* Right-click menu */}
      {ctxMenu && (
        <div className="fixed z-50 bg-popover border border-border rounded-lg shadow-xl py-1 min-w-[120px]" style={{ left: ctxMenu.x, top: ctxMenu.y }}>
          <button onClick={() => handleReply(ctxMenu.msg)} className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-foreground hover:bg-muted transition-colors text-left">
            <Reply className="w-4 h-4" />回复
          </button>
        </div>
      )}
    </div>
  );
}
