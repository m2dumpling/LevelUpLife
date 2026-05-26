"use client";

import { useState, useEffect } from "react";
import { Database, Table, Trash2, Edit3, Plus, X, Save, RefreshCw } from "lucide-react";

interface ColumnInfo { cid: number; name: string; type: string; notnull: number; dflt_value: string | null; pk: number; }

export default function AdminDbPage() {
  const [tables, setTables] = useState<string[]>([]);
  const [activeTable, setActiveTable] = useState<string | null>(null);
  const [columns, setColumns] = useState<ColumnInfo[]>([]);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [adding, setAdding] = useState(false);
  const [editData, setEditData] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");

  useEffect(() => { fetch("/api/admin/db").then(r => r.json()).then(setTables).catch(() => {}); }, []);

  const loadTable = async (name: string) => {
    setActiveTable(name); setEditing(null); setAdding(false); setLoading(true);
    const res = await fetch(`/api/admin/db?table=${encodeURIComponent(name)}`);
    if (res.ok) {
      const data = await res.json();
      setColumns(data.columns || []);
      setRows(data.rows || []);
    }
    setLoading(false);
  };

  const handleAction = async (action: string, id?: number) => {
    const body: Record<string, unknown> = { action, table: activeTable, id };
    if (action === "update" || action === "insert") {
      const data: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(editData)) {
        if (!v && v !== "0") { data[k] = null; continue; }
        const num = Number(v);
        data[k] = isNaN(num) || v.trim() === "" ? v : num;
      }
      body.data = data;
    }
    const res = await fetch("/api/admin/db", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const result = await res.json();
    setMsg(result.success ? "操作成功" : (result.error || "操作失败"));
    setTimeout(() => setMsg(""), 2000);
    if (result.success) { setEditing(null); setAdding(false); if (activeTable) loadTable(activeTable); }
  };

  const startEdit = (row: Record<string, unknown>) => {
    setAdding(false); setEditing(row);
    const d: Record<string, string> = {};
    for (const c of columns) d[c.name] = row[c.name] != null ? String(row[c.name]) : "";
    setEditData(d);
  };

  const startAdd = () => {
    setEditing(null); setAdding(true);
    const d: Record<string, string> = {};
    for (const c of columns) if (c.name !== "id") d[c.name] = "";
    setEditData(d);
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 bg-muted/20 border-r border-border flex flex-col h-screen">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <Database className="w-4 h-4 text-primary" />
          <span className="text-sm font-bold text-foreground">数据库管理</span>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          {tables.map(t => (
            <button key={t} onClick={() => loadTable(t)}
              className={`w-full text-left px-4 py-2 text-xs transition-colors flex items-center gap-2 ${activeTable === t ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-accent/50"}`}>
              <Table className="w-3 h-3" />{t}
            </button>
          ))}
        </div>
        <div className="p-3 border-t border-border">
          <a href="/admin" className="text-xs text-muted-foreground hover:text-foreground">← 返回管理面板</a>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <div className="h-12 shrink-0 border-b border-border flex items-center px-4 gap-2">
          <span className="text-sm font-bold text-foreground">{activeTable || "选择一个表"}</span>
          {activeTable && (
            <div className="flex items-center gap-2 ml-auto">
              {msg && <span className="text-xs text-emerald-400">{msg}</span>}
              <button onClick={startAdd} className="p-1.5 hover:bg-accent rounded text-emerald-400" title="新增行"><Plus className="w-4 h-4" /></button>
              <button onClick={() => loadTable(activeTable)} className="p-1.5 hover:bg-accent rounded text-muted-foreground" title="刷新"><RefreshCw className="w-4 h-4" /></button>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-auto">
          {!activeTable ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">选择一个表查看数据</div>
          ) : loading ? (
            <div className="flex items-center justify-center h-full"><div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/30 sticky top-0">
                    <th className="px-3 py-2 text-left text-muted-foreground font-medium">操作</th>
                    {columns.map(c => <th key={c.name} className="px-3 py-2 text-left text-muted-foreground font-medium whitespace-nowrap">{c.name}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {/* Add row */}
                  {adding && (
                    <tr className="bg-emerald-500/5">
                      <td className="px-3 py-2">
                        <div className="flex gap-1">
                          <button onClick={() => handleAction("insert")} className="p-1 hover:bg-emerald-500/20 rounded text-emerald-400"><Save className="w-3.5 h-3.5" /></button>
                          <button onClick={() => setAdding(false)} className="p-1 hover:bg-accent rounded"><X className="w-3.5 h-3.5" /></button>
                        </div>
                      </td>
                      {columns.map(c => (
                        <td key={c.name} className="px-1 py-1">
                          {c.name === "id" ? <span className="text-muted-foreground">auto</span> :
                            <input value={editData[c.name] || ""} onChange={e => setEditData(prev => ({ ...prev, [c.name]: e.target.value }))}
                              className="w-full px-1 py-0.5 bg-card border border-border rounded text-[11px] min-w-[60px]" />}
                        </td>
                      ))}
                    </tr>
                  )}
                  {rows.map((row, i) => (
                    <tr key={i} className={`border-t border-border/30 hover:bg-muted/20 ${editing && editing.id === row.id ? "bg-primary/5" : ""}`}>
                      <td className="px-3 py-2">
                        <div className="flex gap-1">
                          {editing && editing.id === row.id ? (
                            <>
                              <button onClick={() => handleAction("update", row.id as number)} className="p-1 hover:bg-emerald-500/20 rounded text-emerald-400"><Save className="w-3.5 h-3.5" /></button>
                              <button onClick={() => setEditing(null)} className="p-1 hover:bg-accent rounded"><X className="w-3.5 h-3.5" /></button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => startEdit(row)} className="p-1 hover:bg-accent rounded text-muted-foreground"><Edit3 className="w-3.5 h-3.5" /></button>
                              <button onClick={() => { if (confirm("确定删除该行？")) handleAction("delete", row.id as number); }} className="p-1 hover:bg-red-500/10 rounded text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                            </>
                          )}
                        </div>
                      </td>
                      {columns.map(c => (
                        <td key={c.name} className="px-3 py-2 whitespace-nowrap max-w-[200px] truncate text-foreground/80">
                          {editing && editing.id === row.id && c.name !== "id" ? (
                            <input value={editData[c.name] || ""} onChange={e => setEditData(prev => ({ ...prev, [c.name]: e.target.value }))}
                              className="w-full px-1 py-0.5 bg-card border border-border rounded text-[11px] min-w-[60px]" />
                          ) : row[c.name] != null ? String(row[c.name]) : <span className="text-muted-foreground/40">NULL</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
