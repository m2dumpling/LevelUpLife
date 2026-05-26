"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Send, Users, MessageCircle, Gift, Coins, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatBeijingTime } from "@/lib/date-utils";

interface Friend { id: number; username: string; name: string; level: number; }
interface ChatMsg { id: number; userId: number; friendId: number; message: string; createdAt: string; }

function formatStamp(iso: string): string { return formatBeijingTime(iso); }

export default function PmPage() {
  const router = useRouter();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [activeFriend, setActiveFriend] = useState<Friend | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(0);
  const [showSidebar, setShowSidebar] = useState(false);
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
      if (fid && list.length > 0) {
        const f = list.find((fr: Friend) => fr.id === fid);
        if (f) selectFriend(f);
      }
    })();
  }, []);

  const loadFriends = async () => {
    const res = await fetch("/api/friend");
    if (res.ok) setFriends(await res.json());
  };

  const loadMessages = async (friendId: number) => {
    const res = await fetch(`/api/friend?action=messages&friendId=${friendId}`);
    if (res.ok) setMessages(await res.json());
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  const selectFriend = (f: Friend) => {
    setActiveFriend(f);
    setShowSidebar(false);
    loadMessages(f.id);
  };

  const send = async () => {
    if (!input.trim() || !activeFriend || sending) return;
    setSending(true);
    await fetch("/api/friend", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "send", friendId: activeFriend.id, message: input.trim() }) });
    setInput(""); setSending(false);
    loadMessages(activeFriend.id);
  };

  const doGift = async () => {
    if (!activeFriend) return;
    const value = giftType === "gold" ? giftAmount : giftOre;
    const res = await fetch("/api/guild/gift", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ toUserId: activeFriend.id, giftType, giftValue: value }) });
    const data = await res.json();
    setGiftMsg(data.success ? data.message : (data.error || "送礼失败"));
    if (data.success) setTimeout(() => { setGiftOpen(false); setGiftMsg(""); }, 1500);
  };

  // Poll messages
  useEffect(() => {
    if (!activeFriend) return;
    const iv = setInterval(() => loadMessages(activeFriend.id), 3000);
    return () => clearInterval(iv);
  }, [activeFriend]);

  return (
    <div className="min-h-screen bg-background flex">
      {/* Mobile sidebar toggle */}
      {!activeFriend && (
        <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-background border-b border-border p-3">
          <button onClick={() => router.push("/")} className="flex items-center gap-2 text-sm text-muted-foreground">
            <ArrowLeft className="w-4 h-4" /> 返回
          </button>
        </div>
      )}

      {/* Sidebar: friend list */}
      <div className={`${activeFriend && !showSidebar ? "hidden md:flex" : "flex"} flex-col w-full md:w-64 border-r border-border bg-card/50 h-screen pt-12 md:pt-0`}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <button onClick={() => router.push("/")} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-3 h-3" /> 返回
          </button>
          <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-emerald-400" /> 私聊
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {friends.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">暂无好友</p>
          ) : (
            friends.map(f => (
              <button key={f.id} onClick={() => selectFriend(f)}
                className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center gap-2 ${activeFriend?.id === f.id ? "bg-accent text-foreground" : "hover:bg-accent/50 text-muted-foreground"}`}>
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>{f.name || f.username}</span>
                <span className="text-[10px] text-muted-foreground ml-auto">Lv.{f.level}</span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main chat area */}
      <div className={`${!activeFriend ? "hidden md:flex" : "flex"} flex-1 flex-col h-screen`}>
        {!activeFriend ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
            <div className="text-center space-y-2">
              <MessageCircle className="w-10 h-10 mx-auto opacity-20" />
              <p>选择一个好友开始私聊</p>
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border shrink-0">
              <button onClick={() => setShowSidebar(!showSidebar)} className="md:hidden p-1 hover:bg-accent rounded">
                <Users className="w-4 h-4" />
              </button>
              <button onClick={() => setActiveFriend(null)} className="md:hidden p-1 hover:bg-accent rounded">
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
              <span className="text-sm font-bold text-foreground">{activeFriend.name || activeFriend.username}</span>
              <span className="text-[10px] text-muted-foreground">Lv.{activeFriend.level}</span>
              <button onClick={() => setGiftOpen(true)} className="ml-auto p-1.5 hover:bg-accent rounded-lg text-amber-400" title="送礼物">
                <Gift className="w-5 h-5" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1.5">
              {messages.map(m => (
                <div key={m.id} className={`text-xs ${m.userId === currentUserId ? "text-right" : ""}`}>
                  <div className={`inline-block px-2.5 py-1.5 rounded-lg max-w-[75%] ${m.userId === currentUserId ? "bg-primary/20 text-foreground" : "bg-muted/50 text-muted-foreground"}`}>
                    {m.message}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div className="flex gap-2 px-3 py-2 border-t border-border shrink-0">
              <input
                type="text" value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder="发送消息..."
                className="flex-1 px-3 py-1.5 bg-muted/50 border border-border rounded-md text-sm focus:outline-none focus:border-primary/40"
              />
              <Button onClick={send} disabled={!input.trim() || sending} size="sm"><Send className="w-3.5 h-3.5" /></Button>
            </div>
          </>
        )}
      </div>

      {/* Gift dialog */}
      {giftOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setGiftOpen(false)}>
          <div onClick={e => e.stopPropagation()} className="bg-card border border-border rounded-xl p-5 w-[calc(100%-2rem)] max-w-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-foreground flex items-center gap-2"><Gift className="w-4 h-4 text-amber-400" />送礼给 {activeFriend?.username}</h3>
              <button onClick={() => setGiftOpen(false)}><X className="w-4 h-4" /></button>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setGiftType("gold")} className={`flex-1 py-2 rounded-lg text-sm font-bold ${giftType === "gold" ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" : "bg-muted/50 text-muted-foreground"}`}>
                <Coins className="w-4 h-4 mx-auto mb-0.5" />金币
              </button>
              <button onClick={() => setGiftType("ore")} className={`flex-1 py-2 rounded-lg text-sm font-bold ${giftType === "ore" ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" : "bg-muted/50 text-muted-foreground"}`}>
                🪨 矿石
              </button>
            </div>
            {giftType === "gold" ? (
              <input type="number" value={giftAmount} onChange={e => setGiftAmount(e.target.value)} min="1"
                className="w-full px-3 py-1.5 bg-muted/50 border border-border rounded-md text-sm text-center" />
            ) : (
              <select value={giftOre} onChange={e => setGiftOre(e.target.value)}
                className="w-full px-3 py-1.5 bg-muted/50 border border-border rounded-md text-sm">
                <option value="ore_copper">🪨 铜矿石</option>
                <option value="ore_iron">⛏️ 铁矿石</option>
                <option value="ore_gold">✨ 金矿石</option>
                <option value="ore_mithril">💎 秘银矿石</option>
                <option value="ore_adamantite">🔮 精金矿石</option>
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
