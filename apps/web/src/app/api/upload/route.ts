import { NextRequest, NextResponse } from "next/server";
import { createConversation } from "@/lib/db";
import { parseChatGPTJson } from "@/lib/chatgpt-parser";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function extractTitle(content: string, fallback: string): string {
  // Front-matter title
  if (content.startsWith("---")) {
    const end = content.indexOf("\n---", 3);
    if (end !== -1) {
      const fm = content.slice(3, end);
      const m = fm.match(/^title:\s*(.+)$/m);
      if (m) return m[1].trim().slice(0, 120);
    }
  }

  // Markdown heading
  const heading = content.match(/^#{1,2}\s+(.+)$/m);
  if (heading) {
    const h = heading[1].trim();
    if (!/kullanici|user|you|chatgpt|claude|kimi|gemini|assistant/i.test(h)) {
      return h.slice(0, 120);
    }
  }

  // First non-empty line (skip headings)
  const firstLine = content.split("\n").find((l) => l.trim() && !l.trim().startsWith("#"));
  if (firstLine && firstLine.trim().length > 3) {
    return firstLine.trim().slice(0, 120);
  }

  // Fallback
  if (!UUID_RE.test(fallback)) return fallback.slice(0, 120);
  return "Sohbet";
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const files = formData.getAll("files") as File[];
    const source = (formData.get("source") as string) || "manual";
    const model = (formData.get("model") as string) || "";

    console.log("[upload] received files:", files.length);
    if (!files.length) {
      return NextResponse.json({ error: "Dosya bulunamadi" }, { status: 400 });
    }

    let totalImported = 0;
    const results: Array<{ title: string; type: string; ok: boolean; error?: string }> = [];

    for (const file of files) {
      try {
        const content = await file.text();
        const isJson = file.name.endsWith(".json");

        if (isJson) {
          console.log("[upload] parsing JSON:", file.name, "size:", content.length);
          const parsed = parseChatGPTJson(content);
          console.log("[upload] parsed conversations:", parsed.length);
          for (const conv of parsed) {
            await createConversation({
              title: conv.title,
              source: conv.source,
              project: conv.project,
              content: conv.content,
              tags: conv.tags,
              model,
              created_at: conv.date ? conv.date + "T00:00:00Z" : undefined,
            });
            totalImported++;
          }
          results.push({ title: file.name, type: "chatgpt-batch", ok: true });
        } else {
          let cleanContent = content;
          let parsedTags = "";

          if (content.startsWith("---")) {
            const end = content.indexOf("\n---", 3);
            if (end !== -1) {
              const fm = content.slice(3, end);
              const tagsMatch = fm.match(/tags:\s*\[(.*?)\]/);
              if (tagsMatch) parsedTags = tagsMatch[1];
              cleanContent = content.slice(end + 4).trim();
            }
          }

          const rawTitle = file.name.replace(/\.[^/.]+$/, "");
          const title = extractTitle(content, rawTitle);

          let parsedDate: string | undefined;
          if (content.startsWith("---")) {
            const end = content.indexOf("\n---", 3);
            if (end !== -1) {
              const fm = content.slice(3, end);
              const dateMatch = fm.match(/^date:\s*(\d{4}-\d{2}-\d{2})/m);
              if (dateMatch) parsedDate = dateMatch[1] + "T00:00:00Z";
            }
          }

          const MAX_CONTENT = 100_000;
          if (cleanContent.length > MAX_CONTENT) {
            cleanContent = cleanContent.slice(0, MAX_CONTENT) + "\n\n[... İcerik " + MAX_CONTENT.toLocaleString("tr-TR") + " karakterle sinirlandirildi]";
          }

          await createConversation({
            title,
            source,
            project: "Genel",
            content: cleanContent,
            tags: parsedTags,
            model,
            created_at: parsedDate,
          });
          totalImported++;
          results.push({ title, type: "single", ok: true });
        }
      } catch (fileErr) {
        const msg = fileErr instanceof Error ? fileErr.message : String(fileErr);
        console.error("[upload] file failed:", file.name, msg);
        results.push({ title: file.name, type: "error", ok: false, error: msg });
      }
    }

    console.log("[upload] done. imported:", totalImported, "results:", results.length);
    return NextResponse.json({
      success: true,
      imported: totalImported,
      files: results.length,
      results,
    });
  } catch (err: unknown) {
    console.error("POST /api/upload fatal error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Yukleme hatasi" },
      { status: 500 }
    );
  }
}
