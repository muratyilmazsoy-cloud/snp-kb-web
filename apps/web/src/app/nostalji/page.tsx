"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { parseChatContent, ChatMessage } from "@/lib/chat-parser";

interface Conversation {
  id: string;
  title: string;
  source: string;
  project: string;
  tags: string;
  model: string;
  content?: string;
  created_at: string;
}

const AI_MODELS = [
  { key: "ChatGPT", label: "ChatGPT", color: "#10a37f" },
  { key: "Claude", label: "Claude", color: "#cc785c" },
  { key: "Kimi", label: "Kimi", color: "#6366f1" },
  { key: "Gemini", label: "Gemini", color: "#4285f4" },
  { key: "Perplexity", label: "Perplexity", color: "#22d3ee" },
  { key: "Copilot", label: "Copilot", color: "#0ea5e9" },
  { key: "X", label: "X / Grok", color: "#94a3b8" },
  { key: "Diger", label: "Diger", color: "#94a3b8" },
];

const LIMIT = 50;

function safeDate(raw: string | undefined) {
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

function fmtDate(raw: string | undefined) {
  const d = safeDate(raw);
  if (!d) return "—";
  return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtDateShort(raw: string | undefined) {
  const d = safeDate(raw);
  if (!d) return "—";
  return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "short" });
}

function fmtTime(raw: string | undefined) {
  const d = safeDate(raw);
  if (!d) return "";
  return d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}

function groupDateLabel(raw: string | undefined) {
  const d = safeDate(raw);
  if (!d) return "Bilinmiyor";
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Bugun";
  if (diffDays === 1) return "Dun";
  if (diffDays < 7) return "Bu Hafta";
  if (diffDays < 30) return "Bu Ay";
  return d.toLocaleDateString("tr-TR", { month: "long", year: "numeric" });
}

