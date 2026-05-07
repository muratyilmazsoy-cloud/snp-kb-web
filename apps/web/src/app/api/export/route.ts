import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import Database from "better-sqlite3";
import path from "path";
import JSZip from "jszip";

function sanitizeFilename(name: string): string {
  return name.replace(/[<>:"/\\|?*\n\r]/g, "_").slice(0, 80) || "sohbet";
}

export async function GET() {
  try {
    const pool = getPool();
    let conversations: Array<{
      id: string;
      title: string;
      source: string;
      project: string;
      content: string;
      tags: string;
      model: string;
      created_at: string;
    }> = [];

    if (pool) {
      const res = await pool.query(`SELECT * FROM conversations ORDER BY created_at DESC`);
      conversations = res.rows;
    } else {
      const dbPath = path.join(process.cwd(), "dev.db");
      const sqlite = new Database(dbPath);
      conversations = sqlite.prepare(`SELECT * FROM conversations ORDER BY created_at DESC`).all() as typeof conversations;
    }

    const zip = new JSZip();
    const folder = zip.folder("snp-kb-sohbetler");
    if (!folder) throw new Error("ZIP folder error");

    for (const c of conversations) {
      const frontMatter = `---
title: ${c.title || "Basliksiz"}
date: ${c.created_at ? String(c.created_at).split("T")[0] : ""}
model: ${c.model || ""}
source: ${c.source || ""}
project: ${c.project || "Genel"}
tags: [${c.tags || ""}]
---

`;
      const body = c.content || "(Icerik yok)";
      const md = frontMatter + body;
      const fileName = `${sanitizeFilename(c.title)}_${c.id.slice(0, 8)}.md`;
      folder.file(fileName, md);
    }

    const buffer = await zip.generateAsync({ type: "nodebuffer" });

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="snp-kb-sohbetler.zip"`,
      },
    });
  } catch (err) {
    console.error("GET /api/export error:", err);
    return NextResponse.json({ error: "Export hatasi" }, { status: 500 });
  }
}
