import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import type { db as appDb, schema as appSchema } from "../src/lib/db";
import type { eq as drizzleEq } from "drizzle-orm";

const projectRoot = process.cwd();
const tempDir = mkdtempSync(join(tmpdir(), "leveluplife-"));
const dbPath = join(tempDir, "test.db");

process.env.DATABASE_PATH = dbPath;
process.env.JWT_SECRET = "test-secret-at-least-32-characters-long";
process.env.NODE_ENV = "test";

function applyMigration(sqlite: Database.Database, file: string) {
  const sql = readFileSync(join(projectRoot, "drizzle", "migrations", file), "utf8");
  for (const statement of sql.split("--> statement-breakpoint")) {
    const trimmed = statement.trim();
    if (trimmed) sqlite.exec(trimmed);
  }
}

const sqlite = new Database(dbPath);
for (const file of readdirSync(join(projectRoot, "drizzle", "migrations"))
  .filter((name) => /^\d+_.+\.sql$/.test(name))
  .sort()) {
  applyMigration(sqlite, file);
}
sqlite.close();

let app: {
  db: typeof appDb;
  schema: typeof appSchema;
  eq: typeof drizzleEq;
};

async function getApp() {
  if (!app) {
    const dbModule = await import("../src/lib/db");
    const drizzle = await import("drizzle-orm");
    app = {
      db: dbModule.db,
      schema: dbModule.schema,
      eq: drizzle.eq,
    };
  }
  return app;
}

function now() {
  return new Date().toISOString();
}

async function createUser(id: number, username: string, overrides: Record<string, unknown> = {}) {
  const { db, schema } = await getApp();
  db.insert(schema.user)
    .values({
      id,
      username,
      name: username,
      passwordHash: "hash",
      level: 1,
      xp: 0,
      xpToNext: 100,
      gold: 0,
      hp: 100,
      maxHp: 100,
      totalDays: 1,
      streakDays: 0,
      bestStreak: 0,
      storyProgress: "chapter_0",
      hpPenaltyActive: false,
      role: "user",
      banned: false,
      createdAt: now(),
      updatedAt: now(),
      ...overrides,
    })
    .run();
}

test("task rewards only use medals equipped by the task owner", async () => {
  const { db, schema } = await getApp();
  const { grantTaskReward } = await import("../src/lib/rewards");

  await createUser(101, "reward_owner");
  await createUser(102, "other_medal_owner");

  db.insert(schema.inventory)
    .values({ userId: 102, itemKey: "medal_adamantite", quantity: 1, equipped: true })
    .run();

  const task = db.insert(schema.task)
    .values({
      id: 1001,
      userId: 101,
      mode: "plan",
      title: "reward isolation",
      difficulty: "easy",
      xpReward: 100,
      goldReward: 0,
      streakCount: 0,
      bestStreak: 0,
      completed: false,
      sortOrder: 0,
      status: "pending",
      createdAt: now(),
    })
    .returning()
    .get();

  const result = grantTaskReward(task);

  assert.equal(result.xpEarned, 100);
  assert.equal(result.level, 2);
  assert.equal(result.xp, 0);
});

test("completing the final boss hit distributes boss rewards", async () => {
  const { db, schema, eq } = await getApp();
  const { PATCH } = await import("../src/app/api/tasks/[id]/route");
  const { getTodayLocal } = await import("../src/lib/date-utils");

  await createUser(201, "boss_player");

  db.insert(schema.boss)
    .values({
      id: 2001,
      name: "Test Boss",
      emoji: "B",
      hp: 1,
      maxHp: 1,
      weekStart: getTodayLocal(),
      defeated: false,
      rewardGold: 7,
      notified: false,
    })
    .run();

  db.insert(schema.task)
    .values({
      id: 2002,
      userId: 201,
      mode: "plan",
      title: "final hit",
      difficulty: "trivial",
      xpReward: 0,
      goldReward: 1,
      streakCount: 0,
      bestStreak: 0,
      completed: false,
      sortOrder: 0,
      status: "pending",
      targetDate: getTodayLocal(),
      createdAt: now(),
    })
    .run();

  const response = await PATCH(
    new Request("http://test.local/api/tasks/2002", {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-user-id": "201" },
      body: JSON.stringify({ completed: true }),
    }),
    { params: Promise.resolve({ id: "2002" }) },
  );

  assert.equal(response.status, 200);
  const user = db.select().from(schema.user).where(eq(schema.user.id, 201)).get();
  assert.equal(user?.gold, 8);
});

test("gift notifications are returned only once even when the client has no local marker", async () => {
  const { db, schema } = await getApp();
  const { GET } = await import("../src/app/api/notifications/route");

  await createUser(301, "gift_sender");
  await createUser(302, "gift_receiver");
  db.insert(schema.giftLog)
    .values({ id: 3001, fromUserId: 301, toUserId: 302, giftType: "gold", giftValue: "5", date: "2026-06-08" })
    .run();

  const first = await GET(new Request("http://test.local/api/notifications?afterGiftId=0", {
    headers: { "x-user-id": "302" },
  }));
  const firstBody = await first.json();
  assert.equal(firstBody.giftAlerts.length, 1);

  const second = await GET(new Request("http://test.local/api/notifications?afterGiftId=0", {
    headers: { "x-user-id": "302" },
  }));
  const secondBody = await second.json();
  assert.equal(secondBody.giftAlerts.length, 0);
});

test("guild ranking uses lifetime XP implied by level plus current XP", async () => {
  const { db, schema } = await getApp();
  const { GET } = await import("../src/app/api/guild/leaderboard/route");

  await createUser(501, "high_level_low_current", { level: 3, xp: 0, xpToNext: 520 });
  await createUser(502, "low_level_high_current", { level: 1, xp: 200, xpToNext: 100 });
  db.insert(schema.guild)
    .values([
      { id: 5001, name: "Lifetime", inviteCode: "LIFE01", leaderId: 501, createdAt: now() },
      { id: 5002, name: "Current", inviteCode: "CURR01", leaderId: 502, createdAt: now() },
    ])
    .run();
  db.insert(schema.guildMember)
    .values([
      { guildId: 5001, userId: 501, joinedAt: now() },
      { guildId: 5002, userId: 502, joinedAt: now() },
    ])
    .run();

  const response = await GET(new Request("http://test.local/api/guild/leaderboard", {
    headers: { "x-user-id": "501" },
  }));
  const body = await response.json();

  assert.equal(body.leaderboard[0].guildId, 5001);
});

test("login does not pre-consume the daily HP recovery marker", async () => {
  const { db, schema, eq } = await getApp();
  const { POST } = await import("../src/app/api/auth/login/route");
  const { hashPassword } = await import("../src/lib/auth");
  const { getTodayLocal } = await import("../src/lib/date-utils");

  await createUser(601, "login_user", {
    passwordHash: await hashPassword("pass1234"),
    hp: 50,
    lastLoginDate: null,
  });

  const response = await POST(new Request("http://test.local/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "127.0.0.1" },
    body: JSON.stringify({ username: "login_user", password: "pass1234" }),
  }));
  assert.equal(response.status, 200);

  const user = db.select().from(schema.user).where(eq(schema.user.id, 601)).get();
  assert.notEqual(user?.lastLoginDate, getTodayLocal());
});

test("settlement habit frequency matching uses the provided Beijing date", async () => {
  const settlement = await import("../src/lib/daily-settlement");
  assert.equal(settlement.habitMatchesDate("weekly", "2026-06-01", null), true);
  assert.equal(settlement.habitMatchesDate("monthly", "2026-06-15", null), true);
});
