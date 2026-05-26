"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import {
  Swords,
  Dice1,
  Calculator,
  Plus,
  Loader2,
  Coins,
  Clock,
  User,
  Trophy,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// ── Types ──

type GameType = "rps" | "dice" | "math";
type PvPView = "lobby" | "waiting" | "playing" | "result";

interface WaitingMatch {
  id: number;
  type: GameType;
  bet: number;
  creatorName: string;
  creatorId: number;
  createdAt: string;
}

interface RecentMatch {
  id: number;
  type: GameType;
  bet: number;
  winnerId: number | null;
  winnerName: string | null;
  player1Name: string;
  player2Name: string;
  result: Record<string, unknown> | null;
  createdAt: string;
}

interface MatchData {
  id: number;
  type: GameType;
  bet: number;
  status: string;
  player1Id: number;
  player2Id: number | null;
  result: string | null;
  winnerId: number | null;
  createdAt: string;
  player1Name: string;
  player2Name: string | null;
}

interface MatchStatus {
  match: MatchData;
  isPlayer1: boolean;
  opponentName: string;
  timeout?: boolean;
}

interface MatchResult2 {
  winner: string | null;
  winnerId: number | null;
  message?: string;
  prize?: number;
  player1Move?: string;
  player2Move?: string;
  player1Roll?: number;
  player2Roll?: number;
  correctAnswer?: number;
  yourAnswer?: number;
  forfeit?: boolean;
  draw?: boolean;
  timeout?: boolean;
  ties?: number;
}

// ── Game type config ──

const GAME_TYPES: Record<
  string,
  { name: string; icon: React.ReactNode; desc: string }
> = {
  rps: {
    name: "石头剪刀布",
    icon: <span className="text-lg">✊</span>,
    desc: "经典猜拳对决",
  },
  dice: {
    name: "骰子对决",
    icon: <Dice1 className="w-4 h-4" />,
    desc: "D20 骰子比拼运气",
  },
  math: {
    name: "速算对决",
    icon: <Calculator className="w-4 h-4" />,
    desc: "心算速度比拼",
  },
};

const RPS_EMOJI: Record<string, string> = {
  rock: "✊",
  paper: "✋",
  scissors: "✌️",
};
const RPS_NAMES: Record<string, string> = {
  rock: "石头",
  paper: "布",
  scissors: "剪刀",
};

// ── Helpers ──

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return "刚刚";
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
  return d.toLocaleDateString("zh-CN");
}

function parseMatchResult(
  match: MatchData | null
): Record<string, unknown> {
  if (!match?.result) return {};
  try {
    return JSON.parse(match.result) as Record<string, unknown>;
  } catch {
    return {};
  }
}

// ── Component ──

