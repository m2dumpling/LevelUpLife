"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Swords, Dice1, Calculator, Plus, Loader2, Coins, Clock, User, Trophy } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// ── 类型 ──

interface WaitingMatch {
  id: number;
  type: string;
  bet: number;
  creatorName: string;
  createdAt: string;
}

interface RecentMatch {
  id: number;
  type: string;
  bet: number;
  winnerId: number | null;
  winnerName: string | null;
  player1Name: string;
  player2Name: string;
  result: Record<string, unknown> | null;
  createdAt: string;
}

interface MatchResult {
  winner: string | null;
  winnerId?: number | null;
  message?: string;
  prize?: number;
  player1Move?: string;
  player2Move?: string;
  player1Roll?: number;
  player2Roll?: number;
  correctAnswer?: number;
  yourAnswer?: number;
}

interface ActiveMatch {
  id: number;
  type: string;
  bet: number;
  player1Id: number;
  player2Id: number | null;
  status: string;
  result: string | null;
  createdAt: string;
}

// ── 游戏类型图标/名称 ──

const GAME_TYPES: Record<string, { name: string; icon: React.ReactNode; desc: string }> = {
  rps: { name: "石头剪刀布", icon: <span className="text-lg">✊</span>, desc: "经典猜拳对决" },
  dice: { name: "骰子对决", icon: <Dice1 className="w-4 h-4" />, desc: "D20 骰子比拼运气" },
  math: { name: "速算对决", icon: <Calculator className="w-4 h-4" />, desc: "心算速度比拼" },
};

const RPS_EMOJI: Record<string, string> = { rock: "✊", paper: "✋", scissors: "✌️" };
const RPS_NAMES: Record<string, string> = { rock: "石头", paper: "布", scissors: "剪刀" };

// ── 组件 ──

