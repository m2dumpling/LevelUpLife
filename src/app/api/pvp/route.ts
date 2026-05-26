import { NextResponse } from "next/server";
import { and, eq, desc } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getUserId } from "@/lib/auth";
import { checkRate } from "@/lib/rate-limiter";
import { getTodayLocal } from "@/lib/date-utils";

const TAX = 2;
const MATCH_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

// ── 过期清理 ──
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
      .set({ status: "cancelled" })
      .where(eq(schema.pvpMatch.id, m.id))
      .run();
  }
}

// ── 工具函数 ──

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

/** 检查用户今天是否至少完成了 1 个非 trival 难度的任务 */
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

// ── 随机工具 ──

function rollD20(): number {
  return Math.floor(Math.random() * 20) + 1;
}

function generateMathProblem(): {
  a: number;
  b: number;
  op: string;
  answer: number;
} {
  const a = Math.floor(Math.random() * 90) + 10; // 10-99
  const b = Math.floor(Math.random() * 90) + 10; // 10-99
  const op = Math.random() < 0.5 ? "+" : "-";
  const answer = op === "+" ? a + b : a - b;
  return { a, b, op, answer };
}

// ── GET: 大厅数据 ──

export async function GET(request: Request) {
  try {
    const userId = getUserId(request);
    cleanupExpiredMatches();

    // 等待中的比赛
    const waitingMatches = db
      .select()
      .from(schema.pvpMatch)
      .where(eq(schema.pvpMatch.status, "waiting"))
      .orderBy(desc(schema.pvpMatch.createdAt))
      .all();

    const waitingEnriched = waitingMatches.map((m) => ({
      id: m.id,
      type: m.type,
      bet: m.bet,
      creatorName: getUserName(m.player1Id),
      player2Id: m.player2Id,
      result: m.result,
      status: m.status,
      createdAt: m.createdAt,
    }));

    // 最近完成的比赛 (最近20条)
    const recentMatches = db
      .select()
      .from(schema.pvpMatch)
      .where(eq(schema.pvpMatch.status, "completed"))
      .orderBy(desc(schema.pvpMatch.createdAt))
      .limit(20)
      .all();

    const recentEnriched = recentMatches.map((m) => ({
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

    // 用户当前进行中的对决
    const activeMatch = db
      .select()
      .from(schema.pvpMatch)
      .where(eq(schema.pvpMatch.status, "playing"))
      .all()
      .find((m) => m.player1Id === userId || m.player2Id === userId);

    const activeData = activeMatch
      ? {
          id: activeMatch.id,
          type: activeMatch.type,
          bet: activeMatch.bet,
          player1Id: activeMatch.player1Id,
          player2Id: activeMatch.player2Id,
          status: activeMatch.status,
          result: activeMatch.result,
          createdAt: activeMatch.createdAt,
        }
      : null;

    return NextResponse.json({
      waiting: waitingEnriched,
      recent: recentEnriched,
      active: activeData,
    });
  } catch (error) {
    console.error("PvP GET error:", error);
    return NextResponse.json({ error: "获取 PvP 数据失败" }, { status: 500 });
  }
}

// ── POST: 创建/加入/提交 ──

export async function POST(request: Request) {
  try {
    const userId = getUserId(request);
    const body = await request.json();
    const { action } = body;

    if (!action) {
      return NextResponse.json({ error: "缺少 action 参数" }, { status: 400 });
    }

    // ── action: create ──
    if (action === "create") {
      const { type, bet = 20 } = body;

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

      // PvP 入场资格：今天至少完成 1 个任务
      if (!hasPvpEntryRequirement(userId)) {
        return NextResponse.json(
          { error: "今日还未完成任务，请先完成至少一个非简单难度的任务再来挑战 PvP！" },
          { status: 403 }
        );
      }

      // 限速检查
      const rate = checkRate(userId, "pvp_match", 10);
      if (!rate.allowed) {
        return NextResponse.json({ error: rate.message }, { status: 429 });
      }

      // 检查是否已有等待中的对决（每人同时只能有一个）
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
          { error: "你已有一个等待中的对决，请先取消或等待对手加入" },
          { status: 400 }
        );
      }

      // 检查金币
      const gold = getUserGold(userId);
      if (gold < bet) {
        return NextResponse.json(
          { error: `金币不足，需要 ${bet}G，你只有 ${gold}G` },
          { status: 400 }
        );
      }

      // 扣除赌注
      deductGold(userId, bet);

      const now = new Date().toISOString();

      // 根据游戏类型初始化 result
      let initialResult: string | null = null;
      if (type === "dice") {
        initialResult = JSON.stringify({ player1Roll: rollD20() });
      } else if (type === "math") {
        const problem = generateMathProblem();
        initialResult = JSON.stringify(problem);
      }

      const match = db
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

      return NextResponse.json({ match, newGold: gold - bet }, { status: 201 });
    }

    // ── action: join ──
    if (action === "join") {
      const { matchId } = body;

      if (!matchId) {
        return NextResponse.json({ error: "缺少 matchId" }, { status: 400 });
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

      // 检查金币
      const gold = getUserGold(userId);
      if (gold < match.bet) {
        return NextResponse.json(
          { error: `金币不足，需要 ${match.bet}G，你只有 ${gold}G` },
          { status: 400 }
        );
      }

      // 扣除赌注
      deductGold(userId, match.bet);

      // 根据类型处理
      const type = match.type as string;
      let updatedResult = match.result;

      if (type === "dice") {
        const player2Roll = rollD20();
        const existingResult = match.result
          ? (JSON.parse(match.result as string) as {
              player1Roll?: number;
              player2Roll?: number;
            })
          : {};
        const r1 = existingResult.player1Roll || 0;
        updatedResult = JSON.stringify({
          ...existingResult,
          player2Roll,
        });

        // Dice 自动判定
        let winnerId: number | null = null;
        let finalResult: string | null = null;

        if (r1 > player2Roll) {
          winnerId = match.player1Id;
        } else if (player2Roll > r1) {
          winnerId = userId;
        } else {
          // 平局：重掷（最多3次）
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
            // 3次平局，退款
            winnerId = -1; // -1 表示平局退款
          }

          finalResult = JSON.stringify({
            player1Roll: newR1,
            player2Roll: newR2,
            ties,
          });
        }

        if (!finalResult) {
          finalResult = JSON.stringify({ player1Roll: r1, player2Roll });
        }

        if (winnerId === -1) {
          // 平局退款
          addGold(match.player1Id, match.bet);
          addGold(userId, match.bet);
          return NextResponse.json({
            match: {
              ...match,
              status: "completed",
              result: finalResult,
              winnerId: null,
              player2Id: userId,
            },
            result: {
              winner: null,
              message: "三次平局！金币已退还",
              ...(JSON.parse(finalResult) as object),
            },
            newGold: gold,
          });
        }

        // 发放奖励（扣除税收）
        const pot = match.bet * 2;
        const prize = pot - TAX;
        if (winnerId) {
          addGold(winnerId, prize);
        }

        db.update(schema.pvpMatch)
          .set({
            player2Id: userId,
            status: "completed",
            winnerId,
            result: finalResult,
          })
          .where(eq(schema.pvpMatch.id, matchId))
          .run();

        return NextResponse.json({
          match: {
            ...match,
            player2Id: userId,
            status: "completed",
            winnerId,
            result: finalResult,
          },
          result: {
            winner: winnerId ? getUserName(winnerId) : null,
            winnerId,
            prize,
            ...(JSON.parse(finalResult) as object),
          },
          newGold: winnerId === userId ? gold - match.bet + prize : gold - match.bet,
        });
      }

      // RPS 和 Math：更新 player2Id，等待双方提交
      db.update(schema.pvpMatch)
        .set({
          player2Id: userId,
          status: type === "math" ? "playing" : "playing",
        })
        .where(eq(schema.pvpMatch.id, matchId))
        .run();

      return NextResponse.json({
        match: {
          ...match,
          player2Id: userId,
          result: updatedResult,
          status: "playing" as const,
        },
        newGold: gold - match.bet,
      });
    }

    // ── action: submit ──
    if (action === "submit") {
      const { matchId, move, answer } = body;

      if (!matchId) {
        return NextResponse.json({ error: "缺少 matchId" }, { status: 400 });
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
          { error: "该对决不存在或已结束" },
          { status: 404 }
        );
      }

      if (match.player1Id !== userId && match.player2Id !== userId) {
        return NextResponse.json(
          { error: "你不是该对决的参与者" },
          { status: 403 }
        );
      }

      const type = match.type as string;
      const isPlayer1 = match.player1Id === userId;

      // ── RPS 逻辑 ──
      if (type === "rps") {
        if (!move || !["rock", "paper", "scissors"].includes(move)) {
          return NextResponse.json(
            { error: "无效的出拳，请选择 rock / paper / scissors" },
            { status: 400 }
          );
        }

        const currentResult = match.result
          ? (JSON.parse(match.result as string) as {
              player1Move?: string;
              player2Move?: string;
            })
          : {};

        if (isPlayer1) {
          if (currentResult.player1Move) {
            return NextResponse.json(
              { error: "你已出拳，请等待对手" },
              { status: 400 }
            );
          }
          currentResult.player1Move = move;
        } else {
          if (currentResult.player2Move) {
            return NextResponse.json(
              { error: "你已出拳，请等待对手" },
              { status: 400 }
            );
          }
          currentResult.player2Move = move;
        }

        // 判断双方是否都已出拳
        if (currentResult.player1Move && currentResult.player2Move) {
          // 判定
          const p1m = currentResult.player1Move as string;
          const p2m = currentResult.player2Move as string;

          let winnerId: number | null = null;
          if (p1m === p2m) {
            // 平局，退款
            winnerId = -1;
          } else if (
            (p1m === "rock" && p2m === "scissors") ||
            (p1m === "scissors" && p2m === "paper") ||
            (p1m === "paper" && p2m === "rock")
          ) {
            winnerId = match.player1Id;
          } else {
            winnerId = match.player2Id!;
          }

          if (winnerId === -1) {
            addGold(match.player1Id, match.bet);
            addGold(match.player2Id!, match.bet);
            db.update(schema.pvpMatch)
              .set({
                status: "completed",
                result: JSON.stringify(currentResult),
                winnerId: null,
              })
              .where(eq(schema.pvpMatch.id, matchId))
              .run();

            return NextResponse.json({
              result: {
                winner: null,
                message: "平局！金币已退还",
                player1Move: p1m,
                player2Move: p2m,
              },
            });
          }

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

        // 仅存储当前玩家的选择，等待对手
        db.update(schema.pvpMatch)
          .set({ result: JSON.stringify(currentResult) })
          .where(eq(schema.pvpMatch.id, matchId))
          .run();

        return NextResponse.json({
          waiting: true,
          message: isPlayer1 ? "已出拳，等待对手出拳..." : "已出拳，等待对手出拳...",
        });
      }

      // ── Math 逻辑 ──
      if (type === "math") {
        if (answer === undefined || answer === null) {
          return NextResponse.json(
            { error: "请提交答案" },
            { status: 400 }
          );
        }

        const problem = match.result
          ? (JSON.parse(match.result as string) as {
              a: number;
              b: number;
              op: string;
              answer: number;
              resolved?: boolean;
            })
          : null;

        if (!problem || problem.resolved) {
          return NextResponse.json(
            { error: "该对决已结束" },
            { status: 400 }
          );
        }

        const isCorrect = Number(answer) === problem.answer;

        let winnerId: number | null = null;
        let message = "";

        if (isCorrect) {
          winnerId = userId;
          message = `${getUserName(userId)} 答对了！`;
        } else {
          // 答错，对手获胜
          winnerId = isPlayer1 ? match.player2Id! : match.player1Id;
          message = `${getUserName(userId)} 答错了！${getUserName(winnerId)} 获胜！`;
        }

        const pot = match.bet * 2;
        const prize = pot - TAX;
        addGold(winnerId, prize);

        db.update(schema.pvpMatch)
          .set({
            status: "completed",
            winnerId,
            result: JSON.stringify({
              a: problem.a,
              b: problem.b,
              op: problem.op,
              correctAnswer: problem.answer,
              submittedAnswer: answer,
              resolved: true,
            }),
          })
          .where(eq(schema.pvpMatch.id, matchId))
          .run();

        const userGold = getUserGold(userId);

        return NextResponse.json({
          result: {
            winner: getUserName(winnerId),
            winnerId,
            prize,
            correctAnswer: problem.answer,
            yourAnswer: answer,
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

    // ── action: cancel（创建者取消等待中的对决，退款）──
    if (action === "cancel") {
      const { matchId } = body;
      if (!matchId) {
        return NextResponse.json({ error: "缺少 matchId" }, { status: 400 });
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
        return NextResponse.json({ error: "对决不存在或已开始" }, { status: 404 });
      }
      if (match.player1Id !== userId) {
        return NextResponse.json({ error: "只有创建者可以取消对决" }, { status: 403 });
      }

      addGold(userId, match.bet);
      db.update(schema.pvpMatch)
        .set({ status: "cancelled" })
        .where(eq(schema.pvpMatch.id, matchId))
        .run();

      return NextResponse.json({ success: true, refund: match.bet, newGold: getUserGold(userId) });
    }

    // ── action: forfeit（放弃进行中的对决，对手获胜）──
    if (action === "forfeit") {
      const { matchId } = body;
      if (!matchId) {
        return NextResponse.json({ error: "缺少 matchId" }, { status: 400 });
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
        return NextResponse.json({ error: "对决不存在或已结束" }, { status: 404 });
      }
      if (match.player1Id !== userId && match.player2Id !== userId) {
        return NextResponse.json({ error: "你不是该对决的参与者" }, { status: 403 });
      }

      const opponentId = match.player1Id === userId ? match.player2Id! : match.player1Id;
      const pot = match.bet * 2;
      const prize = pot - TAX;
      addGold(opponentId, prize);

      db.update(schema.pvpMatch)
        .set({
          status: "completed",
          winnerId: opponentId,
          result: JSON.stringify({ forfeit: true, forfeiterId: userId }),
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

    return NextResponse.json({ error: "无效的 action" }, { status: 400 });
  } catch (error) {
    console.error("PvP POST error:", error);
    return NextResponse.json(
      { error: "PvP 操作失败" },
      { status: 500 }
    );
  }
}
