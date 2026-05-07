export interface ParsedConversation {
  title: string;
  date: string;
  source: string;
  project: string;
  content: string;
  tags: string;
}

const PROJECT_KEYWORDS: Record<string, string[]> = {
  Surucu: ["sürücü", "surucu", "delaval", "hayvancilik", "hayvancılık", "süt", "sut", "besi", "inek", "ahır"],
  "Madam-Nica": ["madam nica", "madam-nica", "fine dining", "restoran", "şube", "sube", "mutfak", "chef"],
  Burkina: ["burkina", "gana", "sez", "afrika", "ouagadougou", "batı afrika", "bati afrika", "accra"],
  SnP: ["operasyon 4.0", "operasyon", "auroch", "iş altyapısı", "is altyapisi", "müvekkil", "muvekkil", "vortex", "standards and partners", "snp"],
};

function guessProject(text: string): string {
  const lower = text.toLowerCase();
  for (const [project, keywords] of Object.entries(PROJECT_KEYWORDS)) {
    if (keywords.some((k) => lower.includes(k))) return project;
  }
  return "Genel";
}

function guessTags(title: string, content: string): string {
  const text = (title + " " + content.slice(0, 500)).toLowerCase();
  const found: string[] = [];
  const map: Record<string, string> = {
    api: "api", web: "web", mimari: "mimari", guvenlik: "güvenlik",
    security: "güvenlik", performans: "performans", veritabani: "veritabanı",
    database: "veritabanı", frontend: "frontend", backend: "backend",
    python: "python", javascript: "javascript", react: "react",
    nextjs: "nextjs", fastapi: "fastapi", prompt: "prompt",
    claude: "claude", chatgpt: "chatgpt", gemini: "gemini",
  };
  for (const [kw, tag] of Object.entries(map)) {
    if (text.includes(kw) && !found.includes(tag)) found.push(tag);
  }
  return found.length ? found.join(", ") : "genel";
}

function extractMessages(mapping: Record<string, any>, nodeId?: string): Array<{ role: string; text: string }> {
  const messages: Array<{ role: string; text: string }> = [];
  if (!nodeId) {
    // Root node'u bul
    for (const key of Object.keys(mapping)) {
      if (mapping[key]?.parent === null) {
        nodeId = key;
        break;
      }
    }
  }
  if (!nodeId || !mapping[nodeId]) return messages;

  const node = mapping[nodeId];
  const msg = node.message;
  if (msg?.content?.parts) {
    const text = (msg.content.parts as unknown[]).filter((p) => typeof p === "string").join("\n");
    const role = msg.author?.role === "user" ? "Kullanici" : "ChatGPT";
    if (text.trim()) messages.push({ role, text });
  }

  for (const childId of node.children || []) {
    messages.push(...extractMessages(mapping, childId));
  }
  return messages;
}

export function parseChatGPTJson(jsonText: string): ParsedConversation[] {
  const data = JSON.parse(jsonText);
  if (!Array.isArray(data)) throw new Error("Beklenen format: JSON array");

  const results: ParsedConversation[] = [];

  for (const conv of data) {
    const title = conv.title?.trim() || "untitled";
    const createTime = conv.create_time;
    const mapping = conv.mapping || {};
    const messages = extractMessages(mapping);

    if (!messages.length) continue;

    const date = createTime
      ? new Date(createTime * 1000).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0];

    const contentLines: string[] = [];
    messages.forEach((m, i) => {
      contentLines.push(`## Mesaj ${i + 1} — ${m.role}\n`);
      contentLines.push(m.text);
      contentLines.push("");
    });
    const content = contentLines.join("\n");

    results.push({
      title,
      date,
      source: "chatgpt",
      project: guessProject(title + " " + content.slice(0, 500)),
      content,
      tags: guessTags(title, content),
    });
  }

  return results;
}