interface PvPArenaProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function PvPArena({ open: controlledOpen, onOpenChange: controlledOnChange }: PvPArenaProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;

  const handleOpenChange = (v: boolean) => {
    if (isControlled) {
      controlledOnChange?.(v);
    } else {
      setInternalOpen(v);
    }
  };

  const [waiting, setWaiting] = useState<WaitingMatch[]>([]);
  const [recent, setRecent] = useState<RecentMatch[]>([]);
  const [loading, setLoading] = useState(false);

  // 创建对决
  const [createOpen, setCreateOpen] = useState(false);
  const [gameType, setGameType] = useState("rps");
  const [bet, setBet] = useState(20);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  // 活跃对决
  const [activeMatch, setActiveMatch] = useState<ActiveMatch | null>(null);
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [joining, setJoining] = useState<number | null>(null);

  // RPS
  const [rpsMove, setRpsMove] = useState<string | null>(null);
  const [rpsSubmitted, setRpsSubmitted] = useState(false);

  // Math
  const [mathAnswer, setMathAnswer] = useState("");

  // Dice animation
  const [diceRolling, setDiceRolling] = useState(false);

  const [currentUserId, setCurrentUserId] = useState<number | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const matchPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── 获取大厅数据 ──
  const fetchLobby = useCallback(async () => {
    try {
      const res = await fetch("/api/pvp");
      if (res.ok) {
        const data = await res.json();
        setWaiting(data.waiting || []);
        setRecent(data.recent || []);
      }
    } catch {
      // 静默
    }
  }, []);

  // ── 轮询当前对决状态 ──
  const fetchMatchStatus = useCallback(async () => {
    if (!activeMatch) return;
    try {
      // 拉大厅数据中找当前对决
      const res = await fetch("/api/pvp");
      if (!res.ok) return;
      const data = await res.json();
      // 直接用 matchId 轮询单场状态
      const pollRes = await fetch(`/api/pvp?matchId=${activeMatch.id}`);
      if (!pollRes.ok) return;
      const pollData = await pollRes.json();
      if (!pollData.match) return;
      const m = pollData.match;

      // 比赛已结算
      if (m.status === "completed") {
        const resultData = m.result ? JSON.parse(m.result as string) : {};
        setMatchResult({
          winner: m.player2Name ?? m.player1Name,
          winnerId: undefined,
          prize: m.bet * 2 - 2,
          message: JSON.stringify(resultData),
          ...resultData,
        });
        setActiveMatch((prev) => prev ? { ...prev, status: "completed", player2Id: m.player2Id ?? prev.player2Id, result: m.result ?? prev.result } : null);
        return;
      }

      // 对手加入 → status=playing
      if (m.status === "playing" || m.player2Id) {
        setActiveMatch((prev) => {
          if (!prev) return null;
          return { ...prev, player2Id: m.player2Id ?? prev.player2Id, result: m.result ?? prev.result, status: m.status ?? prev.status };
        });
        return;
      }

      // 查最近完成的比赛有没有当前 matchId
      const done = (data.recent || []).find((m: RecentMatch) => m.id === activeMatch.id);
      if (done) {
        // 比赛已结算
        setMatchResult({
          winner: done.winnerName,
          winnerId: done.winnerId,
          prize: done.bet * 2 - 2,
          message: done.result ? JSON.stringify(done.result) : undefined,
          ...(done.result as Record<string, unknown>),
        });
        setActiveMatch((prev) => prev ? { ...prev, status: "completed" } : null);
        return;
      }
      // 查进行中的对决（对手加入后状态变为 playing）
      if (data.active && data.active.id === activeMatch.id) {
        setActiveMatch((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            player2Id: data.active.player2Id ?? prev.player2Id,
            result: data.active.result ?? prev.result,
            status: data.active.status ?? prev.status,
          };
        });
        return;
      }
      // 查等待列表中有没有当前对决的更新
      const waitingMatch = (data.waiting || []).find((m: WaitingMatch & { player2Id?: number; result?: string }) => m.id === activeMatch.id);
      if (!waitingMatch) return;
      // 更新对决状态
      setActiveMatch((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          player2Id: (waitingMatch as { player2Id?: number }).player2Id ?? prev.player2Id,
          result: (waitingMatch as { result?: string }).result ?? prev.result,
        };
      });
    } catch {
      // 静默
    }
  }, [activeMatch]);

  useEffect(() => {
    if (open) {
      fetchLobby();
      pollRef.current = setInterval(fetchLobby, 1500);
    }
    return () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
  }, [open, fetchLobby]);

  // 获取当前用户 ID
  useEffect(() => {
    if (open) {
      fetch("/api/user").then(r => r.json()).then(u => setCurrentUserId(u.id)).catch(() => {});
    }
  }, [open]);

  // 活跃对决轮询
  useEffect(() => {
    if (activeMatch && !matchResult) {
      matchPollRef.current = setInterval(fetchMatchStatus, 2000);
    }
    return () => {
      if (matchPollRef.current) { clearInterval(matchPollRef.current); matchPollRef.current = null; }
    };
  }, [activeMatch, matchResult, fetchMatchStatus]);

  // 打开对话框时加载
  useEffect(() => {
    if (open) setLoading(true);
    const t = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(t);
  }, [open]);

  // ── 创建对决 ──
  const handleCreate = async () => {
    setCreateError("");
    setCreating(true);
    try {
      const res = await fetch("/api/pvp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", type: gameType, bet }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCreateError(data.error || "创建失败");
        return;
      }
      setActiveMatch(data.match);
      setCreateOpen(false);
      setMatchResult(null);
      setRpsMove(null);
      setRpsSubmitted(false);
      setMathAnswer("");
      window.dispatchEvent(new Event("task-completed"));
    } catch {
      setCreateError("网络错误");
    } finally {
      setCreating(false);
    }
  };

  // ── 加入对决 ──
  const handleJoin = async (matchId: number) => {
    setJoining(matchId);
    try {
      const res = await fetch("/api/pvp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "join", matchId }),
      });
      const data = await res.json();
      if (!res.ok) {
        // 对决已被取消 → 立即从本地列表移除
        if (res.status === 404) {
          setWaiting((prev) => prev.filter((m) => m.id !== matchId));
        }
        alert(data.error || "加入失败");
        return;
      }
      // 检查是否是自动结算的游戏（dice）
      if (data.result) {
        setMatchResult(data.result);
        setActiveMatch(data.match);
      } else {
        setActiveMatch(data.match);
        setMatchResult(null);
        setRpsMove(null);
        setRpsSubmitted(false);
        setMathAnswer("");
      }
      fetchLobby();
      window.dispatchEvent(new Event("task-completed"));
    } catch {
      alert("网络错误");
    } finally {
      setJoining(null);
    }
  };

  // ── 提交 RPS ──
  const handleRpsSubmit = async (move: string) => {
    if (rpsSubmitted || !activeMatch) return;
    setRpsMove(move);
    setRpsSubmitted(true);
    setSubmitting(true);
    try {
      const res = await fetch("/api/pvp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "submit", matchId: activeMatch.id, move }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "提交失败");
        setRpsSubmitted(false);
        return;
      }
      if (data.result) {
        setMatchResult(data.result);
        if (data.newGold !== undefined) {
          window.dispatchEvent(new Event("task-completed"));
        }
      }
    } catch {
      alert("网络错误");
      setRpsSubmitted(false);
    } finally {
      setSubmitting(false);
    }
  };

  // ── 提交 Math ──
  const handleMathSubmit = async () => {
    if (!activeMatch) return;
    const a = Number(mathAnswer);
    if (isNaN(a)) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/pvp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "submit",
          matchId: activeMatch.id,
          answer: a,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "提交失败");
        return;
      }
      if (data.result) {
        setMatchResult(data.result);
        if (data.newGold !== undefined) {
          window.dispatchEvent(new Event("task-completed"));
        }
      }
    } catch {
      alert("网络错误");
    } finally {
      setSubmitting(false);
    }
  };

  // ── 解析 math 题目 ──
  const getMathProblem = () => {
    if (!activeMatch?.result) return null;
    try {
      const raw = typeof activeMatch.result === "string" ? activeMatch.result : JSON.stringify(activeMatch.result);
      const p = JSON.parse(raw);
      if (p.a !== undefined && p.b !== undefined && p.op && !p.resolved) return p;
    } catch { /* ignore */ }
    return null;
  };

  const mathProblem = getMathProblem();

  // ── 离开/取消对决 ──
  const handleLeave = async () => {
    // 如果是等待中的对决且是创建者 → 取消并退款
    if (activeMatch && !activeMatch.player2Id && activeMatch.status === "waiting") {
      await fetch("/api/pvp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel", matchId: activeMatch.id }),
      });
    }
    setActiveMatch(null);
    setMatchResult(null);
    setRpsMove(null);
    setRpsSubmitted(false);
    setMathAnswer("");
    fetchLobby();
  };

  // ── 放弃对决 ──
  const handleForfeit = async () => {
    if (!activeMatch) return;
    const res = await fetch("/api/pvp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "forfeit", matchId: activeMatch.id }),
    });
    if (res.ok) {
      const data = await res.json();
      setMatchResult(data.result);
      setActiveMatch((prev) => prev ? { ...prev, status: "completed" } : null);
      if (data.newGold !== undefined) window.dispatchEvent(new Event("task-completed"));
    }
  };

  // ── 格式化时间 ──
  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60000) return "刚刚";
    if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
    return d.toLocaleDateString("zh-CN");
  };

  return (
    <>
      {/* ── 触发按钮 ── */}
      <Dialog open={open} onOpenChange={async (v) => {
        if (!v && activeMatch && !activeMatch.player2Id && activeMatch.status === "waiting") {
          // 关闭对话框时自动取消等待中的对决
          await fetch("/api/pvp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "cancel", matchId: activeMatch.id }),
          });
          window.dispatchEvent(new Event("task-completed"));
        }
        handleOpenChange(v);
        if (!v) {
          setActiveMatch(null);
          setMatchResult(null);
          setRpsMove(null);
          setRpsSubmitted(false);
          setMathAnswer("");
        }
      }}>
        {isControlled ? null : (
          <DialogTrigger
            render={
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="flex items-center gap-2 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-lg shadow-orange-600/20 transition-all"
              >
                <Swords className="w-4 h-4" />
                PvP 竞技场
              </motion.button>
            }
          />
        )}

        <DialogContent className="sm:max-w-[560px] max-h-[85vh] overflow-y-auto bg-gradient-to-b from-gray-900 to-gray-950 border-gray-800 text-gray-100 p-0 gap-0">
          <div className="sticky top-0 z-10 bg-gray-900/95 backdrop-blur border-b border-gray-800 px-6 py-4">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
                <Swords className="w-5 h-5 text-orange-400" />
                PvP 竞技场
              </DialogTitle>
            </DialogHeader>
          </div>

          <div className="px-6 py-4 space-y-4">
            {/* ── 活跃对决 ── */}
            {activeMatch && !matchResult && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-gray-800/50 border border-orange-500/30 rounded-xl p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-orange-400 flex items-center gap-1">
                    {GAME_TYPES[activeMatch.type]?.icon}
                    {GAME_TYPES[activeMatch.type]?.name}
                  </span>
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <Coins className="w-3 h-3" /> 赌注 {activeMatch.bet}G
                  </span>
                </div>

                {/* ═══ 等待对手加入 ═══ */}
                {!activeMatch.player2Id && (
                  <div className="text-center py-6 space-y-3">
                    <motion.div
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                      className="text-4xl"
                    >
                      ⏳
                    </motion.div>
                    <p className="text-sm text-gray-300">等待对手加入...</p>
                    <p className="text-xs text-gray-500">5 分钟后无人加入将自动取消</p>
                    <button
                      onClick={handleLeave}
                      className="text-xs text-red-400/70 hover:text-red-400 transition-colors py-1"
                    >
                      取消对决（退还 {activeMatch.bet}G）
                    </button>
                  </div>
                )}

                {/* ═══ 对手已加入 — RPS ═══ */}
                {activeMatch.player2Id && activeMatch.type === "rps" && (
                  <div className="space-y-3">
                    <p className="text-sm text-gray-300 text-center">
                      {rpsSubmitted
                        ? "等待对手出拳..."
                        : "选择你的出拳："}
                    </p>
                    <div className="flex justify-center gap-3">
                      {(["rock", "paper", "scissors"] as const).map((m) => (
                        <motion.button
                          key={m}
                          whileHover={rpsSubmitted ? {} : { scale: 1.1 }}
                          whileTap={rpsSubmitted ? {} : { scale: 0.9 }}
                          disabled={rpsSubmitted || submitting}
                          onClick={() => handleRpsSubmit(m)}
                          className={`w-20 h-20 rounded-xl text-3xl flex flex-col items-center justify-center gap-1 border-2 transition-all ${
                            rpsMove === m
                              ? "border-orange-400 bg-orange-500/20"
                              : rpsSubmitted
                              ? "border-gray-700 bg-gray-800/50 opacity-40"
                              : "border-gray-700 bg-gray-800/50 hover:border-orange-500 hover:bg-gray-700/50 cursor-pointer"
                          }`}
                        >
                          {RPS_EMOJI[m]}
                          <span className="text-[10px] text-gray-400">
                            {RPS_NAMES[m]}
                          </span>
                        </motion.button>
                      ))}
                    </div>
                  </div>
                )}

                {/* ═══ 对手已加入 — Dice ═══ */}
                {activeMatch.player2Id && activeMatch.type === "dice" && (
                  <div className="space-y-3 text-center">
                    <motion.div
                      key="rolling"
                      initial={{ rotate: 0, scale: 1 }}
                      animate={{ rotate: [0, -30, 20, -10, 0], scale: [1, 1.15, 1] }}
                      transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
                      className="text-5xl inline-block"
                    >
                      🎲
                    </motion.div>
                    <p className="text-sm text-gray-300">骰子已投掷，对决中...</p>
                  </div>
                )}

                {/* ═══ 对手已加入 — Math ═══ */}
                {activeMatch.player2Id && activeMatch.type === "math" && mathProblem && (
                  <div className="space-y-3">
                    <motion.p
                      key={mathProblem.a + mathProblem.op + mathProblem.b}
                      initial={{ scale: 1.2, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="text-lg font-bold text-center text-white"
                    >
                      ⏱ {mathProblem.a} {mathProblem.op === "+" ? "+" : "−"} {mathProblem.b} = ?
                    </motion.p>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={mathAnswer}
                        onChange={(e) => setMathAnswer(e.target.value)}
                        placeholder="输入答案..."
                        className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500"
                        autoFocus
                      />
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleMathSubmit}
                        disabled={submitting || !mathAnswer}
                        className="px-4 py-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-semibold transition-colors"
                      >
                        {submitting ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          "提交"
                        )}
                      </motion.button>
                    </div>
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  {activeMatch.player2Id && (
                    <button
                      onClick={handleForfeit}
                      className="flex-1 text-xs text-red-400/60 hover:text-red-400 transition-colors py-1"
                    >
                      放弃对决
                    </button>
                  )}
                  <button
                    onClick={handleLeave}
                    className="flex-1 text-xs text-gray-500 hover:text-gray-300 transition-colors py-1"
                  >
                    离开
                  </button>
                </div>
              </motion.div>
            )}

            {/* ── 对决结果 ── */}
            {matchResult && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`rounded-xl p-4 space-y-2 border ${
                  matchResult.winner
                    ? "bg-gradient-to-b from-yellow-900/30 to-yellow-950/30 border-yellow-600/30"
                    : "bg-gray-800/30 border-gray-700/30"
                }`}
              >
                {matchResult.winner ? (
                  <div className="text-center space-y-2">
                    <Trophy className="w-8 h-8 text-yellow-400 mx-auto" />
                    <p className="text-lg font-bold text-yellow-300">
                      {currentUserId && matchResult.winnerId === currentUserId
                        ? "🎉 你赢了！"
                        : `💀 你输了，${matchResult.winner} 获胜`}
                    </p>
                    {matchResult.prize !== undefined && (
                      <p className="text-sm text-gray-300">
                        赢得 <span className="text-yellow-400 font-bold">{matchResult.prize}G</span>
                        （税收 {2}G）
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-center text-gray-400">{matchResult.message || "平局"}</p>
                )}

                {/* RPS 结果细节 */}
                {matchResult.player1Move && matchResult.player2Move && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="flex justify-center items-center gap-4 text-sm"
                  >
                    <motion.span
                      initial={{ rotate: -30, scale: 0 }}
                      animate={{ rotate: 0, scale: 1 }}
                      transition={{ delay: 0.3, type: "spring" }}
                      className="text-gray-300"
                    >
                      {RPS_EMOJI[matchResult.player1Move]} {RPS_NAMES[matchResult.player1Move]}
                    </motion.span>
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.6, type: "spring", stiffness: 300 }}
                      className="text-gray-500 font-bold text-lg"
                    >
                      VS
                    </motion.span>
                    <motion.span
                      initial={{ rotate: 30, scale: 0 }}
                      animate={{ rotate: 0, scale: 1 }}
                      transition={{ delay: 0.9, type: "spring" }}
                      className="text-gray-300"
                    >
                      {RPS_EMOJI[matchResult.player2Move]} {RPS_NAMES[matchResult.player2Move]}
                    </motion.span>
                  </motion.div>
                )}

                {/* Dice 结果细节 */}
                {matchResult.player1Roll !== undefined && matchResult.player2Roll !== undefined && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="space-y-3"
                  >
                    <motion.div
                      animate={{ rotate: [0, 360, 720] }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                      className="text-3xl text-center"
                    >
                      🎲
                    </motion.div>
                    <div className="flex justify-center items-center gap-6 text-sm">
                      <motion.span
                        initial={{ x: -30, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: 0.3 }}
                        className="text-gray-300"
                      >
                        🎲 {matchResult.player1Roll}
                      </motion.span>
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.5, type: "spring", stiffness: 300 }}
                        className="text-gray-500 font-bold text-lg"
                      >
                        VS
                      </motion.span>
                      <motion.span
                        initial={{ x: 30, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: 0.3 }}
                        className="text-gray-300"
                      >
                        🎲 {matchResult.player2Roll}
                      </motion.span>
                    </div>
                  </motion.div>
                )}

                {/* Math 结果细节 */}
                {matchResult.correctAnswer !== undefined && (
                  <div className="text-center text-sm space-y-1">
                    <p className="text-gray-400">
                      正确答案：<span className="text-green-400 font-bold">{matchResult.correctAnswer}</span>
                    </p>
                    {matchResult.yourAnswer !== undefined && (
                      <p className="text-gray-500">
                        你的答案：{matchResult.yourAnswer}
                      </p>
                    )}
                  </div>
                )}

                <button
                  onClick={handleLeave}
                  className="w-full mt-2 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm font-semibold transition-colors"
                >
                  返回大厅
                </button>
              </motion.div>
            )}

            {/* ── 等待中的对决 ── */}
            {!activeMatch && !matchResult && (
              <>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    等待挑战
                  </h3>
                  <Dialog open={createOpen} onOpenChange={(v) => { setCreateOpen(v); setCreateError(""); }}>
                    <DialogTrigger
                      render={
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className="flex items-center gap-1 bg-orange-600 hover:bg-orange-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                          创建对决
                        </motion.button>
                      }
                    />

                    <DialogContent className="sm:max-w-[400px] bg-gray-900 border-gray-800 text-gray-100">
                      <DialogHeader>
                        <DialogTitle className="text-white">创建 PvP 对决</DialogTitle>
                      </DialogHeader>

                      <div className="space-y-4">
                        {/* 游戏类型 */}
                        <div className="space-y-2">
                          <label className="text-sm text-gray-400">游戏类型</label>
                          <div className="grid grid-cols-3 gap-2">
                            {Object.entries(GAME_TYPES).map(([key, val]) => (
                              <motion.button
                                key={key}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => setGameType(key)}
                                className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 text-xs transition-all ${
                                  gameType === key
                                    ? "border-orange-500 bg-orange-500/10 text-orange-300"
                                    : "border-gray-700 bg-gray-800/50 text-gray-400 hover:border-gray-600"
                                }`}
                              >
                                {val.icon}
                                <span className="font-semibold">{val.name}</span>
                              </motion.button>
                            ))}
                          </div>
                        </div>

                        {/* 赌注 */}
                        <div className="space-y-2">
                          <label className="text-sm text-gray-400 flex items-center gap-1">
                            <Coins className="w-3 h-3" />
                            赌注金额 (10-500G)
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min={10}
                              max={500}
                              step={10}
                              value={bet}
                              onChange={(e) => setBet(Number(e.target.value))}
                              className="flex-1 accent-orange-500"
                            />
                            <span className="text-sm font-bold text-orange-400 w-16 text-right">
                              {bet}G
                            </span>
                          </div>
                          <div className="flex gap-1">
                            {[20, 50, 100, 200].map((b) => (
                              <button
                                key={b}
                                onClick={() => setBet(b)}
                                className={`px-2 py-0.5 rounded text-[10px] transition-colors ${
                                  bet === b
                                    ? "bg-orange-600 text-white"
                                    : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                                }`}
                              >
                                {b}G
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* 规则提示 */}
                        <div className="bg-gray-800/50 rounded-lg p-3 text-xs text-gray-500 space-y-1">
                          <p>规则：</p>
                          <ul className="list-disc list-inside space-y-0.5">
                            <li>双方各自出赌注，胜者赢走奖池（扣除 2G 税收）</li>
                            <li>平局则双方金币退还</li>
                            <li>需要今天至少完成 1 个任务才能参与</li>
                            <li>每日最多创建 10 次 PvP 对决</li>
                          </ul>
                        </div>

                        {createError && (
                          <p className="text-red-400 text-sm text-center">{createError}</p>
                        )}

                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={handleCreate}
                          disabled={creating}
                          className="w-full py-2.5 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white rounded-xl font-semibold text-sm disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                        >
                          {creating ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Swords className="w-4 h-4" />
                          )}
                          创建对决（-{bet}G）
                        </motion.button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>

                {/* 等待列表 */}
                {loading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 text-gray-500 animate-spin" />
                  </div>
                ) : waiting.length === 0 ? (
                  <div className="text-center py-8 space-y-2">
                    <Swords className="w-10 h-10 text-gray-700 mx-auto" />
                    <p className="text-sm text-gray-500">暂无等待中的对决</p>
                    <p className="text-xs text-gray-600">创建一个对决来挑战其他勇者吧！</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {waiting.map((m) => (
                      <motion.div
                        key={m.id}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center justify-between bg-gray-800/40 border border-gray-700/50 rounded-xl p-2.5 md:p-3 hover:border-gray-600/50 transition-colors"
                      >
                        <div className="flex items-center gap-2 md:gap-3 min-w-0">
                          <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-gray-700/50 flex items-center justify-center shrink-0 text-sm">
                            {GAME_TYPES[m.type]?.icon}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-200 truncate">
                              {GAME_TYPES[m.type]?.name}
                            </p>
                            <p className="text-[11px] md:text-xs text-gray-500 flex items-center gap-1">
                              <User className="w-3 h-3" />
                              <span className="truncate max-w-[80px] md:max-w-none">{m.creatorName}</span>
                              <span className="mx-0.5">·</span>
                              <Coins className="w-3 h-3" />
                              {m.bet}G
                            </p>
                          </div>
                        </div>
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handleJoin(m.id)}
                          disabled={joining === m.id}
                          className="shrink-0 ml-2 md:ml-3 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white px-2.5 md:px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1"
                        >
                          {joining === m.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : null}
                          挑战
                        </motion.button>
                      </motion.div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* ── 最近战报 ── */}
            {!activeMatch && !matchResult && recent.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-1">
                  <Trophy className="w-4 h-4 text-yellow-500" />
                  最近战报
                </h3>
                <div className="space-y-1 max-h-[200px] overflow-y-auto">
                  {recent.map((m) => {
                    const hasWinner = !!m.winnerName;
                    const typeInfo = GAME_TYPES[m.type];
                    return (
                      <div
                        key={m.id}
                        className="flex items-center gap-2 text-xs text-gray-500 bg-gray-800/20 rounded-lg px-3 py-2"
                      >
                        <span className="shrink-0">{typeInfo?.icon}</span>
                        <span className="truncate">
                          {hasWinner ? (
                            <>
                              <span className="text-yellow-400 font-semibold">{m.winnerName}</span>
                              <span> 击败了 </span>
                              <span className="text-gray-400">{m.winnerName === m.player1Name ? m.player2Name : m.player1Name}</span>
                            </>
                          ) : (
                            <span className="text-gray-500">{m.player1Name} vs {m.player2Name} - 平局</span>
                          )}
                        </span>
                        <span className="shrink-0 text-yellow-600 ml-auto">
                          {hasWinner ? `+${(m.bet || 0) * 2 - 2}G` : "0G"}
                        </span>
                        <span className="shrink-0 text-gray-600">{formatTime(m.createdAt)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 底部提示 */}
            {!activeMatch && !matchResult && (
              <p className="text-center text-[10px] text-gray-600 pt-2">
                数据每 1.5 秒自动刷新 · 平局无税收
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