export default function NostaljiPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedContent, setSelectedContent] = useState<ChatMessage[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const hasAutoSelected = useRef(false);

  const loadConversationDetail = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/conversations/${id}`, { cache: "no-store" });
      const data = await res.json();
      setSelectedContent(parseChatContent(data?.conversation?.content));
    } catch {
      setSelectedContent(parseChatContent("(Detay yuklenemedi)"));
    }
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const sp = new URLSearchParams();
      if (searchQuery) sp.set("q", searchQuery);
      sp.set("page", String(page));
      sp.set("limit", String(LIMIT));
      const res = await fetch(`/api/conversations?${sp.toString()}`, { cache: "no-store" });
      const data = await res.json();
      const items: Conversation[] = Array.isArray(data?.conversations) ? data.conversations : [];
      setConversations(items);
      setTotalCount(typeof data?.total === "number" ? data.total : 0);
      if (items.length > 0 && !hasAutoSelected.current) {
        hasAutoSelected.current = true;
        const first = items[0];
        setSelectedId(first.id);
        loadConversationDetail(first.id);
      }
    } catch {
      setConversations([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, page, loadConversationDetail]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [selectedContent]);

  function selectConversation(c: Conversation) {
    setSelectedId(c.id);
    loadConversationDetail(c.id);
  }

  const selectedConv = conversations.find((c) => c.id === selectedId);

  const groups: Record<string, Conversation[]> = {};
  for (const c of conversations) {
    const label = groupDateLabel(c?.created_at);
    if (!groups[label]) groups[label] = [];
    groups[label].push(c);
  }

  const groupOrder = ["Bugun", "Dun", "Bu Hafta", "Bu Ay"];
  const groupKeys = Object.keys(groups).sort((a, b) => {
    const ai = groupOrder.indexOf(a);
    const bi = groupOrder.indexOf(b);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return b.localeCompare(a);
  });

  const totalPages = Math.max(1, Math.ceil(totalCount / LIMIT));

  return (
    <div className="h-[calc(100vh-3.5rem)] bg-[#0a0e17] text-[#e0e7ff] flex flex-col">
      {/* Header */}
      <header className="border-b border-white/10 px-4 py-3 flex items-center gap-4 shrink-0 bg-[#0a0e17]/80 backdrop-blur-xl">
        <h1 className="text-lg font-bold shrink-0 text-white/90">🕰️ Nostalji</h1>
        <div className="flex-1 max-w-md">
          <input
            type="text"
            placeholder="Sohbetlerde ara..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-[#4AB8FF]/50 text-white placeholder:text-white/30 transition-all"
          />
        </div>
        {searchQuery && (
          <button onClick={() => { setSearchQuery(""); setPage(1); }} className="text-xs text-red-400 hover:text-red-300 shrink-0 transition-colors">Temizle</button>
        )}
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sol Sidebar */}
        <aside className="w-80 border-r border-white/10 flex flex-col shrink-0">
          <div className="flex-1 overflow-y-auto">
            {loading && conversations.length === 0 ? (
              <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-white/10 border-t-[#4AB8FF] rounded-full animate-spin" /></div>
            ) : conversations.length === 0 ? (
              <p className="text-center text-white/30 text-sm py-12">Kayit yok.</p>
            ) : (
              <div className="py-2">
                {groupKeys.map((label) => (
                  <div key={label}>
                    <div className="px-4 py-2 text-[11px] font-semibold text-[#4AB8FF]/60 uppercase tracking-widest sticky top-0 bg-[#0a0e17]/95 backdrop-blur">
                      {label}
                    </div>
                    {(groups[label] || []).map((c) => {
                      const mObj = AI_MODELS.find((m) => m.key === c?.model);
                      const isActive = c?.id === selectedId;
                      return (
                        <button
                          key={c?.id || Math.random()}
                          onClick={() => selectConversation(c)}
                          className={`w-full text-left px-4 py-3 border-b border-white/5 transition-all ${
                            isActive
                              ? "bg-[#4AB8FF]/8 border-l-2 border-l-[#4AB8FF]"
                              : "hover:bg-white/[0.02] border-l-2 border-l-transparent"
                          }`}
                        >
                          <div className="flex justify-between items-start gap-2">
                            <h4 className={`text-sm font-medium truncate ${isActive ? "text-[#4AB8FF]" : "text-white/80"}`}>{c?.title || "Basliksiz"}</h4>
                            <span className="text-[10px] text-white/30 shrink-0">{fmtDateShort(c?.created_at)}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-1.5">
                            {mObj && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-md font-medium" style={{ background: `${mObj.color}15`, color: mObj.color }}>
                                {mObj.label}
                              </span>
                            )}
                            <span className="text-[10px] text-white/25 truncate">{c?.project || "Genel"}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>

          {totalPages > 1 && (
            <div className="border-t border-white/10 px-3 py-2 flex justify-center gap-2 shrink-0">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1.5 rounded-lg text-xs border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-30 transition-all">←</button>
              <span className="text-xs px-2 py-1.5 text-white/40">{page} / {totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="px-3 py-1.5 rounded-lg text-xs border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-30 transition-all">→</button>
            </div>
          )}
        </aside>

        {/* Sag Chat Panel */}
        <section className="flex-1 flex flex-col overflow-hidden">
          {selectedConv ? (
            <>
              <div className="border-b border-white/10 px-6 py-4 shrink-0">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-lg font-semibold text-white">{selectedConv.title || "Basliksiz"}</h2>
                    <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-white/40">
                      <span>{fmtDate(selectedConv.created_at)} {fmtTime(selectedConv.created_at)}</span>
                      {selectedConv.project && <span className="text-[#fbbf24]/50">{selectedConv.project}</span>}
                      {selectedConv.tags && <span className="text-white/30">{selectedConv.tags}</span>}
                    </div>
                  </div>
                  {(() => {
                    const mObj = AI_MODELS.find((m) => m.key === selectedConv?.model);
                    return mObj ? (
                      <span className="text-xs px-3 py-1.5 rounded-xl font-medium shrink-0" style={{ background: `${mObj.color}15`, color: mObj.color, border: `1px solid ${mObj.color}30` }}>
                        {mObj.label}
                      </span>
                    ) : null;
                  })()}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
                {Array.isArray(selectedContent) && selectedContent.map((msg, i) => (
                  <div key={i} className={`flex ${msg?.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] rounded-2xl px-5 py-3.5 text-sm leading-relaxed whitespace-pre-wrap ${
                      msg?.role === "user"
                        ? "bg-[#4AB8FF]/10 border border-[#4AB8FF]/20 text-white"
                        : "bg-white/5 border border-white/10 text-[#e0e7ff]"
                    }`}>
                      {msg?.content || ""}
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>

              <div className="border-t border-white/10 px-6 py-3 shrink-0 text-xs text-white/30 text-center">
                {Array.isArray(selectedContent) ? selectedContent.length : 0} mesaj
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-3">
                <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto">
                  <span className="text-2xl">💬</span>
                </div>
                <p className="text-white/30 text-sm">Sol taraftan bir sohbet seçin.</p>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
