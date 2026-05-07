"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import JSZip from "jszip";
import NeuralNetwork from "./components/NeuralNetwork";
import { useAuth } from "@/contexts/AuthContext";

interface Conversation {
  id: string;
  title: string;
  source: string;
  project: string;
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

export default function Home() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const LIMIT = 20;
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadTotal, setUploadTotal] = useState(0);
  const [uploadDone, setUploadDone] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const dragCounter = useRef(0);
  const [selectedModel, setSelectedModel] = useState("ChatGPT");
  const [expanded, setExpanded] = useState(false);
  const plan = user?.subscription?.plan || "free";
  const isFree = plan === "free";

  const fetchData = useCallback(async () => {
    setLoading(true);
    const sp = new URLSearchParams();
    if (query) sp.set("q", query);
    sp.set("page", String(page));
    sp.set("limit", String(LIMIT));
    const res = await fetch(`/api/conversations?${sp.toString()}`, { cache: "no-store" });
    const data = await res.json();
    setConversations(data.conversations || []);
    setTotalCount(data.total || 0);
    setLoading(false);
  }, [query, page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalPages = Math.ceil(totalCount / LIMIT);

  async function extractZip(zipFile: File): Promise<File[]> {
    const zip = await JSZip.loadAsync(await zipFile.arrayBuffer());
    const entries: Array<{ path: string; blob: Blob }> = [];
    const promises: Promise<unknown>[] = [];
    zip.forEach((path, entry) => {
      if (!entry.dir) promises.push(entry.async("blob").then((blob) => { entries.push({ path, blob }); }));
    });
    await Promise.all(promises);
    return entries.map((e) => new File([e.blob], e.path, { type: "application/octet-stream" }));
  }

  async function uploadFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    if (isFree && totalCount >= 5) {
      alert("Free planda en fazla 5 sohbet yukleyebilirsiniz. Pro'ya gecmek icin /pricing sayfasini ziyaret edin.");
      return;
    }
    const allFiles = Array.from(files);
    const extracted: File[] = [];
    for (const file of allFiles) {
      if (file.name.endsWith(".zip")) {
        try { extracted.push(...await extractZip(file)); } catch (e) { console.error("ZIP hatasi:", file.name, e); }
      }
    }
    const nonZip = allFiles.filter((f) => !f.name.endsWith(".zip"));
    const toUpload = [...nonZip, ...extracted];
    const mdFiles = toUpload.filter((f) => f.name.endsWith(".md") && !f.name.startsWith("_"));
    const otherFiles = toUpload.filter((f) => !f.name.endsWith(".md"));
    const enrichedFiles: File[] = [];
    for (const md of mdFiles) {
      const mdName = md.name.replace(/.*\//, "").replace(/\.md$/, "");
      const uuidMatch = mdName.match(/^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
      let mdText = await md.text();
      if (mdText.length > 100_000) mdText = mdText.slice(0, 100_000) + "\n\n[... 100.000 karakterle sinirlandirildi]";
      if (uuidMatch) {
        const uuid = uuidMatch[1];
        const attachments = otherFiles.filter((f) => f.name.includes(uuid + "_files/"));
        const attachLines = attachments.length
          ? "\n\n---\n📎 Ek Dosyalar:\n" + attachments.map((a) => "- " + a.name.replace(/.*\//, "")).join("\n")
          : "";
        enrichedFiles.push(new File([mdText + attachLines], md.name, { type: "text/markdown" }));
      } else {
        enrichedFiles.push(md);
      }
    }
    const jsonFiles = toUpload.filter((f) => f.name.endsWith("conversations.json"));
    const finalFiles = [...enrichedFiles, ...jsonFiles];
    if (finalFiles.length === 0) { alert("Yuklenecek dosya bulunamadi."); return; }

    setUploading(true); setUploadTotal(finalFiles.length); setUploadDone(0);
    let okCount = 0;
    const failedFiles: string[] = [];
    const BATCH_SIZE = 2, MAX_RETRIES = 3, RETRY_DELAY_MS = 1000;

    async function uploadWithRetry(file: File, attempt = 1): Promise<{ ok: boolean; imported: number }> {
      const formData = new FormData();
      formData.append("files", file); formData.append("source", "manual"); formData.append("model", selectedModel);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      try {
        const res = await fetch("/api/upload", { method: "POST", body: formData, signal: controller.signal });
        clearTimeout(timeoutId);
        const data = await res.json();
        if (res.ok && data.success) return { ok: true, imported: data.imported || 1 };
        return { ok: false, imported: 0 };
      } catch {
        clearTimeout(timeoutId);
        if (attempt < MAX_RETRIES) { await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * attempt)); return uploadWithRetry(file, attempt + 1); }
        return { ok: false, imported: 0 };
      }
    }

    for (let i = 0; i < finalFiles.length; i += BATCH_SIZE) {
      const batch = finalFiles.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(async (file) => {
        const result = await uploadWithRetry(file);
        if (result.ok) okCount += result.imported; else failedFiles.push(file.name.replace(/.*\//, ""));
        setUploadDone((prev) => prev + 1);
      }));
    }
    setUploading(false); setUploadTotal(0); setUploadDone(0);
    if (failedFiles.length > 0) alert(`${okCount} OK.\nHatali:\n${failedFiles.join("\n")}`);
    fetchData();
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) { uploadFiles(e.target.files); e.target.value = ""; }
  function handleDragEnter(e: React.DragEvent) { e.preventDefault(); e.stopPropagation(); dragCounter.current++; if (dragCounter.current === 1) setDragOver(true); }
  function handleDragLeave(e: React.DragEvent) { e.preventDefault(); e.stopPropagation(); dragCounter.current--; if (dragCounter.current === 0) setDragOver(false); }
  function handleDragOver(e: React.DragEvent) { e.preventDefault(); e.stopPropagation(); }
  function handleDrop(e: React.DragEvent) { e.preventDefault(); e.stopPropagation(); dragCounter.current = 0; setDragOver(false); uploadFiles(e.dataTransfer.files); }

  async function exportAll() {
    try {
      const res = await fetch("/api/export");
      if (!res.ok) throw new Error("Export basarisiz");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "snp-kb-sohbetler.zip"; document.body.appendChild(a); a.click(); a.remove(); window.URL.revokeObjectURL(url);
    } catch (e) { alert("Indirme hatasi: " + (e instanceof Error ? e.message : "Bilinmeyen")); }
  }

  function fmtDate(raw: string | null | undefined) {
    if (!raw) return "—";
    const d = new Date(raw);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("tr-TR");
  }

  const selectedModelObj = AI_MODELS.find((m) => m.key === selectedModel);
  const modelColor = selectedModelObj?.color || "#4AB8FF";

  return (
    <div className="min-h-screen bg-[#0a0e17] text-[#e0e7ff]">
      {/* ════════════════════════════════════════════════
          HERO
          ════════════════════════════════════════════════ */}
      <div className="relative min-h-[70vh] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0 flex justify-center items-center pointer-events-none">
          <NeuralNetwork width={1200} height={600} nodeCount={120} className="opacity-25" />
        </div>
        <div className="relative z-10 text-center px-6 max-w-3xl mx-auto">
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6">
            <span className="text-gradient-cyan">SnP</span>
            <br />
            <span className="text-white">Knowledge Base</span>
          </h1>
          <p className="text-lg md:text-xl text-white/50 max-w-lg mx-auto mb-10 leading-relaxed">
            AI sohbetlerinizi arsivleyin, arayin, baglayin.
            <br />
            <span className="text-white/30 text-sm">Standards & Partners — bilgi damitma sistemi</span>
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <button
              onClick={() => setExpanded(true)}
              className="px-8 py-3.5 bg-[#4AB8FF] text-[#0a0e17] rounded-2xl font-semibold text-base hover:opacity-90 transition-all glow-cyan"
            >
              Sohbet Yükle
            </button>
            <button
              onClick={() => { if (isFree) { alert("ZIP indirme Pro plan ile kullanilabilir."); return; } exportAll(); }}
              className="px-6 py-3.5 bg-white/5 text-white/80 border border-white/10 rounded-2xl font-medium text-base hover:bg-white/10 transition-all"
            >
              📥 İndir (ZIP)
            </button>
            <button
              onClick={() => { if (isFree) { alert("Distilasyon Pro plan ile kullanilabilir."); return; } window.location.href = "/distilasyon"; }}
              className="px-6 py-3.5 bg-white/5 text-[#fbbf24] border border-[#fbbf24]/20 rounded-2xl font-medium text-base hover:bg-[#fbbf24]/10 transition-all inline-flex items-center"
            >
              🧪 Distilasyon
            </button>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════
          STATS BAR
          ════════════════════════════════════════════════ */}
      <div className="border-y border-white/5">
        <div className="max-w-5xl mx-auto px-6 py-6 flex flex-wrap justify-center gap-8 md:gap-16">
          <div className="text-center">
            <div className="text-2xl font-bold text-white">{totalCount}</div>
            <div className="text-xs text-white/40 uppercase tracking-wider mt-1">Sohbet</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-white">{new Set(conversations.map((c) => c.model)).size || 0}</div>
            <div className="text-xs text-white/40 uppercase tracking-wider mt-1">AI Model</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-white">{conversations.filter((c) => c.project).length}</div>
            <div className="text-xs text-white/40 uppercase tracking-wider mt-1">Proje</div>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════
          UPLOAD SECTION
          ════════════════════════════════════════════════ */}
      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className={`overflow-hidden transition-all duration-700 ease-in-out ${expanded ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"}`}>
          <div className="surface-elevated rounded-3xl p-8 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">📤 Yeni Sohbet Yükle</h2>
              <button onClick={() => setExpanded(false)} className="text-white/40 hover:text-white transition-colors text-sm">Kapat</button>
            </div>

            {/* Model Selector */}
            <div>
              <p className="text-sm text-white/50 mb-3">AI Modeli</p>
              <div className="flex flex-wrap gap-2">
                {AI_MODELS.map((m) => (
                  <button
                    key={m.key}
                    onClick={() => setSelectedModel(m.key)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                      selectedModel === m.key
                        ? "border-[#4AB8FF] bg-[#4AB8FF]/10 text-white"
                        : "border-white/10 bg-white/[0.02] hover:border-white/20 text-white/60"
                    }`}
                  >
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: m.color }} />
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Drag-drop zone */}
            <div
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-2xl p-10 text-center transition-colors ${
                dragOver ? "border-[#4AB8FF] bg-[#4AB8FF]/5" : "border-white/10 hover:border-white/20"
              }`}
            >
              <input type="file" accept=".md,.txt,.json,.zip" multiple onChange={handleFileSelect} className="hidden" id="file-upload" />
              <label htmlFor="file-upload" className="cursor-pointer block">
                <div className="text-4xl mb-3 opacity-50">📁</div>
                <p className="font-medium text-lg text-white/80">Markdown, TXT, JSON veya ZIP yükleyin</p>
                <p className="text-sm text-white/40 mt-2">
                  {uploading ? `${uploadDone} / ${uploadTotal} yüklendi` : "Sürükleyin veya tıklayın"}
                </p>
                {uploading && (
                  <div className="mt-4 w-64 h-2 bg-white/10 rounded-full mx-auto overflow-hidden">
                    <div className="h-full bg-[#4AB8FF] transition-all" style={{ width: `${uploadTotal ? (uploadDone / uploadTotal) * 100 : 0}%` }} />
                  </div>
                )}
                {selectedModelObj && (
                  <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs" style={{ background: `${modelColor}15`, color: modelColor, border: `1px solid ${modelColor}30` }}>
                    <span className="w-2 h-2 rounded-full" style={{ background: modelColor }} />
                    Seçili: {selectedModelObj.label}
                  </div>
                )}
              </label>
            </div>
          </div>
        </div>

        {!expanded && (
          <div className="text-center">
            <button
              onClick={() => setExpanded(true)}
              className="text-sm text-[#4AB8FF] hover:text-white transition-colors"
            >
              + Yeni sohbet yüklemek için tıklayın
            </button>
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════════
          SEARCH + LIST
          ════════════════════════════════════════════════ */}
      <div className="max-w-5xl mx-auto px-6 pb-20">
        {/* Search bar */}
        <div className="surface-elevated rounded-2xl p-2 flex gap-2 mb-8">
          <input
            type="text"
            placeholder="Sohbetlerde ara..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && fetchData()}
            className="flex-1 bg-transparent px-5 py-3 text-white placeholder:text-white/30 focus:outline-none text-base"
          />
          <button
            onClick={fetchData}
            className="px-6 py-3 bg-[#4AB8FF] text-[#0a0e17] rounded-xl font-semibold hover:opacity-90 transition-all"
          >
            Ara
          </button>
          <a href="/nostalji" className="px-5 py-3 rounded-xl font-medium border border-white/10 bg-white/5 hover:bg-white/10 transition-colors text-white/80 text-center flex items-center">
            🕰️ Nostalji
          </a>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-16">
            <div className="w-10 h-10 border-2 border-white/10 border-t-[#4AB8FF] rounded-full animate-spin" />
          </div>
        )}

        {/* List */}
        {!loading && conversations.length > 0 && (
          <div className="space-y-3">
            {conversations.map((c) => (
              <a
                key={c.id}
                href={`/conversation/${c.id}`}
                className="surface-card rounded-2xl p-5 flex items-center gap-4 hover:border-[#4AB8FF]/30 transition-all group"
              >
                <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 group-hover:border-[#4AB8FF]/30 transition-all">
                  <span className="text-lg">💬</span>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-white truncate group-hover:text-[#4AB8FF] transition-colors">
                    {c.title}
                  </h3>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-white/40">
                    <span>{fmtDate(c.created_at)}</span>
                    {c.model && (
                      <span className="text-white/50">
                        {AI_MODELS.find((m) => m.key === c.model)?.label || c.model}
                      </span>
                    )}
                    {c.project && <span className="text-[#fbbf24]/60">{c.project}</span>}
                    {c.tags && <span className="text-white/30">{c.tags}</span>}
                  </div>
                </div>
                <div className="text-white/20 group-hover:text-[#4AB8FF] transition-colors">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                </div>
              </a>
            ))}
          </div>
        )}

        {/* Empty */}
        {!loading && conversations.length === 0 && (
          <div className="text-center py-20">
            <div className="text-4xl mb-4 opacity-20">🫙</div>
            <p className="text-white/30 text-lg">Henüz sohbet yok.</p>
            <button onClick={() => setExpanded(true)} className="mt-4 text-[#4AB8FF] hover:text-white transition-colors text-sm">
              İlk sohbeti yükleyin →
            </button>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-8">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-4 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-sm text-white/70 transition-all"
            >
              ← Önceki
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`w-10 h-10 rounded-xl text-sm font-medium transition-all ${
                  p === page
                    ? "bg-[#4AB8FF] text-[#0a0e17]"
                    : "border border-white/10 bg-white/5 hover:bg-white/10 text-white/60"
                }`}
              >
                {p}
              </button>
            ))}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-4 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-sm text-white/70 transition-all"
            >
              Sonraki →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
