"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

interface Conversation {
  id: string;
  title: string;
  source: string;
  project: string;
  content: string;
  tags: string;
  model: string;
  created_at: string;
}

const AI_MODELS = [
  { key: "ChatGPT", label: "ChatGPT", color: "#10a37f" },
  { key: "Claude", label: "Claude", color: "#cc785c" },
  { key: "Kimi", label: "Kimi", color: "#6366f1" },
  { key: "Gemini", label: "Gemini", color: "#4285f4" },
  { key: "Perplexity", label: "Perplexity", color: "#22d3ee" },
  { key: "Copilot", label: "Copilot", color: "#0ea5e9" },
  { key: "X", label: "X / Grok", color: "#e2e8f0" },
  { key: "Diger", label: "Diger", color: "#94a3b8" },
];

export default function ConversationPage() {
  const { id } = useParams();
  const [conv, setConv] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/conversations/${id}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => { setConv(data.conversation || null); setLoading(false); });
  }, [id]);

  function fmtDate(raw: string | null | undefined) {
    if (!raw) return "—";
    const d = new Date(raw);
    return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("tr-TR");
  }

  if (loading) return (
    <div className="min-h-screen bg-[#0a0e17] text-[#e0e7ff] flex items-center justify-center">
      <div className="w-10 h-10 border-2 border-white/10 border-t-[#4AB8FF] rounded-full animate-spin" />
    </div>
  );

  if (!conv) return (
    <div className="min-h-screen bg-[#0a0e17] text-[#e0e7ff] flex items-center justify-center">
      <div className="text-center space-y-3">
        <p className="text-white/30 text-lg">Bulunamadi.</p>
        <a href="/" className="text-[#4AB8FF] hover:text-white transition-colors text-sm">Ana sayfaya dön →</a>
      </div>
    </div>
  );

  const mObj = AI_MODELS.find((m) => m.key === conv.model);

  return (
    <div className="min-h-screen bg-[#0a0e17] text-[#e0e7ff]">
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-4">{conv.title}</h1>
          <div className="flex flex-wrap items-center gap-3">
            {mObj && (
              <span className="text-xs px-3 py-1.5 rounded-xl font-medium" style={{ background: `${mObj.color}15`, color: mObj.color, border: `1px solid ${mObj.color}30` }}>
                {mObj.label}
              </span>
            )}
            <span className="text-xs px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-white/50">
              {conv.source}
            </span>
            {conv.project && (
              <span className="text-xs px-3 py-1.5 rounded-xl bg-[#fbbf24]/5 border border-[#fbbf24]/20 text-[#fbbf24]/70">
                {conv.project}
              </span>
            )}
            {conv.tags && (
              <span className="text-xs px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-white/40">
                {conv.tags}
              </span>
            )}
            <span className="text-xs text-white/30 ml-auto">{fmtDate(conv.created_at)}</span>
          </div>
        </div>

        {/* Content */}
        <div className="surface-card rounded-2xl p-6 md:p-8 whitespace-pre-wrap leading-relaxed text-white/80 text-sm">
          {conv.content}
        </div>
      </div>
    </div>
  );
}
