"use client";

import { useState, useEffect } from "react";
import { Shield, Search, Trash2, Users, User, ChevronDown, ChevronRight, Activity, Globe } from "lucide-react";

interface UserRow {
  id: number; username: string; name: string; role: string;
  level: number; xp: number; gold: number; hp: number;
  registerIp?: string; registerCountry?: string;
  lastLoginIp?: string; lastLoginCountry?: string;
  lastLoginDate?: string; createdAt: string; taskCount: number;
}

interface UserDetail {
  user: UserRow & { storyProgress: string; hpPenaltyActive: boolean; streakDays: number; bestStreak: number; totalDays: number; };
  tasks: { id: number; title: string; mode: string; difficulty: string; xpReward: number; goldReward: number; completed: boolean; status?: string; targetDate?: string; streakCount: number; createdAt: string; }[];
  inventory: { itemKey: string; quantity: number; equipped: boolean; }[];
}

export default function AdminPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<number | null>(null);
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadUsers = async (q?: string) => {
    setLoading(true);
    const url = q ? `/api/admin/users?q=${encodeURIComponent(q)}` : "/api/admin/users";
    const res = await fetch(url);
    if (res.ok) setUsers(await res.json());
    setLoading(false);
  };

  useEffect(() => { loadUsers(); }, []);

  const handleSearch = () => loadUsers(search);

  const loadDetail = async (id: number) => {
    if (selected === id) { setSelected(null); setDetail(null); return; }
    setSelected(id); setDetailLoading(true);
    const res = await fetch(`/api/admin/users/${id}`);
    if (res.ok) setDetail(await res.json());
    setDetailLoading(false);
  };

  const handleDelete = async (id: number, username: string) => {
    if (!confirm(`确定删除用户 "${username}" 及其所有数据？此操作不可撤销。`)) return;
    const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    if (res.ok) { setUsers((prev) => prev.filter((u) => u.id !== id)); setSelected(null); setDetail(null); }
    else alert("删除失败");
  };

  const totalTasks = users.reduce((s, u) => s + u.taskCount, 0);
  const activeToday = users.filter((u) => u.lastLoginDate === new Date().toISOString().split("T")[0]).length;

  return (
    <div className="min-h-screen bg-background">
      <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-amber-400" />
            <span className="text-sm font-bold text-foreground">管理员面板</span>
          </div>
          <a href="/" className="text-xs text-muted-foreground hover:text-foreground">← 返回游戏</a>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Stats cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[{ icon: <Users className="w-4 h-4" />, label: "总用户", val: users.length },
            { icon: <Activity className="w-4 h-4" />, label: "今日活跃", val: activeToday, color: "text-emerald-400" },
            { icon: <Shield className="w-4 h-4" />, label: "总任务", val: totalTasks },
            { icon: <Globe className="w-4 h-4" />, label: "管理员", val: users.filter((u) => u.role === "admin").length, color: "text-amber-400" },
          ].map((s, i) => (
            <div key={i} className="bg-card rounded-lg p-3 border border-border">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">{s.icon}{s.label}</div>
              <div className={`text-xl font-bold ${s.color || "text-foreground"}`}>{s.val}</div>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              className="w-full pl-8 pr-3 py-2 bg-card border border-border rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/40"
              placeholder="搜索用户名..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
          </div>
          <button onClick={handleSearch} className="px-3 py-2 bg-primary/10 text-primary rounded-md text-sm hover:bg-primary/20">搜索</button>
          <button onClick={() => { setSearch(""); loadUsers(); }} className="px-3 py-2 text-muted-foreground rounded-md text-sm hover:text-foreground">清空</button>
        </div>

        {/* User list */}
        {loading ? (
          <div className="text-center text-muted-foreground py-8">加载中...</div>
        ) : (
          <div className="space-y-1">
            {users.map((u) => (
              <div key={u.id}>
                <div
                  onClick={() => loadDetail(u.id)}
                  className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                    selected === u.id ? "bg-card border-primary/30" : "border-border hover:bg-card/50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-8">#{u.id}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">{u.username}</span>
                        {u.role === "admin" && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400">管理员</span>}
                      </div>
                      <div className="text-[10px] text-muted-foreground flex items-center gap-2 mt-0.5">
                        <span>Lv.{u.level}</span>
                        <span>{u.xp} XP</span>
                        <span>{u.gold} G</span>
                        <span>{u.taskCount} 任务</span>
                        {u.registerCountry && <span>{u.registerCountry}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground">
                      {u.lastLoginDate || "从未登录"}
                    </span>
                    {u.role !== "admin" && (
                      <button onClick={(e) => { e.stopPropagation(); handleDelete(u.id, u.username); }}
                        className="p-1 hover:bg-destructive/10 rounded text-destructive/60">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {selected === u.id ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </div>

                {/* Expanded detail */}
                {selected === u.id && (
                  <div className="mt-1 bg-card/30 rounded-lg p-4 border border-border/50 space-y-3">
                    {detailLoading ? (
                      <div className="text-sm text-muted-foreground">加载详情...</div>
                    ) : detail ? (
                      <>
                        {/* User info */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                          {[
                            ["注册IP", detail.user.registerIp || "-"],
                            ["国家", detail.user.registerCountry || "-"],
                            ["最后登录IP", detail.user.lastLoginIp || "-"],
                            ["最后登录地", detail.user.lastLoginCountry || "-"],
                            ["连续天数", String(detail.user.streakDays)],
                            ["最佳连续", String(detail.user.bestStreak)],
                            ["累计天数", String(detail.user.totalDays)],
                            ["HP惩罚", detail.user.hpPenaltyActive ? "是" : "否"],
                            ["注册时间", detail.user.createdAt?.split("T")[0] || "-"],
                          ].map(([label, val]) => (
                            <div key={label} className="flex justify-between bg-muted/30 rounded px-2 py-1">
                              <span className="text-muted-foreground">{label}</span>
                              <span className="text-foreground">{val}</span>
                            </div>
                          ))}
                        </div>

                        {/* Tasks */}
                        {detail.tasks.length > 0 && (
                          <div>
                            <h4 className="text-xs font-semibold text-muted-foreground mb-2">
                              任务列表 ({detail.tasks.length})
                            </h4>
                            <div className="space-y-1 max-h-48 overflow-y-auto">
                              {detail.tasks.map((t) => (
                                <div key={t.id} className="flex items-center justify-between text-xs bg-muted/20 rounded px-2 py-1.5">
                                  <div className="flex items-center gap-2">
                                    <span className="text-foreground truncate max-w-[200px]">{t.title}</span>
                                    <span className="text-muted-foreground">{t.mode}</span>
                                    <span className={`px-1 rounded text-[10px] ${t.completed ? "bg-emerald-500/20 text-emerald-400" : "bg-muted text-muted-foreground"}`}>
                                      {t.completed ? "完成" : t.status || "待办"}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 text-muted-foreground">
                                    <span>{t.difficulty}</span>
                                    <span>+{t.xpReward}XP</span>
                                    {t.targetDate && <span>{t.targetDate}</span>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Inventory */}
                        {detail.inventory.length > 0 && (
                          <div>
                            <h4 className="text-xs font-semibold text-muted-foreground mb-1">背包</h4>
                            <div className="flex gap-2 flex-wrap text-xs text-muted-foreground">
                              {detail.inventory.map((i) => (
                                <span key={i.itemKey} className="bg-muted/30 rounded px-2 py-0.5">
                                  {i.itemKey} ×{i.quantity} {i.equipped ? "[装备中]" : ""}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    ) : null}
                  </div>
                )}
              </div>
            ))}
            {users.length === 0 && (
              <div className="text-center py-8 text-muted-foreground text-sm">暂无用户</div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
