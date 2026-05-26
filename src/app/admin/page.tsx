"use client";

import { useState, useEffect } from "react";
import { Shield, Search, Trash2, Users, ChevronDown, ChevronRight, Activity, Globe, Download, Ban, AlertTriangle, BarChart3, TrendingUp, Database } from "lucide-react";

interface UserRow {
  id: number; username: string; name: string; role: string; banned: boolean;
  level: number; xp: number; gold: number; hp: number;
  registerIp?: string; registerCountry?: string;
  lastLoginIp?: string; lastLoginCountry?: string;
  lastLoginDate?: string; createdAt: string; taskCount: number;
}

interface AdminStats {
  regTrend: Record<string, number>;
  countries: Record<string, number>;
  activeToday: number; activeThisWeek: number;
  totalUsers: number; totalTasks: number; totalCompletions: number;
  completionRate: number; avgLevel: number; banned: number;
  flaggedTasks: { id: number; title: string; userId: number; username: string }[];
}

export default function AdminPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<number | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    const [uRes, sRes] = await Promise.all([fetch("/api/admin/users"), fetch("/api/admin/stats")]);
    if (uRes.ok) setUsers(await uRes.json());
    if (sRes.ok) setStats(await sRes.json());
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, []);

  const handleSearch = async () => {
    const res = await fetch(`/api/admin/users?q=${encodeURIComponent(search)}`);
    if (res.ok) setUsers(await res.json());
  };

  const handleBan = async (id: number, ban: boolean) => {
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ banned: ban }),
    });
    if (res.ok) {
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, banned: ban } : u)));
      loadAll();
    }
  };

  const handleDelete = async (id: number, username: string) => {
    if (!confirm(`确定删除用户 "${username}" 及其所有数据？`)) return;
    const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    if (res.ok) { setUsers((prev) => prev.filter((u) => u.id !== id)); loadAll(); }
    else alert("删除失败");
  };

  const loadDetail = async (id: number) => {
    if (selected === id) { setSelected(null); setDetail(null); return; }
    setSelected(id); setDetailLoading(true);
    const res = await fetch(`/api/admin/users/${id}`);
    if (res.ok) setDetail(await res.json());
    setDetailLoading(false);
  };

  const exportUser = async (id: number) => {
    const res = await fetch(`/api/admin/users/${id}`);
    if (!res.ok) return;
    const data = await res.json();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `user-${id}-export.json`; a.click();
  };

  return (
    <div className="min-h-screen bg-background">
      <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-amber-400" />
            <span className="text-sm font-bold text-foreground">管理员面板</span>
          </div>
          <div className="flex items-center gap-3">
            <a href="/admin/db" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"><Database className="w-3 h-3" />数据库</a>
            <a href="/api/admin/backup" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"><Download className="w-3 h-3" />备份</a>
            <a href="/" className="text-xs text-muted-foreground hover:text-foreground">← 返回游戏</a>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {loading ? <div className="text-center py-8 text-muted-foreground">加载中...</div> : (
          <>
            {/* Stats cards */}
            {stats && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { icon: <Users className="w-4 h-4" />, label: "总用户", val: stats.totalUsers },
                    { icon: <Activity className="w-4 h-4" />, label: "今日活跃", val: stats.activeToday, color: "text-emerald-400" },
                    { icon: <TrendingUp className="w-4 h-4" />, label: "7日活跃", val: stats.activeThisWeek },
                    { icon: <BarChart3 className="w-4 h-4" />, label: "总打卡", val: stats.totalCompletions, color: "text-amber-400" },
                    { icon: <Ban className="w-4 h-4" />, label: "封禁", val: stats.banned, color: "text-red-400" },
                    { icon: <Shield className="w-4 h-4" />, label: "平均等级", val: stats.avgLevel },
                    { icon: <Activity className="w-4 h-4" />, label: "打卡率", val: `${stats.completionRate}%`, color: "text-emerald-400" },
                    { icon: <Globe className="w-4 h-4" />, label: "国家/地区", val: Object.keys(stats.countries).length },
                  ].map((s, i) => (
                    <div key={i} className="bg-card rounded-lg p-3 border border-border">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">{s.icon}{s.label}</div>
                      <div className={`text-xl font-bold ${s.color || "text-foreground"}`}>{s.val}</div>
                    </div>
                  ))}
                </div>

                {/* Country distribution */}
                {Object.keys(stats.countries).length > 0 && (
                  <div className="bg-card rounded-lg p-4 border border-border">
                    <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2"><Globe className="w-4 h-4" />用户分布</h3>
                    <div className="flex gap-3 flex-wrap">
                      {Object.entries(stats.countries).sort(([, a], [, b]) => b - a).map(([c, n]) => (
                        <span key={c} className="text-xs bg-muted/50 rounded px-2 py-1">
                          {c} <span className="text-muted-foreground">×{n}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Registration trend */}
                <div className="bg-card rounded-lg p-4 border border-border">
                  <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2"><TrendingUp className="w-4 h-4" />注册趋势（30天）</h3>
                  <div className="flex items-end gap-0.5 h-20">
                    {Object.entries(stats.regTrend).map(([day, count]) => (
                      <div key={day} className="flex-1 flex flex-col items-center" title={`${day}: ${count}人`}>
                        <div className="w-full bg-primary/30 rounded-t" style={{ height: `${Math.max(count * 8, 1)}px`, minHeight: count > 0 ? "4px" : "1px" }} />
                        <span className="text-[8px] text-muted-foreground mt-0.5 hidden sm:block">{day.slice(5)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Content audit */}
                {stats.flaggedTasks.length > 0 && (
                  <div className="bg-red-400/5 border border-red-400/20 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-red-400 mb-2 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />内容审核 — {stats.flaggedTasks.length} 个可疑任务
                    </h3>
                    <div className="space-y-1">
                      {stats.flaggedTasks.map((t) => (
                        <div key={t.id} className="text-xs text-muted-foreground flex justify-between">
                          <span>"{t.title}"</span>
                          <span>用户: {t.username}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* User search */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input className="w-full pl-8 pr-3 py-2 bg-card border border-border rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/40"
                  placeholder="搜索用户名..." value={search} onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()} />
              </div>
              <button onClick={handleSearch} className="px-3 py-2 bg-primary/10 text-primary rounded-md text-sm hover:bg-primary/20">搜索</button>
              <button onClick={() => { setSearch(""); loadAll(); }} className="px-3 py-2 text-muted-foreground rounded-md text-sm hover:text-foreground">清空</button>
            </div>

            {/* User list */}
            <div className="space-y-1">
              {users.map((u) => (
                <div key={u.id}>
                  <div onClick={() => loadDetail(u.id)}
                    className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                      selected === u.id ? "bg-card border-primary/30" : u.banned ? "border-red-500/10 bg-red-500/5" : "border-border hover:bg-card/50"
                    }`}>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-8">#{u.id}</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-medium ${u.banned ? "text-red-400 line-through" : "text-foreground"}`}>{u.username}</span>
                          {u.role === "admin" && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400">管理员</span>}
                          {u.banned && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-400">已封禁</span>}
                        </div>
                        <div className="text-[10px] text-muted-foreground flex items-center gap-2 mt-0.5">
                          <span>Lv.{u.level}</span><span>{u.xp} XP</span><span>{u.gold} G</span>
                          <span>{u.taskCount} 任务</span>
                          {u.registerCountry && <span>{u.registerCountry}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground">{u.lastLoginDate || "从未登录"}</span>
                      {u.role !== "admin" && (
                        <>
                          <button onClick={(e) => { e.stopPropagation(); exportUser(u.id); }} className="p-1 hover:bg-accent rounded" title="导出数据">
                            <Download className="w-3.5 h-3.5 text-muted-foreground" />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); handleBan(u.id, !u.banned); }}
                            className={`p-1 rounded ${u.banned ? "hover:bg-emerald-500/10 text-emerald-400" : "hover:bg-red-500/10 text-red-400"}`}
                            title={u.banned ? "解封" : "封禁"}>
                            <Ban className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); handleDelete(u.id, u.username); }}
                            className="p-1 hover:bg-destructive/10 rounded text-destructive/60" title="删除">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                      {selected === u.id ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                    </div>
                  </div>

                  {selected === u.id && (
                    <div className="mt-1 bg-card/30 rounded-lg p-4 border border-border/50 space-y-3">
                      {detailLoading ? <div className="text-sm text-muted-foreground">加载详情...</div> : detail ? (
                        <>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                            {[
                              ["注册IP", detail.user.registerIp || "-"], ["国家", detail.user.registerCountry || "-"],
                              ["最后登录IP", detail.user.lastLoginIp || "-"], ["最后登录地", detail.user.lastLoginCountry || "-"],
                              ["连续天数", String(detail.user.streakDays)], ["最佳连续", String(detail.user.bestStreak)],
                              ["累计天数", String(detail.user.totalDays)], ["HP惩罚", detail.user.hpPenaltyActive ? "是" : "否"],
                              ["注册时间", detail.user.createdAt?.split("T")[0] || "-"],
                            ].map(([label, val]) => (
                              <div key={label} className="flex justify-between bg-muted/30 rounded px-2 py-1">
                                <span className="text-muted-foreground">{label}</span><span className="text-foreground">{val}</span>
                              </div>
                            ))}
                          </div>
                          {detail.tasks?.length > 0 && (
                            <div>
                              <h4 className="text-xs font-semibold text-muted-foreground mb-2">任务 ({detail.tasks.length})</h4>
                              <div className="space-y-1 max-h-48 overflow-y-auto">
                                {detail.tasks.map((t: any) => (
                                  <div key={t.id} className="flex items-center justify-between text-xs bg-muted/20 rounded px-2 py-1.5">
                                    <div className="flex items-center gap-2">
                                      <span className="text-foreground truncate max-w-[200px]">{t.title}</span>
                                      <span className="text-muted-foreground">{t.mode}</span>
                                      <span className={`px-1 rounded text-[10px] ${t.completed ? "bg-emerald-500/20 text-emerald-400" : "bg-muted text-muted-foreground"}`}>
                                        {t.completed ? "完成" : t.status || "待办"}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                      <span>{t.difficulty}</span><span>+{t.xpReward}XP</span>
                                      {t.targetDate && <span>{t.targetDate}</span>}
                                    </div>
                                  </div>
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
              {users.length === 0 && <div className="text-center py-8 text-muted-foreground text-sm">暂无用户</div>}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
