"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Send, Users, MessageCircle, Gift, Menu, X, Hash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatBeijingTime } from "@/lib/date-utils";

interface Friend { id: number; username: string; name: string; level: number; note?: string | null; }
interface ChatMsg { id: number; userId: number; friendId: number; message: string; createdAt: string; }

function formatStamp(iso: string): string { return formatBeijingTime(iso); }

const COLORS = ["#f87171","#fb923c","#fbbf24","#a3e635","#34d399","#22d3ee","#60a5fa","#a78bfa","#f472b6"];
function userColor(name: string): string { let h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0; return COLORS[Math.abs(h) % COLORS.length]; }

export default function PmPage() {
  const router = useRouter();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [activeFriend, setActiveFriend] = useState<Friend | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Gift
  const [giftOpen, setGiftOpen] = useState(false);
  const [giftType, setGiftType] = useState<"gold" | "ore">("gold");
  const [giftAmount, setGiftAmount] = useState("10");
  const [giftOre, setGiftOre] = useState("ore_copper");
  const [giftMsg, setGiftMsg] = useState("");

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

  const loadMessages = async (friendId: number) => {
    const res = await fetch(`/api/friend?action=messages&friendId=${friendId}`);
    if (res.ok) setMessages(await res.json());
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  const selectFriend = (f: Friend) => { setActiveFriend(f); setSidebarOpen(false); loadMessages(f.id); };

  const send = async () => {
    if (!input.trim() || !activeFriend || sending) return;
    setSending(true);
    await fetch("/api/friend", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "send", friendId: activeFriend.id, message: input.trim() }) });
    setInput(""); setSending(false); loadMessages(activeFriend.id);
  };

  const doGift = async () => {
    if (!activeFriend) return;
    const value = giftType === "gold" ? giftAmount : giftOre;
    const res = await fetch("/api/guild/gift", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ toUserId: activeFriend.id, giftType, giftValue: value }) });
    const data = await res.json();
    setGiftMsg(data.success ? data.message : (data.error || "送礼失败"));
    if (data.success) setTimeout(() => { setGiftOpen(false); setGiftMsg(""); }, 1500);
  };

  useEffect(() => { if (!activeFriend) return; const iv = setInterval(() => loadMessages(activeFriend.id), 3000); return () => clearInterval(iv); }, [activeFriend]);

  const sidebarContent = (
    <>
      <div className="flex items-center justify-between px-4 py-3 border-b border-border h-12">
        <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-emerald-400" /> 私聊
        </h2>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {friends.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">暂无好友</p>
        ) : (
          friends.map(f => (
            <button key={f.id} onClick={() => selectFriend(f)}
              className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center gap-2 ${activeFriend?.id === f.id ? "bg-accent text-foreground" : "hover:bg-accent/50 text-muted-foreground"}`}>
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0" style={{ backgroundColor: userColor(f.name || f.username) }}>{(f.name || f.username)[0]}</div>
              <span className="truncate">{f.name || f.username}{f.note && <span className="text-[10px] text-muted-foreground ml-1">({f.note})</span>}</span>
            </button>
          ))
        )}
      </div>
      <div className="p-3 border-t border-border">
        <Button variant="ghost" size="sm" onClick={() => router.push("/")} className="w-full justify-start text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />返回主页
        </Button>
      </div>
    </>
  );

  return (
    <div className="flex h-dvh bg-background overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 shrink-0 bg-muted/20 border-r border-border flex-col">{sidebarContent}</aside>

      {/* Mobile sidebar */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-72 bg-background border-r border-border flex flex-col shadow-2xl z-50">{sidebarContent}</aside>
        </div>
      )}

      {/* Main chat */}
      <main className="flex-1 flex flex-col min-w-0">
        {!activeFriend ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-2">
              <MessageCircle className="w-12 h-12 mx-auto text-muted-foreground/20" />
              <p className="text-muted-foreground">选择一个好友开始私聊</p>
            </div>
          </div>
        ) : (
          <>
            <div className="h-12 shrink-0 border-b border-border flex items-center px-3 md:px-4 gap-2">
              <button onClick={() => setSidebarOpen(true)} className="md:hidden text-muted-foreground hover:text-foreground -ml-1 p-1"><Menu className="w-5 h-5" /></button>
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0" style={{ backgroundColor: userColor(activeFriend.name || activeFriend.username) }}>{(activeFriend.name || activeFriend.username)[0]}</div>
              <span className="font-semibold text-foreground truncate">{activeFriend.name || activeFriend.username}</span>
              <span className="text-xs text-muted-foreground ml-auto">Lv.{activeFriend.level}</span>
              <button onClick={() => setGiftOpen(true)} className="p-1.5 hover:bg-accent rounded text-amber-400" title="送礼物"><Gift className="w-4 h-4" /></button>
            </div>

            <div className="flex-1 overflow-y-auto px-2 md:px-4 py-2 overscroll-contain">
              {messages.length === 0 && (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center px-4">
                    <Hash className="w-12 h-12 mx-auto text-muted-foreground/20 mb-3" />
                    <p className="text-muted-foreground font-medium">开始和 {activeFriend.name || activeFriend.username} 聊天吧</p>
                  </div>
                </div>
              )}
              {messages.map((msg, i) => {
                const prev = i > 0 ? messages[i - 1] : null;
                const showHeader = !prev || prev.userId !== msg.userId;
                const isMine = msg.userId === currentUserId;
                return (
                  <div key={msg.id} className="mb-0.5">
                    {showHeader && (
                      <div className="flex items-baseline gap-2 mt-3 mb-0.5">
                        <span className="text-sm font-semibold" style={{ color: userColor(isMine ? (activeFriend.name || activeFriend.username) : "self") }}>
                          {isMine ? "我" : (activeFriend.name || activeFriend.username)}
                        </span>
                        <span className="text-[10px] text-muted-foreground">{formatStamp(msg.createdAt)}</span>
                      </div>
                    )}
                    <div className="text-sm text-foreground/90 pl-0 ml-0" style={{ paddingLeft: showHeader ? 0 : 0 }}>{msg.message}</div>
                  </div>
                );
              })}
              <div ref={chatEndRef} />
            </div>

            <div className="flex gap-2 px-3 py-2 border-t border-border shrink-0">
              <input type="text" value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder="发送消息..." autoFocus
                className="flex-1 px-3 py-2 bg-muted/50 border border-border rounded-md text-sm focus:outline-none focus:border-primary/40" />
              <Button onClick={send} disabled={!input.trim() || sending} size="sm" className="shrink-0"><Send className="w-4 h-4" /></Button>
            </div>
          </>
        )}
      </main>

      {giftOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setGiftOpen(false)}>
          <div onClick={e => e.stopPropagation()} className="bg-card border border-border rounded-xl p-5 w-[calc(100%-2rem)] max-w-xs space-y-3">
            <h3 className="font-bold text-foreground flex items-center gap-2"><Gift className="w-4 h-4 text-amber-400" />送礼给 {activeFriend?.username}</h3>
            <div className="flex gap-2">
              <button onClick={() => setGiftType("gold")} className={`flex-1 py-2 rounded-lg text-sm font-bold ${giftType === "gold" ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" : "bg-muted/50 text-muted-foreground"}`}>💰金币</button>
              <button onClick={() => setGiftType("ore")} className={`flex-1 py-2 rounded-lg text-sm font-bold ${giftType === "ore" ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" : "bg-muted/50 text-muted-foreground"}`}>🪨矿石</button>
            </div>
            {giftType === "gold" ? (
              <input type="number" value={giftAmount} onChange={e => setGiftAmount(e.target.value)} min="1" className="w-full px-3 py-1.5 bg-muted/50 border border-border rounded-md text-sm text-center" />
            ) : (
              <select value={giftOre} onChange={e => setGiftOre(e.target.value)} className="w-full px-3 py-1.5 bg-muted/50 border border-border rounded-md text-sm">
                <option value="ore_copper">🪨 铜矿石</option><option value="ore_iron">⛏️ 铁矿石</option><option value="ore_gold">✨ 金矿石</option><option value="ore_mithril">💎 秘银矿石</option><option value="ore_adamantite">🔮 精金矿石</option>
              </select>
            )}
            {giftMsg && <p className="text-xs text-emerald-400 text-center">{giftMsg}</p>}
            <Button onClick={doGift} className="w-full">送出礼物</Button>
          </div>
        </div>
      )}
    </div>
  );
}
