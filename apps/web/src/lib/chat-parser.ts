export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const USER_PATTERNS = /kullanici|you|user|siz|sen|ben|insan/i;
const ASSISTANT_PATTERNS = /chatgpt|claude|kimi|gemini|perplexity|copilot|grok|assistant|ai|asistan|bot/i;

export function parseChatContent(content: string | null | undefined): ChatMessage[] {
  if (!content || typeof content !== "string") {
    return [{ role: "assistant", content: "(Icerik yok)" }];
  }

  const lines = content.split("\n");
  const messages: ChatMessage[] = [];
  let currentRole: "user" | "assistant" | null = null;
  let currentContent: string[] = [];

  for (const line of lines) {
    const headerMatch = line.match(/^#{1,2}\s+(.+)$/);
    if (headerMatch) {
      if (currentRole && currentContent.length > 0) {
        messages.push({ role: currentRole, content: currentContent.join("\n").trim() });
      }

      const header = headerMatch[1].trim();
      if (USER_PATTERNS.test(header)) {
        currentRole = "user";
      } else if (ASSISTANT_PATTERNS.test(header)) {
        currentRole = "assistant";
      } else {
        currentRole = null;
      }
      currentContent = [];
    } else if (currentRole) {
      currentContent.push(line);
    }
  }

  if (currentRole && currentContent.length > 0) {
    messages.push({ role: currentRole, content: currentContent.join("\n").trim() });
  }

  if (messages.length === 0) {
    messages.push({ role: "assistant", content: content.trim() });
  }

  return messages;
}
