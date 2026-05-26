import { NextResponse } from "next/server";
import Database from "better-sqlite3";

const dbPath = process.env.DATABASE_PATH || "./data/levelup.db";

function getDB() {
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  return sqlite;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const table = searchParams.get("table");

    const sqlite = getDB();

    if (!table) {
      // List all tables
      const tables = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
      return NextResponse.json(tables.map((t: any) => t.name));
    }

    // Get table rows (limit 100)
    const rows = sqlite.prepare(`SELECT * FROM "${table}" LIMIT 100`).all();
    // Get column info
    const cols = sqlite.prepare(`PRAGMA table_info("${table}")`).all();

    sqlite.close();
    return NextResponse.json({ columns: cols, rows });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { action, table, id, data } = await request.json();
    const sqlite = getDB();

    // Get columns for the table
    const cols = sqlite.prepare(`PRAGMA table_info("${table}")`).all() as any[];
    const colNames = cols.map((c: any) => c.name);

    if (action === "update" && id) {
      const sets = Object.entries(data)
        .filter(([k]) => colNames.includes(k) && k !== "id")
        .map(([k, v]) => `"${k}" = ${v === null ? "NULL" : typeof v === "string" ? `'${v.replace(/'/g, "''")}'` : v}`)
        .join(", ");
      if (sets) sqlite.prepare(`UPDATE "${table}" SET ${sets} WHERE id = ?`).run(id);
    } else if (action === "delete" && id) {
      sqlite.prepare(`DELETE FROM "${table}" WHERE id = ?`).run(id);
    } else if (action === "insert") {
      const keys = Object.keys(data).filter(k => colNames.includes(k) && k !== "id");
      const vals = keys.map(k => {
        const v = data[k];
        return v === null || v === undefined ? "NULL" : typeof v === "string" ? `'${v.replace(/'/g, "''")}'` : v;
      });
      sqlite.prepare(`INSERT INTO "${table}" (${keys.map(k => `"${k}"`).join(",")}) VALUES (${vals.join(",")})`).run();
    }

    sqlite.close();
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
