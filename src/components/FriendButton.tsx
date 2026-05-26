"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Users, X, UserPlus, Check, XCircle, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Friend { id: number; username: string; name: string; level: number; note?: string | null; }
interface FriendRequest { id: number; fromUserId: number; username: string; name: string; level: number; createdAt: string; }

interface FriendButtonProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function FriendButton({ open: controlledOpen, onOpenChange }: FriendButtonProps) {
  const router = useRouter();
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = (v: boolean) => { if (isControlled) onOpenChange?.(v); else setInternalOpen(v); };

  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [addFriendName, setAddFriendName] = useState("");
  const [addError, setAddError] = useState("");
  const [addSuccess, setAddSuccess] = useState("");
  const [searchResults, setSearchResults] = useState<Friend[]>([]);
  const [searching, setSearching] = useState(false);
  const [noteTarget, setNoteTarget] = useState<Friend | null>(null);
  const [noteText, setNoteText] = useState("");
  const [unreadCounts, setUnreadCounts] = useState<Record<number, number>>({});

  const loadUnread = async () => {
    try {
      const lastFriendCheck = parseInt(localStorage.getItem("last_friend_check") || "0");
      const res = await fetch(`/api/notifications?after=${lastFriendCheck}`);
      if (res.ok) {
        const data = await res.json();
        setUnreadCounts(data.friendUnread || {});
      }
      // Mark as read: update timestamp to now
      localStorage.setItem("last_friend_check", String(Date.now()));
    } catch {}
  };

