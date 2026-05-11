import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "../../drizzle/schema";

// 确保 data 目录存在
import { mkdirSync } from "fs";
import { dirname } from "path";

const dbPath = process.env.DATABASE_PATH || "./data/levelup.db";

// 在非构建时创建目录
if (!process.env.NEXT_PHASE) {
  try {
    mkdirSync(dirname(dbPath), { recursive: true });
  } catch {
    // 目录已存在
  }
}

const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });
export { schema };
