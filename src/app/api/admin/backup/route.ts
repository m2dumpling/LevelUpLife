import { NextResponse } from "next/server";
import { readFileSync } from "fs";

export async function GET() {
  try {
    const dbPath = process.env.DATABASE_PATH || "./data/levelup.db";
    const buffer = readFileSync(dbPath);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="levelup-backup-${new Date().toISOString().split("T")[0]}.db"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "备份失败" }, { status: 500 });
  }
}
