import { NextResponse } from "next/server";
import { and, eq, desc } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getUserId } from "@/lib/auth";
import { checkRate } from "@/lib/rate-limiter";
import { getTodayLocal } from "@/lib/date-utils";

const TAX = 2;
const MATCH_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes for waiting matches
const SUBMIT_TIMEOUT_MS = 30_000; // 30 seconds for submission phase

// ── DB helpers ──

function getUserName(userId: number): string {
  const user = db
    .select({ name: schema.user.name })
    .from(schema.user)
    .where(eq(schema.user.id, userId))
    .get();
  return user?.name ?? "未知勇者";
}

function getUserGold(userId: number): number {
  const user = db
    .select({ gold: schema.user.gold })
    .from(schema.user)
    .where(eq(schema.user.id, userId))
    .get();
  return user?.gold ?? 0;
}

function deductGold(userId: number, amount: number): void {
  db.update(schema.user)
    .set({ gold: getUserGold(userId) - amount })
    .where(eq(schema.user.id, userId))
    .run();
}

function addGold(userId: number, amount: number): void {
  db.update(schema.user)
    .set({ gold: getUserGold(userId) + amount })
    .where(eq(schema.user.id, userId))
    .run();
}

function hasPvpEntryRequirement(userId: number): boolean {
  const today = getTodayLocal();
  const log = db
    .select()
    .from(schema.activityLog)
    .where(
      and(
        eq(schema.activityLog.userId, userId),
        eq(schema.activityLog.date, today)
      )
    )
    .get();
  return !!log;
}

// ── Random utils ──

function rollD20(): number {
  return Math.floor(Math.random() * 20) + 1;
}

function generateMathProblem(): {
  a: number;
  b: number;
  op: string;
  answer: number;
} {
  const a = Math.floor(Math.random() * 90) + 10;
  const b = Math.floor(Math.random() * 90) + 10;
  const op = Math.random() < 0.5 ? "+" : "-";
  const answer = op === "+" ? a + b : a - b;
  return { a, b, op, answer };
}

// ── RPS判定 ──
// 返回: 1 = player1 wins, 2 = player2 wins, 0 = draw
function rpsDecide(m1: string, m2: string): 0 | 1 | 2 {
  if (m1 === m2) return 0;
  if (
    (m1 === "rock" && m2 === "scissors") ||
    (m1 === "scissors" && m2 === "paper") ||
    (m1 === "paper" && m2 === "rock")
  )
    return 1;
  return 2;
}

// ── Match helpers ──

type MatchRow = typeof schema.pvpMatch.$inferSelect;

function getMatchRow(matchId: number): MatchRow | undefined {
  return db
    .select()
    .from(schema.pvpMatch)
    .where(eq(schema.pvpMatch.id, matchId))
    .get();
}