  const handleNoteEdit = (f: Friend) => { setNoteTarget(f); setNoteText(f.note || ""); };
  const saveNote = async () => {
    if (!noteTarget) return;
    await fetch("/api/friend", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "note", friendId: noteTarget.id, note: noteText }) });
    setNoteTarget(null);
    loadData();
  };

  const loadData = async () => {
    const [fRes, rRes] = await Promise.all([fetch("/api/friend"), fetch("/api/friend?action=requests")]);
    if (fRes.ok) setFriends(await fRes.json());
    if (rRes.ok) setRequests(await rRes.json());
  };

  useEffect(() => { loadData(); }, []);
  useEffect(() => { if (isControlled && open) { loadData(); loadUnread(); } }, [isControlled, open]);

  const handleSearch = async (q: string) => {
    setAddFriendName(q);
    if (q.length < 1) { setSearchResults([]); return; }
    setSearching(true);
    const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`);
    if (res.ok) setSearchResults(await res.json());
    setSearching(false);
  };

  const sendRequest = async (targetId: number) => {
    setAddError(""); setAddSuccess("");
    const res = await fetch("/api/friend", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "request", friendId: targetId }) });
    const data = await res.json();
    if (data.success) { setAddSuccess(data.message); setAddFriendName(""); setSearchResults([]); }
    else setAddError(data.error || "发送失败");
  };

  const acceptRequest = async (reqId: number) => {
    await fetch("/api/friend", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "accept", friendId: reqId }) });
    loadData();
  };

  const rejectRequest = async (reqId: number) => {
    if (!confirm("确定要拒绝该好友请求吗？")) return;
    await fetch("/api/friend", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "reject", friendId: reqId }) });
    loadData();
  };

  const removeFriend = async (friendId: number) => {
    if (!confirm("确定要删除该好友吗？")) return;
    await fetch("/api/friend", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "remove", friendId }) });
    loadData();
  };

  const pendingCount = requests.length;

  return (
    <>
      {!isControlled && (
        <motion.button
          onClick={() => { setInternalOpen(true); loadData(); loadUnread(); }}
          whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
          className="inline-flex shrink-0 items-center gap-1.5 px-3 py-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-sm font-bold text-emerald-400 hover:bg-emerald-500/20 transition-colors relative"
        >
          <Users className="w-5 h-5" />
          <span>好友</span>
          {pendingCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center">{pendingCount}</span>
          )}
        </motion.button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setOpen(false)}>
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            onClick={e => e.stopPropagation()}
            className="bg-card border border-border rounded-xl w-[calc(100%-1rem)] max-w-md h-[80vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h3 className="font-bold text-foreground flex items-center gap-2"><Users className="w-4 h-4 text-emerald-400" />好友</h3>
              <button onClick={() => setOpen(false)}><X className="w-4 h-4" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {/* Friend requests */}
              {requests.length > 0 && (
                <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3 space-y-2">
                  <h4 className="text-xs font-semibold text-amber-400 flex items-center gap-1.5"><Bell className="w-3.5 h-3.5" />好友请求 ({requests.length})</h4>
                  {requests.map(r => (
                    <div key={r.id} className="flex items-center justify-between">
                      <span className="text-sm text-foreground">{r.name || r.username} <span className="text-[10px] text-muted-foreground">Lv.{r.level}</span></span>
                      <div className="flex gap-1">
                        <button onClick={() => acceptRequest(r.id)} className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-md hover:bg-emerald-500/30"><Check className="w-4 h-4" /></button>
                        <button onClick={() => rejectRequest(r.id)} className="p-1.5 bg-red-500/10 text-red-400 rounded-md hover:bg-red-500/20"><XCircle className="w-4 h-4" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Search + add */}
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input value={addFriendName} onChange={e => handleSearch(e.target.value)}
                    placeholder="搜索同公会成员..."
                    className="flex-1 px-3 py-1.5 bg-muted/50 border border-border rounded-md text-sm focus:outline-none focus:border-primary/40" />
                </div>
                <p className="text-[10px] text-muted-foreground">仅可搜索同公会成员，或通过公会成员列表直接添加</p>
                {searching && <p className="text-xs text-muted-foreground">搜索中...</p>}
                {addError && <p className="text-xs text-red-400">{addError}</p>}
                {addSuccess && <p className="text-xs text-emerald-400">{addSuccess}</p>}
                {searchResults.length > 0 && (
                  <div className="space-y-1">
                    {searchResults.map(u => (
                      <div key={u.id} className="flex items-center justify-between p-2 rounded-lg border border-border hover:bg-accent/30">
                        <div>
                          <span className="text-sm text-foreground">{u.name || u.username}</span>
                          <span className="text-[10px] text-muted-foreground ml-2">Lv.{u.level}</span>
                        </div>
                        <button onClick={() => sendRequest(u.id)} className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-md hover:bg-emerald-500/20"><UserPlus className="w-4 h-4" /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Friend list */}
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground mb-2">我的好友 ({friends.length})</h4>
                {friends.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">暂无好友</p>
                ) : (
                  friends.map(f => (
                    <div key={f.id} className="flex items-center justify-between p-2.5 rounded-lg border border-border hover:bg-accent/30 transition-colors mb-1">
                      <div className="flex-1 cursor-pointer min-w-0"
                        onClick={() => { setOpen(false); router.push("/pm?friend=" + f.id); }}>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                          <span className={`text-sm font-medium truncate ${unreadCounts[f.id] ? "text-amber-400 animate-pulse" : "text-foreground"}`}>
                            {f.name || f.username}
                            {f.note && <span className="text-[10px] text-muted-foreground ml-1">({f.note})</span>}
                            {unreadCounts[f.id] > 0 && (
                              <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-bold bg-red-500 text-white rounded-full">{unreadCounts[f.id]}</span>
                            )}
                          </span>
                        </div>
                        <div className="text-[10px] text-muted-foreground ml-4">Lv.{f.level}</div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={(e) => { e.stopPropagation(); handleNoteEdit(f); }}
                          className="text-[10px] text-muted-foreground hover:text-amber-400 px-1" title="备注">
                          ✏️
                        </button>
                        <button onClick={() => removeFriend(f.id)} className="text-[10px] text-red-400 hover:underline">删除</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="p-3 border-t border-border">
              <Button variant="ghost" size="sm" onClick={() => router.push("/pm")} className="w-full justify-center text-emerald-400">
                打开私聊大厅 →
              </Button>

              {/* Note dialog */}
              {noteTarget && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60" onClick={() => setNoteTarget(null)}>
                  <div onClick={e => e.stopPropagation()} className="bg-card border border-border rounded-xl p-5 w-[calc(100%-2rem)] max-w-xs space-y-3">
                    <h3 className="font-bold text-foreground text-sm">备注 {noteTarget.name || noteTarget.username}</h3>
                    <input value={noteText} onChange={e => setNoteText(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && saveNote()}
                      placeholder="真实姓名或备注..." autoFocus
                      className="w-full px-3 py-2 bg-muted/50 border border-border rounded-md text-sm" />
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => setNoteTarget(null)} className="flex-1">取消</Button>
                      <Button onClick={saveNote} className="flex-1">保存</Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </>
  );
}
