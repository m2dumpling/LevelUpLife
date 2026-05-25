import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "../../drizzle/schema";

// 确保 data 目录存在（构建和运行时都需要）
import { mkdirSync } from "fs";
import { dirname } from "path";

const dbPath = process.env.DATABASE_PATH || "./data/levelup.db";

try {
  mkdirSync(dirname(dbPath), { recursive: true });
} catch {
  // 目录已存在
}

const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS reward_ledger (
    id integer PRIMARY KEY,
    task_id integer NOT NULL,
    completion_key text NOT NULL,
    mode text NOT NULL,
    task_title text NOT NULL,
    base_xp integer NOT NULL,
    base_gold integer NOT NULL,
    xp_earned integer NOT NULL,
    gold_earned integer NOT NULL,
    level_before integer NOT NULL,
    xp_before integer NOT NULL,
    xp_to_next_before integer NOT NULL,
    gold_before integer NOT NULL,
    level_after integer NOT NULL,
    xp_after integer NOT NULL,
    xp_to_next_after integer NOT NULL,
    gold_after integer NOT NULL,
    completed_date text NOT NULL,
    created_at text NOT NULL,
    reversed_at text
  )
`);

// 确保新增列存在（兼容旧数据库）
try {
  sqlite.exec("ALTER TABLE user ADD COLUMN city text");
} catch {
  // 列已存在
}

export const db = drizzle(sqlite, { schema });
export { schema };