function parseResult(m: { result: string | null }): Record<string, unknown> {
  if (!m.result) return {};
  try {
    return JSON.parse(m.result as string) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/**
 * Return client-safe match data.
 * For Math matches that are still "playing", strip the correct answer
 * so players can't cheat by inspecting the API response.
 */
function getMatchClient(m: MatchRow): Record<string, unknown> {
  const parsed = parseResult(m);

  let sanitizedResult = m.result;
  if (
    m.status === "playing" &&
    m.type === "math" &&
    parsed &&
    typeof parsed.answer === "number"
  ) {
    const { answer: _a, ...safe } = parsed as Record<string, unknown>;
    sanitizedResult = JSON.stringify(safe);
  }

  return {
    id: m.id,
    type: m.type,
    bet: m.bet,
    status: m.status,
    player1Id: m.player1Id,
    player2Id: m.player2Id,
    result: sanitizedResult,
    winnerId: m.winnerId,
    createdAt: m.createdAt,
    player1Name: getUserName(m.player1Id),
    player2Name: m.player2Id ? getUserName(m.player2Id) : null,
  };
}

// ── Expired cleanup ──

function cleanupExpiredMatches(): void {
  const cutoff = new Date(Date.now() - MATCH_EXPIRY_MS).toISOString();
  const expired = db
    .select()
    .from(schema.pvpMatch)
    .where(eq(schema.pvpMatch.status, "waiting"))
    .all()
    .filter((m) => m.createdAt < cutoff);

  for (const m of expired) {
    addGold(m.player1Id, m.bet);
    db.update(schema.pvpMatch)
      .set({ status: "cancelled", result: JSON.stringify({ expired: true }) })
      .where(eq(schema.pvpMatch.id, m.id))
      .run();
  }
}

// ── Timeout check for submission phase ──
// If a match is "playing" but no one has submitted after SUBMIT_TIMEOUT_MS,
// cancel the match and refund both players.

function checkSubmissionTimeout(
  match: MatchRow
): { timedOut: boolean } {
  if (match.status !== "playing") return { timedOut: false };

  const elapsed = Date.now() - new Date(match.createdAt).getTime();
  if (elapsed < SUBMIT_TIMEOUT_MS) return { timedOut: false };

  const result = parseResult(match);
  const hasSubmission =
    result.player1Move || result.player2Move || result.submittedAnswer;

  if (hasSubmission) return { timedOut: false };

  // No submissions after timeout — cancel and refund
  addGold(match.player1Id, match.bet);
  if (match.player2Id) addGold(match.player2Id, match.bet);

  db.update(schema.pvpMatch)
    .set({
      status: "cancelled",
      result: JSON.stringify({ timeout: true }),
    })
    .where(eq(schema.pvpMatch.id, match.id))
    .run();

  return { timedOut: true };
}

// ═══════════════════════════════════════════════
//  GET — Lobby data + Status check
// ═══════════════════════════════════════════════

export async function GET(request: Request) {
  try {
    const userId = getUserId(request);
    cleanupExpiredMatches();

    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");
    const matchIdParam = searchParams.get("matchId");

    // ── Status check (polling by creator/joiner) ──
    // Accept both ?action=status&matchId=X and legacy ?matchId=X
    if (matchIdParam) {
      const matchId = parseInt(matchIdParam);
      const match = getMatchRow(matchId);

      if (!match) {
        return NextResponse.json(
          { error: "对决不存在" },
          { status: 404 }
        );
      }

      if (
        match.player1Id !== userId &&
        match.player2Id !== userId
      ) {
        return NextResponse.json(
          { error: "不是你参与的对决" },
          { status: 403 }
        );
      }

      // Check for submission timeout
      const { timedOut } = checkSubmissionTimeout(match);
      if (timedOut) {
        const isPlayer1 = match.player1Id === userId;
        const opponentId = isPlayer1 ? match.player2Id : match.player1Id;
        return NextResponse.json({
          match: {
            ...getMatchClient(match),
            status: "cancelled",
          },
          isPlayer1,
          opponentName: opponentId ? getUserName(opponentId) : "等待中",
          timeout: true,
        });
      }

      const isPlayer1 = match.player1Id === userId;
      const opponentId = isPlayer1 ? match.player2Id : match.player1Id;

      return NextResponse.json({
        match: getMatchClient(match),
        isPlayer1,
        opponentName: opponentId ? getUserName(opponentId) : "等待中",
      });
    }

    // ── Lobby: waiting + recent ──
    const waitingMatches = db
      .select()
      .from(schema.pvpMatch)
      .where(eq(schema.pvpMatch.status, "waiting"))
      .orderBy(desc(schema.pvpMatch.createdAt))
      .all();

    const waiting = waitingMatches.map((m) => ({
      id: m.id,
      type: m.type,
      bet: m.bet,
      creatorName: getUserName(m.player1Id),
      creatorId: m.player1Id,
      createdAt: m.createdAt,
    }));

    const recentMatches = db
      .select()
      .from(schema.pvpMatch)
      .where(eq(schema.pvpMatch.status, "completed"))
      .orderBy(desc(schema.pvpMatch.createdAt))
      .limit(20)
      .all();

    const recent = recentMatches.map((m) => ({
      id: m.id,
      type: m.type,
      bet: m.bet,
      winnerId: m.winnerId,
      winnerName: m.winnerId ? getUserName(m.winnerId) : null,
      player1Name: getUserName(m.player1Id),
      player2Name: m.player2Id ? getUserName(m.player2Id) : "未知",
      result: m.result ? JSON.parse(m.result as string) : null,
      createdAt: m.createdAt,
    }));

    return NextResponse.json({ waiting, recent });
  } catch (error) {
    console.error("PvP GET error:", error);
    return NextResponse.json(
      { error: "获取 PvP 数据失败" },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════
//  POST — All mutations
// ═══════════════════════════════════════════════

export async function POST(request: Request) {
  try {
    const userId = getUserId(request);
    const body = await request.json();
    const { action } = body;

    if (!action) {
      return NextResponse.json({ error: "缺少 action" }, { status: 400 });
    }

    switch (action) {
      case "create":
        return handleCreate(userId, body);
      case "join":
        return handleJoin(userId, body);
      case "submit":
        return handleSubmit(userId, body);
      case "cancel":
        return handleCancel(userId, body);
      case "forfeit":
        return handleForfeit(userId, body);
      default:
        return NextResponse.json(
          { error: "无效的 action" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("PvP POST error:", error);
    return NextResponse.json(
      { error: "PvP 操作失败" },
      { status: 500 }
    );
  }
}

// ── action: create ──

async function handleCreate(
  userId: number,
  body: Record<string, unknown>
) {
  const type = body.type as string;
  const bet =
    typeof body.bet === "number" ? body.bet : 20;

  if (!type || !["rps", "dice", "math"].includes(type)) {
    return NextResponse.json(
      { error: "无效的游戏类型，请选择 rps / dice / math" },
      { status: 400 }
    );
  }

  if (typeof bet !== "number" || bet < 10 || bet > 500) {
    return NextResponse.json(
      { error: "赌注必须在 10-500 G 之间" },
      { status: 400 }
    );
  }

  // Entry requirement
  if (!hasPvpEntryRequirement(userId)) {
    return NextResponse.json(
      {
        error:
          "今日还未完成任务，请先完成至少一个任务再来挑战 PvP！",
      },
      { status: 403 }
    );
  }

  // Rate limit
  const rate = checkRate(userId, "pvp_match", 10);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: rate.message },
      { status: 429 }
    );
  }

  // One active match per player
  const existing = db
    .select()
    .from(schema.pvpMatch)
    .where(
      and(
        eq(schema.pvpMatch.player1Id, userId),
        eq(schema.pvpMatch.status, "waiting")
      )
    )
    .get();

  if (existing) {
    return NextResponse.json(
      {
        error: "你已有一个等待中的对决，请先取消或等待对手加入",
      },
      { status: 400 }
    );
  }

  // Check gold
  const gold = getUserGold(userId);
  if (gold < bet) {
    return NextResponse.json(
      {
        error: `金币不足，需要 ${bet}G，你只有 ${gold}G`,
      },
      { status: 400 }
    );
  }

  // Admin — skip gold check and deduction
  const isAdminPvp = (db.select({ role: schema.user.role }).from(schema.user).where(eq(schema.user.id, userId)).get()?.role) === "admin";
  if (!isAdminPvp && gold < bet) {
    return NextResponse.json({ error: `金币不足，需要 ${bet}G，你只有 ${gold}G` }, { status: 400 });
  }
  // Deduct bet (admin no deduction)
  if (!isAdminPvp) deductGold(userId, bet);

  const now = new Date().toISOString();

  // Pre-generate game data
  let initialResult: string | null = null;
  if (type === "dice") {
    initialResult = JSON.stringify({ player1Roll: rollD20() });
  } else if (type === "math") {
    const problem = generateMathProblem();
    initialResult = JSON.stringify(problem);
  }
  // RPS: no pre-generated data, result is null

  const created = db
    .insert(schema.pvpMatch)
    .values({
      type,
      player1Id: userId,
      bet,
      status: "waiting",
      result: initialResult,
      createdAt: now,
    })
    .returning()
    .get();

  return NextResponse.json(
    {
      match: getMatchClient(created),
      newGold: gold - bet,
    },
    { status: 201 }
  );
}

// ── action: join ──

async function handleJoin(
  userId: number,
  body: Record<string, unknown>
) {
  const matchId = body.matchId as number;

  if (!matchId) {
    return NextResponse.json(
      { error: "缺少 matchId" },
      { status: 400 }
    );
  }

  const match = db
    .select()
    .from(schema.pvpMatch)
    .where(
      and(
        eq(schema.pvpMatch.id, matchId),
        eq(schema.pvpMatch.status, "waiting")
      )
    )
    .get();

  if (!match) {
    return NextResponse.json(
      { error: "该对决不存在或已结束" },
      { status: 404 }
    );
  }

  if (match.player1Id === userId) {
    return NextResponse.json(
      { error: "不能加入自己创建的对决" },
      { status: 400 }
    );
  }

  // Admin — skip gold check
  const isAdminJoin = (db.select({ role: schema.user.role }).from(schema.user).where(eq(schema.user.id, userId)).get()?.role) === "admin";
  const gold = getUserGold(userId);
  if (gold < match.bet && !isAdminJoin) {
    return NextResponse.json({ error: `金币不足，需要 ${match.bet}G，你只有 ${gold}G` }, { status: 400 });
  }

  // Deduct bet (admin no deduction)
  if (!isAdminJoin) deductGold(userId, match.bet);

  const type = match.type as string;

  // ── Dice: resolve immediately on join ──
  if (type === "dice") {
    const player2Roll = rollD20();
    const existingResult = parseResult(match);
    const r1 = (existingResult.player1Roll as number) || 0;

    let winnerId: number | null = null;
    let finalRolls: { player1Roll: number; player2Roll: number; ties?: number };

    if (r1 > player2Roll) {
      winnerId = match.player1Id;
      finalRolls = { player1Roll: r1, player2Roll };
    } else if (player2Roll > r1) {
      winnerId = userId;
      finalRolls = { player1Roll: r1, player2Roll };
    } else {
      // Tie — re-roll up to 3 times
      let ties = 1;
      let newR1 = r1;
      let newR2 = player2Roll;
      while (ties <= 3) {
        newR1 = rollD20();
        newR2 = rollD20();
        if (newR1 !== newR2) break;
        ties++;
      }

      if (newR1 > newR2) {
        winnerId = match.player1Id;
      } else if (newR2 > newR1) {
        winnerId = userId;
      } else {
        // Still tied after 3 re-rolls — refund both
        winnerId = -1;
      }

      finalRolls = { player1Roll: newR1, player2Roll: newR2, ties };
    }

    const finalResultStr = JSON.stringify(finalRolls);

    // Handle draw refund
    if (winnerId === -1) {
      addGold(match.player1Id, match.bet);
      addGold(userId, match.bet);

      db.update(schema.pvpMatch)
        .set({
          player2Id: userId,
          status: "completed",
          winnerId: null,
          result: finalResultStr,
        })
        .where(eq(schema.pvpMatch.id, matchId))
        .run();

      return NextResponse.json({
        match: {
          ...getMatchClient(match),
          player2Id: userId,
          status: "completed",
          winnerId: null,
          result: finalResultStr,
        },
        result: {
          winner: null,
          winnerId: null,
          message: "三次平局！金币已退还",
          ...finalRolls,
        },
        newGold: gold,
      });
    }

    // Award prize
    const pot = match.bet * 2;
    const prize = pot - TAX;
    if (winnerId) addGold(winnerId, prize);

    db.update(schema.pvpMatch)
      .set({
        player2Id: userId,
        status: "completed",
        winnerId,
        result: finalResultStr,
      })
      .where(eq(schema.pvpMatch.id, matchId))
      .run();

    return NextResponse.json({
      match: {
        ...getMatchClient(match),
        player2Id: userId,
        status: "completed",
        winnerId,
        result: finalResultStr,
      },
      result: {
        winner: winnerId ? getUserName(winnerId) : null,
        winnerId,
        prize,
        message: winnerId ? `${getUserName(winnerId)} 获胜！` : "平局",
        ...finalRolls,
      },
      newGold:
        winnerId === userId
          ? gold - match.bet + prize
          : gold - match.bet,
    });
  }

  // ── RPS / Math: set playing, both submit moves ──
  db.update(schema.pvpMatch)
    .set({
      player2Id: userId,
      status: "playing",
    })
    .where(eq(schema.pvpMatch.id, matchId))
    .run();

  return NextResponse.json({
    match: {
      ...getMatchClient(match),
      player2Id: userId,
      status: "playing",
    },
    newGold: gold - match.bet,
  });
}

// ── action: submit ──

async function handleSubmit(
  userId: number,
  body: Record<string, unknown>
) {
  const matchId = body.matchId as number;

  if (!matchId) {
    return NextResponse.json(
      { error: "缺少 matchId" },
      { status: 400 }
    );
  }

  const match = db
    .select()
    .from(schema.pvpMatch)
    .where(
      and(
        eq(schema.pvpMatch.id, matchId),
        eq(schema.pvpMatch.status, "playing")
      )
    )
    .get();

  // 如果不在 playing 状态，检查是否已结算完成 — 把结果直接返回
  if (!match) {
    const done = db
      .select()
      .from(schema.pvpMatch)
      .where(eq(schema.pvpMatch.id, matchId))
      .get();

    if (done && done.status === "completed") {
      const result = done.result ? JSON.parse(done.result as string) : {};
      return NextResponse.json({
        result: {
          winner: done.winnerId ? getUserName(done.winnerId) : null,
          winnerId: done.winnerId,
          prize: done.bet ? done.bet * 2 - TAX : 0,
          message: done.winnerId === userId ? "你赢了！" : `${getUserName(done.winnerId!)} 获胜`,
          ...(result as object),
        },
      });
    }

    return NextResponse.json(
      { error: "该对决不存在或已结束" },
      { status: 404 }
    );
  }

  if (
    match.player1Id !== userId &&
    match.player2Id !== userId
  ) {
    return NextResponse.json(
      { error: "你不是该对决的参与者" },
      { status: 403 }
    );
  }

  const type = match.type as string;
  const isPlayer1 = match.player1Id === userId;

  // ── RPS ──
  if (type === "rps") {
    const move = body.move as string;

    if (
      !move ||
      !["rock", "paper", "scissors"].includes(move)
    ) {
      return NextResponse.json(
        { error: "无效的出拳" },
        { status: 400 }
      );
    }

    const currentResult = parseResult(match);

    // Prevent double submission
    if (isPlayer1 && currentResult.player1Move) {
      return NextResponse.json(
        { error: "你已出拳，请等待对手" },
        { status: 400 }
      );
    }
    if (!isPlayer1 && currentResult.player2Move) {
      return NextResponse.json(
        { error: "你已出拳，请等待对手" },
        { status: 400 }
      );
    }

    // Store this player's move
    if (isPlayer1) {
      currentResult.player1Move = move;
    } else {
      currentResult.player2Move = move;
    }

    // Check if both players have submitted
    const p1m = currentResult.player1Move as string | undefined;
    const p2m = currentResult.player2Move as string | undefined;

    if (p1m && p2m) {
      // Both submitted — resolve
      const outcome = rpsDecide(p1m, p2m);

      if (outcome === 0) {
        // Draw — refund both
        addGold(match.player1Id, match.bet);
        addGold(match.player2Id!, match.bet);

        const drawResult = { ...currentResult, message: "平局！金币已退还", draw: true };
        db.update(schema.pvpMatch)
          .set({
            status: "completed",
            result: JSON.stringify(drawResult),
            winnerId: null,
          })
          .where(eq(schema.pvpMatch.id, matchId))
          .run();

        return NextResponse.json({
          result: {
            winner: null,
            winnerId: null,
            message: "平局！金币已退还",
            player1Move: p1m,
            player2Move: p2m,
            draw: true,
          },
          newGold: getUserGold(userId),
        });
      }

      // Has winner
      const winnerId =
        outcome === 1 ? match.player1Id : match.player2Id!;
      const pot = match.bet * 2;
      const prize = pot - TAX;
      addGold(winnerId, prize);

      db.update(schema.pvpMatch)
        .set({
          status: "completed",
          winnerId,
          result: JSON.stringify(currentResult),
        })
        .where(eq(schema.pvpMatch.id, matchId))
        .run();

      const userGold = getUserGold(userId);

      return NextResponse.json({
        result: {
          winner: getUserName(winnerId),
          winnerId,
          prize,
          player1Move: p1m,
          player2Move: p2m,
        },
        newGold: userGold,
      });
    }

    // Still waiting for opponent — save partial state
    db.update(schema.pvpMatch)
      .set({ result: JSON.stringify(currentResult) })
      .where(eq(schema.pvpMatch.id, matchId))
      .run();

    return NextResponse.json({
      waiting: true,
      message: isPlayer1
        ? "已出拳，等待对手出拳..."
        : "已出拳，等待对手出拳...",
    });
  }

  // ── Math ──
  if (type === "math") {
    const answer = body.answer;

    if (answer === undefined || answer === null) {
      return NextResponse.json(
        { error: "请提交答案" },
        { status: 400 }
      );
    }

    const problem = parseResult(match);

    if (!problem || problem.resolved) {
      return NextResponse.json(
        { error: "该对决已结束" },
        { status: 400 }
      );
    }

    const correctAnswer = problem.answer as number;
    const isCorrect = Number(answer) === correctAnswer;

    let winnerId: number;
    let message: string;

    if (isCorrect) {
      winnerId = userId;
      message = `${getUserName(userId)} 答对了！`;
    } else {
      // Wrong answer → opponent wins
      winnerId = isPlayer1 ? match.player2Id! : match.player1Id;
      message = `${getUserName(userId)} 答错了，${getUserName(winnerId)} 获胜！`;
    }

    const pot = match.bet * 2;
    const prize = pot - TAX;
    addGold(winnerId, prize);

    const finalResult = {
      a: problem.a,
      b: problem.b,
      op: problem.op,
      correctAnswer,
      submittedAnswer: Number(answer),
      resolved: true,
    };

    db.update(schema.pvpMatch)
      .set({
        status: "completed",
        winnerId,
        result: JSON.stringify(finalResult),
      })
      .where(eq(schema.pvpMatch.id, matchId))
      .run();

    const userGold = getUserGold(userId);

    return NextResponse.json({
      result: {
        winner: getUserName(winnerId),
        winnerId,
        prize,
        correctAnswer,
        yourAnswer: Number(answer),
        message,
      },
      newGold: userGold,
    });
  }

  return NextResponse.json(
    { error: "无效的游戏类型" },
    { status: 400 }
  );
}

// ── action: cancel ──

async function handleCancel(
  userId: number,
  body: Record<string, unknown>
) {
  const matchId = body.matchId as number;

  if (!matchId) {
    return NextResponse.json(
      { error: "缺少 matchId" },
      { status: 400 }
    );
  }

  const match = db
    .select()
    .from(schema.pvpMatch)
    .where(
      and(
        eq(schema.pvpMatch.id, matchId),
        eq(schema.pvpMatch.status, "waiting")
      )
    )
    .get();

  if (!match) {
    return NextResponse.json(
      { error: "对决不存在或已开始" },
      { status: 404 }
    );
  }

  if (match.player1Id !== userId) {
    return NextResponse.json(
      { error: "只有创建者可以取消对决" },
      { status: 403 }
    );
  }

  addGold(userId, match.bet);

  db.update(schema.pvpMatch)
    .set({
      status: "cancelled",
      result: JSON.stringify({ cancelled: true }),
    })
    .where(eq(schema.pvpMatch.id, matchId))
    .run();

  return NextResponse.json({
    success: true,
    refund: match.bet,
    newGold: getUserGold(userId),
  });
}

// ── action: forfeit ──

async function handleForfeit(
  userId: number,
  body: Record<string, unknown>
) {
  const matchId = body.matchId as number;

  if (!matchId) {
    return NextResponse.json(
      { error: "缺少 matchId" },
      { status: 400 }
    );
  }

  const match = db
    .select()
    .from(schema.pvpMatch)
    .where(
      and(
        eq(schema.pvpMatch.id, matchId),
        eq(schema.pvpMatch.status, "playing")
      )
    )
    .get();

  if (!match) {
    return NextResponse.json(
      { error: "对决不存在或已结束" },
      { status: 404 }
    );
  }

  if (
    match.player1Id !== userId &&
    match.player2Id !== userId
  ) {
    return NextResponse.json(
      { error: "你不是该对决的参与者" },
      { status: 403 }
    );
  }

  const opponentId =
    match.player1Id === userId
      ? match.player2Id!
      : match.player1Id;

  const pot = match.bet * 2;
  const prize = pot - TAX;
  addGold(opponentId, prize);

  db.update(schema.pvpMatch)
    .set({
      status: "completed",
      winnerId: opponentId,
      result: JSON.stringify({
        forfeit: true,
        forfeiterId: userId,
      }),
    })
    .where(eq(schema.pvpMatch.id, matchId))
    .run();

  return NextResponse.json({
    result: {
      winner: getUserName(opponentId),
      winnerId: opponentId,
      prize,
      message: `${getUserName(userId)} 放弃了对决`,
      forfeit: true,
    },
    newGold: getUserGold(userId),
  });
}
