import { NextResponse } from "next/server";
import { Pool } from "pg";
import Database from "better-sqlite3";
import path from "path";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function extractTitle(content: string, fallback: string): string {
  if (content.startsWith("---")) {
    const end = content.indexOf("\n---", 3);
    if (end !== -1) {
      const fm = content.slice(3, end);
      const m = fm.match(/^title:\s*(.+)$/m);
      if (m) return m[1].trim().slice(0, 120);
    }
  }
  const heading = content.match(/^#{1,2}\s+(.+)$/m);
  if (heading) {
    const h = heading[1].trim();
    if (!/kullanici|user|you|chatgpt|claude|kimi|gemini|assistant/i.test(h)) {
      return h.slice(0, 120);
    }
  }
  const firstLine = content.split("\n").find((l) => l.trim() && !l.trim().startsWith("#"));
  if (firstLine && firstLine.trim().length > 3) {
    return firstLine.trim().slice(0, 120);
  }
  if (!UUID_RE.test(fallback)) return fallback.slice(0, 120);
  return "Sohbet";
}

export async function POST() {
  try {
    const url = process.env.DATABASE_URL;
    let updated = 0;
    let skipped = 0;

    if (!url || url.startsWith("file:")) {
      const dbPath = path.join(process.cwd(), "dev.db");
      const sqlite = new Database(dbPath);
      const rows = sqlite.prepare("SELECT id, title, content FROM conversations").all() as Array<{ id: string; title: string; content: string }>;
      const stmt = sqlite.prepare("UPDATE conversations SET title = ? WHERE id = ?");
      for (const row of rows) {
        if (UUID_RE.test(row.title)) {
          const newTitle = extractTitle(row.content, row.title);
          stmt.run(newTitle, row.id);
          updated++;
        } else {
          skipped++;
        }
      }
    } else {
      const pool = new Pool({
        connectionString: url,
        ssl: url.includes("supabase") ? { rejectUnauthorized: false } : false,
        max: 2,
      });
      const res = await pool.query("SELECT id, title, content FROM conversations");
      for (const row of res.rows) {
        if (UUID_RE.test(row.title)) {
          const newTitle = extractTitle(row.content, row.title);
          await pool.query("UPDATE conversations SET title = $1 WHERE id = $2", [newTitle, row.id]);
          updated++;
        } else {
          skipped++;
        }
      }
      await pool.end();
    }

    return NextResponse.json({ success: true, updated, skipped });
  } catch (err) {
    console.error("fix-titles error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