export function PvPArena({
  open: controlledOpen,
  onOpenChange: controlledOnChange,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
} = {}) {
  const isControlled = controlledOpen !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isControlled ? controlledOpen : internalOpen;
  const handleOpenChange = (v: boolean) => {
    if (isControlled) {
      controlledOnChange?.(v);
    } else {
      setInternalOpen(v);
    }
  };
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);

  // View state machine
  const [view, setView] = useState<PvPView>("lobby");
  const [activeMatch, setActiveMatch] = useState<MatchData | null>(null);
  const [matchResult, setMatchResult] = useState<MatchResult2 | null>(null);

  // Lobby data
  const [waiting, setWaiting] = useState<WaitingMatch[]>([]);
  const [recent, setRecent] = useState<RecentMatch[]>([]);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [gameType, setGameType] = useState<GameType>("rps");
  const [bet, setBet] = useState(20);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  // Joining
  const [joining, setJoining] = useState<number | null>(null);

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // RPS
  const [rpsMove, setRpsMove] = useState<string | null>(null);

  // Math
  const [mathAnswer, setMathAnswer] = useState("");

  // Dice animation
  const [showDiceAnim, setShowDiceAnim] = useState(false);

  // Polling refs
  const lobbyPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const statusPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Fetch lobby data ──
  const fetchLobby = useCallback(async () => {
    try {
      const res = await fetch("/api/pvp");
      if (!res.ok) return;
      const data = await res.json();
      setWaiting(data.waiting || []);
      setRecent(data.recent || []);
    } catch {
      // silent
    }
  }, []);

  // ── Fetch match status (polling) ──
  const fetchStatus = useCallback(async () => {
    if (!activeMatch) return;
    try {
      const res = await fetch(
        `/api/pvp?action=status&matchId=${activeMatch.id}`
      );
      if (!res.ok) return;
      const data: MatchStatus = await res.json();

      // Timeout
      if (data.timeout) {
        setMatchResult({
          winner: null,
          winnerId: null,
          message: "超时未提交，对决已取消，金币已退还",
          timeout: true,
        });
        setView("result");
        return;
      }

      // Match completed
      if (data.match.status === "completed") {
        setActiveMatch(data.match);
        const parsed = parseMatchResult(data.match);
        setMatchResult({
          winner: data.match.winnerId
            ? data.match.player1Id === data.match.winnerId
              ? data.match.player1Name
              : data.match.player2Name
            : null,
          winnerId: data.match.winnerId,
          prize:
            data.match.winnerId != null
              ? data.match.bet * 2 - 2
              : undefined,
          player1Move: parsed.player1Move as string | undefined,
          player2Move: parsed.player2Move as string | undefined,
          player1Roll: parsed.player1Roll as number | undefined,
          player2Roll: parsed.player2Roll as number | undefined,
          correctAnswer: parsed.correctAnswer as number | undefined,
          yourAnswer: parsed.submittedAnswer as number | undefined,
          ties: parsed.ties as number | undefined,
          forfeit: parsed.forfeit as boolean | undefined,
          draw: parsed.draw as boolean | undefined,
          message: parsed.forfeit
            ? "对手放弃了对决"
            : parsed.draw
            ? (parsed.message as string) || "平局！金币已退还"
            : undefined,
        });
        setView("result");
        return;
      }

      // Match cancelled
      if (data.match.status === "cancelled") {
        setMatchResult({
          winner: null,
          winnerId: null,
          message: "对决已被取消，金币已退还",
        });
        setView("result");
        return;
      }

      // Opponent joined (transition from waiting to playing)
      if (data.match.player2Id && view === "waiting") {
        setActiveMatch(data.match);
        setView("playing");
        setSubmitted(false);
        setRpsMove(null);
        setMathAnswer("");
        // Check if already has a submission (RPS)
        const parsed2 = parseMatchResult(data.match);
        if (data.match.type === "rps" && data.isPlayer1 && parsed2.player1Move) {
          setSubmitted(true);
          setRpsMove(parsed2.player1Move as string);
        }
        if (data.match.type === "rps" && !data.isPlayer1 && parsed2.player2Move) {
          setSubmitted(true);
          setRpsMove(parsed2.player2Move as string);
        }
        return;
      }

      // Update active match if status changed
      if (
        data.match.status !== activeMatch.status ||
        data.match.player2Id !== activeMatch.player2Id
      ) {
        setActiveMatch(data.match);
      }
    } catch {
      // silent
    }
  }, [activeMatch, view]);

  // ── User ID on dialog open ──
  useEffect(() => {
    if (open) {
      fetch("/api/user")
        .then((r) => r.json())
        .then((u) => setCurrentUserId(u.id))
        .catch(() => {});
    }
  }, [open]);

  // ── Lobby polling ──
  useEffect(() => {
    if (open && view === "lobby") {
      fetchLobby();
      lobbyPollRef.current = setInterval(fetchLobby, 2000);
    }
    return () => {
      if (lobbyPollRef.current) {
        clearInterval(lobbyPollRef.current);
        lobbyPollRef.current = null;
      }
    };
  }, [open, view, fetchLobby]);

  // ── Status polling ──
  useEffect(() => {
    if (activeMatch && (view === "waiting" || submitted)) {
      fetchStatus();
      statusPollRef.current = setInterval(fetchStatus, 500);
    }
    return () => {
      if (statusPollRef.current) {
        clearInterval(statusPollRef.current);
        statusPollRef.current = null;
      }
    };
  }, [activeMatch, view, submitted, fetchStatus]);

  // ── Show dice animation on result ──
  useEffect(() => {
    if (
      matchResult &&
      matchResult.player1Roll !== undefined &&
      matchResult.player2Roll !== undefined
    ) {
      setShowDiceAnim(true);
      const t = setTimeout(() => setShowDiceAnim(false), 1200);
      return () => clearTimeout(t);
    }
  }, [matchResult]);

  // ── Create match ──
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
      setMatchResult(null);
      setView("waiting");
      setSubmitted(false);
      setRpsMove(null);
      setMathAnswer("");
      setCreateOpen(false);
      window.dispatchEvent(new Event("task-completed"));
      window.dispatchEvent(new Event("stats-changed"));
    } catch {
      setCreateError("网络错误");
    } finally {
      setCreating(false);
    }
  };

  // ── Join match ──
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
        if (res.status === 404) {
          setWaiting((prev) => prev.filter((m) => m.id !== matchId));
        }
        alert(data.error || "加入失败");
        return;
      }

      setActiveMatch(data.match);

      if (data.result) {
        setMatchResult(data.result);
        setView("result");
      } else {
        setMatchResult(null);
        setSubmitted(false);
        setRpsMove(null);
        setMathAnswer("");
        setView("playing");
      }

      fetchLobby();
      window.dispatchEvent(new Event("task-completed"));
      window.dispatchEvent(new Event("stats-changed"));
    } catch {
      alert("网络错误");
    } finally {
      setJoining(null);
    }
  };

  // ── Submit RPS move ──
  const handleRpsSubmit = async (move: string) => {
    if (submitted || !activeMatch || submitting) return;
    setRpsMove(move);
    setSubmitted(true);
    setSubmitting(true);
    try {
      const res = await fetch("/api/pvp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "submit",
          matchId: activeMatch.id,
          move,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "提交失败");
        setSubmitted(false);
        return;
      }
      if (data.result) {
        setMatchResult(data.result);
        setView("result");
        if (data.newGold !== undefined) {
          window.dispatchEvent(new Event("task-completed"));
      window.dispatchEvent(new Event("stats-changed"));
        }
        setSubmitted(false);
      }
    } catch {
      alert("网络错误");
      setSubmitted(false);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Submit Math answer ──
  const handleMathSubmit = async () => {
    if (!activeMatch || submitting) return;
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
      setMatchResult(data.result);
      setView("result");
      if (data.newGold !== undefined) {
        window.dispatchEvent(new Event("task-completed"));
      window.dispatchEvent(new Event("stats-changed"));
      }
    } catch {
      alert("网络错误");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Cancel / Leave ──
  const handleLeave = async () => {
    if (
      activeMatch &&
      view === "waiting" &&
      activeMatch.player1Id === currentUserId
    ) {
      await fetch("/api/pvp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "cancel",
          matchId: activeMatch.id,
        }),
      });
      window.dispatchEvent(new Event("task-completed"));
      window.dispatchEvent(new Event("stats-changed"));
    }
    resetState();
    fetchLobby();
  };

  // ── Forfeit ──
  const handleForfeit = async () => {
    if (!activeMatch) return;
    const res = await fetch("/api/pvp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "forfeit",
        matchId: activeMatch.id,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setMatchResult(data.result);
      setView("result");
      setActiveMatch((prev) =>
        prev ? { ...prev, status: "completed" } : null
      );
      if (data.newGold !== undefined) {
        window.dispatchEvent(new Event("task-completed"));
      window.dispatchEvent(new Event("stats-changed"));
      }
    }
  };

  // ── Reset everything ──
  const resetState = () => {
    setActiveMatch(null);
    setMatchResult(null);
    setView("lobby");
    setSubmitted(false);
    setRpsMove(null);
    setMathAnswer("");
  };

  // ── Dialog close handler ──
  const handleDialogClose = (v: boolean) => {
    if (!v) {
      if (
        activeMatch &&
        view === "waiting" &&
        activeMatch.player1Id === currentUserId
      ) {
        fetch("/api/pvp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "cancel",
            matchId: activeMatch.id,
          }),
        }).catch(() => {});
        window.dispatchEvent(new Event("task-completed"));
      window.dispatchEvent(new Event("stats-changed"));
      }
      resetState();
    }
    handleOpenChange(v);
  };

  // ── Derived state ──
  const mathProblem =
    activeMatch?.type === "math"
      ? parseMatchResult(activeMatch)
      : null;
  const hasMathProblem =
    mathProblem &&
    mathProblem.a !== undefined &&
    mathProblem.b !== undefined &&
    mathProblem.op &&
    !mathProblem.resolved;

  const isWinner =
    matchResult?.winnerId != null &&
    matchResult.winnerId === currentUserId;

  const lobbyMatches = currentUserId
    ? waiting.filter((m) => m.creatorId !== currentUserId)
    : waiting;
  const ownWaitingMatch = currentUserId
    ? waiting.find((m) => m.creatorId === currentUserId)
    : null;

  // ── Playing view renderer ──
  const renderPlayingView = (match: MatchData) => (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-muted/50 border border-orange-500/30 rounded-xl p-4 space-y-3"
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-orange-400 flex items-center gap-1">
          {GAME_TYPES[match.type]?.icon}
          {GAME_TYPES[match.type]?.name}
        </span>
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <Coins className="w-3 h-3" /> 赌注 {match.bet}G
        </span>
      </div>

      <div className="text-center text-sm text-muted-foreground">
        <User className="w-3 h-3 inline mr-1" />
        对手：{match.player2Name ?? "等待中"}
      </div>

      {/* RPS */}
      {match.type === "rps" ? (
        <div className="space-y-3">
          {!submitted ? (
            <>
              <p className="text-sm text-foreground/80 text-center">
                选择你的出拳：
              </p>
              <div className="flex justify-center gap-3">
                {(["rock", "paper", "scissors"] as const).map((m) => (
                  <motion.button
                    key={m}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => handleRpsSubmit(m)}
                    disabled={submitting}
                    className="w-20 h-20 rounded-xl text-3xl flex flex-col items-center justify-center gap-1 border-2 border-border bg-muted/50 hover:border-orange-500 hover:bg-muted/50 cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {RPS_EMOJI[m]}
                    <span className="text-[10px] text-muted-foreground">
                      {RPS_NAMES[m]}
                    </span>
                  </motion.button>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-4 space-y-3">
              <motion.div
                animate={{ scale: [1, 1.15, 1] }}
                transition={{ duration: 1.2, repeat: Infinity }}
                className="text-3xl"
              >
                {rpsMove ? RPS_EMOJI[rpsMove] : "❓"}
              </motion.div>
              <p className="text-sm text-foreground/80">
                已出拳，等待对手...
              </p>
            </div>
          )}
        </div>
      ) : null}

      {/* Dice */}
      {match.type === "dice" ? (
        <div className="text-center py-6 space-y-3">
          <motion.div
            animate={{ rotate: [0, -30, 20, -10, 0] }}
            transition={{ duration: 1.2, repeat: Infinity }}
            className="text-5xl inline-block"
          >
            🎲
          </motion.div>
          <p className="text-sm text-foreground/80">正在与对手对决中...</p>
          <p className="text-xs text-muted-foreground/70">
            骰子结果将在对手加入时自动揭晓
          </p>
        </div>
      ) : null}

      {/* Math */}
      {match.type === "math" && hasMathProblem ? (
        <div className="space-y-3">
          <motion.p
            key={`${mathProblem.a}-${mathProblem.op}-${mathProblem.b}`}
            initial={{ scale: 1.3, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-xl font-bold text-center text-foreground"
          >
            {String(mathProblem.a)}{" "}
            {mathProblem.op === "+" ? "+" : "−"}{" "}
            {String(mathProblem.b)} = ?
          </motion.p>
          <p className="text-xs text-center text-muted-foreground/70">
            先答对者获胜，答错则对手获胜
          </p>
          <div className="flex gap-2">
            <input
              type="number"
              value={mathAnswer}
              onChange={(e) => setMathAnswer(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleMathSubmit();
              }}
              placeholder="输入答案..."
              className="flex-1 bg-muted border border-border rounded-lg px-3 py-2 text-primary-foreground text-sm focus:outline-none focus:border-orange-500"
              autoFocus
              disabled={submitting}
            />
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleMathSubmit}
              disabled={submitting || !mathAnswer}
              className="px-4 py-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground rounded-lg text-sm font-semibold transition-colors"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "提交"
              )}
            </motion.button>
          </div>
        </div>
      ) : null}

      {match.type === "math" && !hasMathProblem ? (
        <div className="text-center py-4 text-sm text-muted-foreground/70">
          等待题目生成...
        </div>
      ) : null}

      <div className="flex gap-2 pt-2 border-t border-border/50">
        <button
          onClick={handleForfeit}
          className="flex-1 text-xs text-red-400/60 hover:text-red-400 transition-colors py-1"
        >
          放弃对决
        </button>
        <button
          onClick={handleLeave}
          className="flex-1 text-xs text-muted-foreground/70 hover:text-foreground/80 transition-colors py-1"
        >
          离开（保持对决）
        </button>
      </div>
    </motion.div>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={handleDialogClose}>
        {!isControlled && (
          <DialogTrigger
            render={
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="flex items-center gap-2 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-primary-foreground px-4 py-2 rounded-xl text-sm font-semibold shadow-lg shadow-orange-600/20 transition-all"
              >
                <Swords className="w-4 h-4" />
                PvP 竞技场
              </motion.button>
          }
        />
        )}

        <DialogContent className="sm:max-w-[560px] max-h-[85vh] overflow-y-auto bg-card border-border text-foreground p-0 gap-0">
          <div className="sticky top-0 z-10 bg-card/95 backdrop-blur border-b border-border px-6 py-4">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-primary-foreground flex items-center gap-2">
                <Swords className="w-5 h-5 text-orange-400" />
                PvP 竞技场
              </DialogTitle>
            </DialogHeader>
          </div>

          <div className="px-6 py-4 space-y-4">
            {/* VIEW: WAITING */}
            {view === "waiting" && activeMatch && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-muted/50 border border-orange-500/30 rounded-xl p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-orange-400 flex items-center gap-1">
                    {GAME_TYPES[activeMatch.type]?.icon}
                    {GAME_TYPES[activeMatch.type]?.name}
                  </span>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Coins className="w-3 h-3" /> 赌注 {activeMatch.bet}G
                  </span>
                </div>

                {(activeMatch.type === "math" && hasMathProblem) ? (
                  <div className="text-center space-y-2 mb-3">
                    <p className="text-xs text-muted-foreground">你的题目：</p>
                    <p className="text-xl font-bold text-foreground">{String((mathProblem as any).a)} {String((mathProblem as any).op) === "+" ? "+" : "−"} {String((mathProblem as any).b)} = ?</p>
                  </div>
                ) : null}
                {(activeMatch.type === "dice" && (mathProblem as any)?.player1Roll != null) ? (
                  <div className="text-center space-y-2 mb-3">
                    <p className="text-xs text-muted-foreground">你的骰子：</p>
                    <p className="text-xl font-bold text-foreground">🎲 {String((mathProblem as any).player1Roll)}</p>
                  </div>
                ) : null}

                <div className="text-center py-4 space-y-3">
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="text-4xl"
                  >
                    ⏳
                  </motion.div>
                  <p className="text-sm text-foreground/80">等待对手加入...</p>
                  <p className="text-xs text-muted-foreground/70">
                    对决 #{activeMatch.id}
                    {" · "}5 分钟后无人加入将自动取消
                  </p>
                  <button
                    onClick={handleLeave}
                    className="text-xs text-red-400/70 hover:text-red-400 transition-colors py-1"
                  >
                    取消对决（退还 {activeMatch.bet}G）
                  </button>
                </div>
              </motion.div>
            )}

            {/* VIEW: PLAYING */}
            {view === "playing" && activeMatch &&
              renderPlayingView(activeMatch)}

            {/* VIEW: RESULT */}
            {view === "result" && matchResult && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`rounded-xl p-4 space-y-3 border ${
                  isWinner
                    ? "bg-gradient-to-b from-yellow-900/30 to-yellow-950/30 border-yellow-600/30"
                    : matchResult.winner == null
                    ? "bg-muted/30 border-border/30"
                    : "bg-muted/30 border-red-800/30"
                }`}
              >
                <div className="text-center space-y-2">
                  {isWinner ? (
                    <>
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 300, delay: 0.1 }}
                      >
                        <Trophy className="w-10 h-10 text-yellow-400 mx-auto" />
                      </motion.div>
                      <motion.p
                        initial={{ y: 10, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="text-lg font-bold text-yellow-300"
                      >
                        你赢了！
                      </motion.p>
                      {matchResult.prize !== undefined && (
                        <motion.p
                          initial={{ y: 10, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          transition={{ delay: 0.3 }}
                          className="text-sm text-foreground/80"
                        >
                          赢得{" "}
                          <span className="text-yellow-400 font-bold">
                            {matchResult.prize}G
                          </span>{" "}
                          （税收 2G）
                        </motion.p>
                      )}
                    </>
                  ) : matchResult.winner == null ? (
                    <>
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
                      >
                        <AlertTriangle className="w-10 h-10 text-muted-foreground mx-auto" />
                      </motion.div>
                      <motion.p
                        initial={{ y: 10, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="text-base font-semibold text-foreground/80"
                      >
                        {matchResult.message || "平局！金币已退还"}
                      </motion.p>
                    </>
                  ) : (
                    <>
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
                        className="text-4xl"
                      >
                        💀
                      </motion.div>
                      <motion.p
                        initial={{ y: 10, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="text-base font-semibold text-foreground/80"
                      >
                        你输了，{matchResult.winner} 获胜
                      </motion.p>
                    </>
                  )}
                </div>

                {/* RPS detail */}
                {matchResult.player1Move && matchResult.player2Move && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="flex justify-center items-center gap-4 text-sm"
                  >
                    <motion.span
                      initial={{ rotate: -30, scale: 0 }}
                      animate={{ rotate: 0, scale: 1 }}
                      transition={{ delay: 0.4, type: "spring" }}
                      className="text-foreground/80"
                    >
                      {RPS_EMOJI[matchResult.player1Move]}{" "}
                      {RPS_NAMES[matchResult.player1Move]}
                    </motion.span>
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.7, type: "spring", stiffness: 300 }}
                      className="text-muted-foreground/70 font-bold text-lg"
                    >
                      VS
                    </motion.span>
                    <motion.span
                      initial={{ rotate: 30, scale: 0 }}
                      animate={{ rotate: 0, scale: 1 }}
                      transition={{ delay: 1.0, type: "spring" }}
                      className="text-foreground/80"
                    >
                      {RPS_EMOJI[matchResult.player2Move]}{" "}
                      {RPS_NAMES[matchResult.player2Move]}
                    </motion.span>
                  </motion.div>
                )}

                {/* Dice detail */}
                {matchResult.player1Roll !== undefined &&
                  matchResult.player2Roll !== undefined && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.3 }}
                      className="space-y-3"
                    >
                      <motion.div
                        animate={
                          showDiceAnim
                            ? { rotate: [0, 360, 720], scale: [1, 1.2, 1] }
                            : {}
                        }
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        className="text-4xl text-center"
                      >
                        🎲
                      </motion.div>
                      <div className="flex justify-center items-center gap-6 text-sm">
                        <motion.span
                          initial={{ x: -30, opacity: 0 }}
                          animate={{ x: 0, opacity: 1 }}
                          transition={{ delay: 0.4 }}
                          className="text-foreground/80"
                        >
                          🎲 {matchResult.player1Roll}
                        </motion.span>
                        <motion.span
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: 0.6, type: "spring", stiffness: 300 }}
                          className="text-muted-foreground/70 font-bold text-lg"
                        >
                          VS
                        </motion.span>
                        <motion.span
                          initial={{ x: 30, opacity: 0 }}
                          animate={{ x: 0, opacity: 1 }}
                          transition={{ delay: 0.4 }}
                          className="text-foreground/80"
                        >
                          🎲 {matchResult.player2Roll}
                        </motion.span>
                      </div>
                      {matchResult.ties != null && matchResult.ties > 1 && (
                        <p className="text-xs text-center text-muted-foreground/70">
                          平局 {matchResult.ties} 次，已重掷
                        </p>
                      )}
                    </motion.div>
                  )}

                {/* Math detail */}
                {matchResult.correctAnswer !== undefined && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="text-center text-sm space-y-1 bg-muted/40 rounded-lg py-2"
                  >
                    <p className="text-muted-foreground">
                      正确答案：{" "}
                      <span className="text-green-400 font-bold">
                        {matchResult.correctAnswer}
                      </span>
                    </p>
                    {matchResult.yourAnswer !== undefined && (
                      <p
                        className={
                          matchResult.yourAnswer === matchResult.correctAnswer
                            ? "text-green-400"
                            : "text-red-400"
                        }
                      >
                        你的答案：{matchResult.yourAnswer}{" "}
                        {matchResult.yourAnswer === matchResult.correctAnswer
                          ? "✓"
                          : "✗"}
                      </p>
                    )}
                  </motion.div>
                )}

                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    resetState();
                    fetchLobby();
                  }}
                  className="w-full py-2.5 bg-muted hover:bg-accent text-foreground rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-1"
                >
                  <CheckCircle className="w-4 h-4" />
                  返回大厅
                </motion.button>
              </motion.div>
            )}

            {/* VIEW: LOBBY */}
            {view === "lobby" && (
              <>
                {/* Own waiting match (resume) */}
                {ownWaitingMatch && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-3 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 text-orange-400 animate-spin" />
                      <span className="text-sm text-orange-300">
                        你有一个等待中的对决
                      </span>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={async () => {
                        try {
                          const res = await fetch(
                            `/api/pvp?action=status&matchId=${ownWaitingMatch.id}`
                          );
                          if (!res.ok) { fetchLobby(); return; }
                          const data: MatchStatus = await res.json();
                          setActiveMatch(data.match);
                          if (data.match.status === "waiting") {
                            setView("waiting");
                          } else if (data.match.status === "playing") {
                            setView("playing");
                          } else if (data.match.status === "completed") {
                            const parsed3 = parseMatchResult(data.match);
                            setMatchResult({
                              winner: data.match.winnerId
                                ? data.match.winnerId === currentUserId
                                  ? data.match.player1Name
                                  : data.match.player2Name
                                : null,
                              winnerId: data.match.winnerId,
                              prize:
                                data.match.winnerId != null
                                  ? data.match.bet * 2 - 2
                                  : undefined,
                              player1Move: parsed3.player1Move as string | undefined,
                              player2Move: parsed3.player2Move as string | undefined,
                              player1Roll: parsed3.player1Roll as number | undefined,
                              player2Roll: parsed3.player2Roll as number | undefined,
                              correctAnswer: parsed3.correctAnswer as number | undefined,
                              yourAnswer: parsed3.submittedAnswer as number | undefined,
                              ties: parsed3.ties as number | undefined,
                              forfeit: parsed3.forfeit as boolean | undefined,
                            });
                            setView("result");
                          }
                        } catch { fetchLobby(); }
                      }}
                      className="bg-orange-600 hover:bg-orange-500 text-primary-foreground px-3 py-1 rounded-lg text-xs font-semibold transition-colors"
                    >
                      返回对决
                    </motion.button>
                  </motion.div>
                )}

                {/* Header with create button */}
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground/80 flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    等待挑战
                  </h3>
                  <Dialog
                    open={createOpen}
                    onOpenChange={(v) => {
                      setCreateOpen(v);
                      setCreateError("");
                    }}
                  >
                    <DialogTrigger
                      render={
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className="flex items-center gap-1 bg-orange-600 hover:bg-orange-500 text-primary-foreground px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                          创建对决
                        </motion.button>
                      }
                    />

                    <DialogContent className="sm:max-w-[400px] bg-card border-border text-foreground">
                      <DialogHeader>
                        <DialogTitle className="text-primary-foreground">
                          创建 PvP 对决
                        </DialogTitle>
                      </DialogHeader>

                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-sm text-muted-foreground">
                            游戏类型
                          </label>
                          <div className="grid grid-cols-3 gap-2">
                            {Object.entries(GAME_TYPES).map(
                              ([key, val]) => (
                                <motion.button
                                  key={key}
                                  whileHover={{ scale: 1.02 }}
                                  whileTap={{ scale: 0.98 }}
                                  onClick={() =>
                                    setGameType(key as GameType)
                                  }
                                  className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 text-xs transition-all ${
                                    gameType === key
                                      ? "border-orange-500 bg-orange-500/10 text-orange-300"
                                      : "border-border bg-muted/50 text-muted-foreground hover:border-gray-600"
                                  }`}
                                >
                                  {val.icon}
                                  <span className="font-semibold">
                                    {val.name}
                                  </span>
                                </motion.button>
                              )
                            )}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm text-muted-foreground flex items-center gap-1">
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
                              onChange={(e) =>
                                setBet(Number(e.target.value))
                              }
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
                                    ? "bg-orange-600 text-primary-foreground"
                                    : "bg-muted text-muted-foreground hover:bg-muted"
                                }`}
                              >
                                {b}G
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground/70 space-y-1">
                          <p>规则：</p>
                          <ul className="list-disc list-inside space-y-0.5">
                            <li>
                              双方各自出赌注，胜者赢走奖池（扣除
                              2G 税收）
                            </li>
                            <li>平局则双方金币退还</li>
                            <li>
                              需要今天至少完成 1 个任务才能参与
                            </li>
                            <li>
                              每日最多创建 10 次 PvP 对决
                            </li>
                          </ul>
                        </div>

                        {createError && (
                          <p className="text-red-400 text-sm text-center">
                            {createError}
                          </p>
                        )}

                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={handleCreate}
                          disabled={creating}
                          className="w-full py-2.5 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-primary-foreground rounded-xl font-semibold text-sm disabled:opacity-50 transition-all flex items-center justify-center gap-2"
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

                {/* Waiting matches list */}
                {lobbyMatches.length === 0 ? (
                  <div className="text-center py-8 space-y-2">
                    <Swords className="w-10 h-10 text-gray-700 mx-auto" />
                    <p className="text-sm text-muted-foreground/70">
                      暂无等待中的对决
                    </p>
                    <p className="text-xs text-gray-600">
                      创建一个对决来挑战其他勇者吧！
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {lobbyMatches.map((m) => (
                      <motion.div
                        key={m.id}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center justify-between bg-muted/40 border border-border/50 rounded-xl p-2.5 md:p-3 hover:border-gray-600/50 transition-colors"
                      >
                        <div className="flex items-center gap-2 md:gap-3 min-w-0">
                          <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-muted/50 flex items-center justify-center shrink-0 text-sm">
                            {GAME_TYPES[m.type]?.icon}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">
                              {GAME_TYPES[m.type]?.name}
                            </p>
                            <p className="text-[11px] md:text-xs text-muted-foreground/70 flex items-center gap-1">
                              <User className="w-3 h-3" />
                              <span className="truncate max-w-[80px] md:max-w-none">
                                {m.creatorName}
                              </span>
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
                          className="shrink-0 ml-2 md:ml-3 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-primary-foreground px-2.5 md:px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1"
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

                {/* Recent results */}
                {recent.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-foreground/80 flex items-center gap-1">
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
                            className="flex items-center gap-2 text-xs text-muted-foreground/70 bg-muted/20 rounded-lg px-3 py-2"
                          >
                            <span className="shrink-0">
                              {typeInfo?.icon}
                            </span>
                            <span className="truncate">
                              {hasWinner ? (
                                <>
                                  <span className="text-yellow-400 font-semibold">
                                    {m.winnerName}
                                  </span>
                                  <span> 击败了 </span>
                                  <span className="text-muted-foreground">
                                    {m.winnerName ===
                                    m.player1Name
                                      ? m.player2Name
                                      : m.player1Name}
                                  </span>
                                </>
                              ) : (
                                <span className="text-muted-foreground/70">
                                  {m.player1Name} vs{" "}
                                  {m.player2Name} - 平局
                                </span>
                              )}
                            </span>
                            <span className="shrink-0 text-yellow-600 ml-auto">
                              {hasWinner
                                ? `+${(m.bet || 0) * 2 - 2}G`
                                : "0G"}
                            </span>
                            <span className="shrink-0 text-gray-600">
                              {formatTime(m.createdAt)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <p className="text-center text-[10px] text-gray-600 pt-2">
                  数据每 2 秒自动刷新 · 平局无税收
                </p>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
