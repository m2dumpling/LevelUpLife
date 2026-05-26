"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Users, X, Send, UserPlus, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Friend {
  id: number; username: string; name: string; level: number;
}

interface ChatMsg {
  id: number; userId: number; friendId: number; message: string; createdAt: string;
}

interface FriendButtonProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function FriendButton({ open: controlledOpen, onOpenChange }: FriendButtonProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = (v: boolean) => {
    if (isControlled) {
      onOpenChange?.(v);
    } else {
      setInternalOpen(v);
    }
  };

  const [friends, setFriends] = useState<Friend[]>([]);
  const [activeChat, setActiveChat] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [chatPoll, setChatPoll] = useState<ReturnType<typeof setInterval> | null>(null);
  const [currentUserId, setCurrentUserId] = useState<number>(0);
  const [addFriendName, setAddFriendName] = useState("");
  const [addError, setAddError] = useState("");

  useEffect(() => {
    fetch("/api/user").then(r => r.json()).then(u => setCurrentUserId(u.id)).catch(() => {});
    loadFriends();
  }, []);

  const loadFriends = async () => {
    const res = await fetch("/api/friend");
    if (res.ok) setFriends(await res.json());
  };

  const loadMessages = async (friendId: number) => {
    const res = await fetch(`/api/friend?action=messages&friendId=${friendId}`);
    if (res.ok) setMessages(await res.json());
  };

  const startChat = (friendId: number) => {
    setActiveChat(friendId);
    loadMessages(friendId);
    if (chatPoll) clearInterval(chatPoll);
    const p = setInterval(() => loadMessages(friendId), 3000);
    setChatPoll(p);
  };

  const closeChat = () => {
    setActiveChat(null);
    if (chatPoll) { clearInterval(chatPoll); setChatPoll(null); }
  };

  const sendMessage = async () => {
    if (!input.trim() || !activeChat) return;
    await fetch("/api/friend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "send", friendId: activeChat, message: input.trim() }),
    });
    setInput("");
    loadMessages(activeChat);
  };

  const addFriend = async () => {
    setAddError("");
    if (!addFriendName.trim()) return;
    // 通过用户名查找用户
    const res = await fetch("/api/admin/users?q=" + encodeURIComponent(addFriendName.trim()));
    if (!res.ok) { setAddError("查找失败"); return; }
    const users = await res.json();
    const target = users.find((u: any) => u.username === addFriendName.trim());
    if (!target) { setAddError("用户不存在"); return; }
    if (target.id === currentUserId) { setAddError("不能添加自己"); return; }

    const addRes = await fetch("/api/friend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add", friendId: target.id }),
    });
    const data = await addRes.json();
    if (data.success) {
      setAddFriendName("");
      loadFriends();
    } else {
      setAddError(data.error || "添加失败");
    }
  };

  const removeFriend = async (friendId: number) => {
    await fetch("/api/friend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "remove", friendId }),
    });
    if (activeChat === friendId) closeChat();
    loadFriends();
  };

  const activeFriend = friends.find(f => f.id === activeChat);

  // Auto-load friends when controlled open
  useEffect(() => {
    if (isControlled && open) {
      loadFriends();
    }
  }, [isControlled, open]);

  return (
    <>
      {!isControlled && (
        <motion.button
          onClick={() => { setInternalOpen(true); loadFriends(); }}
          whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
          className="inline-flex shrink-0 items-center gap-1.5 px-3 py-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-sm font-bold text-emerald-400 hover:bg-emerald-500/20 transition-colors"
        >
          <Users className="w-5 h-5" />
          <span>好友</span>
          {friends.length > 0 && (
            <span className="text-[10px] bg-emerald-500/20 rounded-full px-1.5 py-0.5 leading-none">{friends.length}</span>
          )}
        </motion.button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => { setOpen(false); closeChat(); }}>
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            onClick={e => e.stopPropagation()}
            className="bg-card border border-border rounded-xl w-[calc(100%-1rem)] max-w-md h-[85vh] flex flex-col overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h3 className="font-bold text-foreground flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" />
                好友
              </h3>
              <button onClick={() => { setOpen(false); closeChat(); }} className="p-1 hover:bg-accent rounded"><X className="w-4 h-4" /></button>
            </div>

            {!activeChat ? (
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {/* Add friend */}
                <div className="flex gap-2">
                  <input
                    value={addFriendName} onChange={e => setAddFriendName(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && addFriend()}
                    placeholder="输入用户名添加好友"
                    className="flex-1 px-3 py-1.5 bg-muted/50 border border-border rounded-md text-sm focus:outline-none focus:border-primary/40"
                  />
                  <Button size="sm" onClick={addFriend}><UserPlus className="w-3.5 h-3.5" /></Button>
                </div>
                {addError && <p className="text-xs text-red-400">{addError}</p>}

                {/* Friend list */}
                {friends.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">暂无好友</p>
                ) : (
                  friends.map(f => (
                    <div key={f.id} className="flex items-center justify-between p-2.5 rounded-lg border border-border hover:bg-accent/30 transition-colors">
                      <div className="flex items-center gap-2 cursor-pointer" onClick={() => startChat(f.id)}>
                        <MessageCircle className="w-4 h-4 text-emerald-400" />
                        <div>
                          <span className="text-sm font-medium text-foreground">{f.name || f.username}</span>
                          <span className="text-[10px] text-muted-foreground ml-2">Lv.{f.level}</span>
                        </div>
                      </div>
                      <button onClick={() => removeFriend(f.id)} className="text-[10px] text-red-400 hover:underline">删除</button>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className="flex-1 flex flex-col">
                <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
                  <button onClick={closeChat} className="text-xs text-muted-foreground hover:text-foreground">← 返回</button>
                  <span className="text-sm font-medium text-foreground">{activeFriend?.name || activeFriend?.username}</span>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
                  {messages.map(m => (
                    <div key={m.id} className={`text-xs ${m.userId === currentUserId ? "text-right" : ""}`}>
                      <div className={`inline-block px-2.5 py-1.5 rounded-lg max-w-[80%] ${m.userId === currentUserId ? "bg-primary/20 text-foreground" : "bg-muted/50 text-muted-foreground"}`}>
                        {m.message}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 px-3 py-2 border-t border-border">
                  <input
                    value={input} onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                    placeholder="输入消息..."
                    className="flex-1 px-3 py-1.5 bg-muted/50 border border-border rounded-md text-sm focus:outline-none focus:border-primary/40"
                  />
                  <Button size="sm" onClick={sendMessage}><Send className="w-3.5 h-3.5" /></Button>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </>
  );
}
