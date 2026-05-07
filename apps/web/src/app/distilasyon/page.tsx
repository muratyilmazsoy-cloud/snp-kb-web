"use client";

import { useEffect, useState } from "react";
import NeuralNetwork from "../components/NeuralNetwork";

interface DistilData {
  modelCounts: Record<string, number>;
  categoryScores: Record<string, number>;
  total: number;
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

const CATEGORIES = [
  { key: "para", label: "Para", emoji: "💰", color: "#fbbf24" },
  { key: "mutluluk", label: "Mutluluk", emoji: "😊", color: "#f472b6" },
  { key: "basari", label: "Basari", emoji: "🏆", color: "#4ade80" },
  { key: "huzur", label: "Huzur", emoji: "🕊️", color: "#60a5fa" },
  { key: "bilgi", label: "Bilgi", emoji: "📚", color: "#a78bfa" },
  { key: "ilham", label: "Ilham", emoji: "💡", color: "#fb923c" },
];

export default function DistilasyonPage() {
  const [data, setData] = useState<DistilData | null>(null);
  const [loading, setLoading] = useState(true);
  const [animStarted, setAnimStarted] = useState(false);

  useEffect(() => {
    fetch("/api/distilasyon", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); setTimeout(() => setAnimStarted(true), 600); })
      .catch(() => setLoading(false));
  }, []);

  const maxModelCount = Math.max(...Object.values(data?.modelCounts || {}), 1);
  const maxCatScore = Math.max(...Object.values(data?.categoryScores || {}), 1);

  return (
    <div className="min-h-screen bg-[#0a0e17] text-[#e0e7ff] relative overflow-hidden">
      <style>{`
        @keyframes drip {
          0% { transform: translateY(0) scale(1); opacity: 0; }
          8% { opacity: 1; transform: translateY(0) scale(1.1); }
          90% { opacity: 1; }
          100% { transform: translateY(380px) scale(0.6); opacity: 0; }
        }
        @keyframes glow {
          0%, 100% { filter: drop-shadow(0 0 6px currentColor); }
          50% { filter: drop-shadow(0 0 18px currentColor) drop-shadow(0 0 36px currentColor); }
        }
        @keyframes bubble {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        .drip-anim {
          animation: drip 2.2s ease-in infinite;
        }
        .glow-anim {
          animation: glow 2.5s ease-in-out infinite;
        }
        .bubble-anim {
          animation: bubble 3s ease-in-out infinite;
        }
      `}</style>

      {/* Neural Network */}
      <BrainNetworkSection loading={loading} hasData={!!(data && data.total > 0)} />

      {loading ? (
        <div className="flex items-center justify-center h-[70vh]">
          <div className="text-center space-y-4">
            <div className="w-10 h-10 border-2 border-white/10 border-t-[#4AB8FF] rounded-full animate-spin mx-auto" />
            <p className="text-white/40 text-sm">Bilgiler imbikten geçiriliyor...</p>
          </div>
        </div>
      ) : !data || data.total === 0 ? (
        <div className="flex items-center justify-center h-[70vh]">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto">
              <span className="text-2xl">🧪</span>
            </div>
            <p className="text-white/30">Henüz damıtılacak sohbet yok.</p>
            <a href="/" className="text-[#4AB8FF] hover:text-white transition-colors text-sm">Sohbet yükle →</a>
          </div>
        </div>
      ) : (
        <div className="relative z-10 max-w-6xl mx-auto px-6">
          {/* Stats */}
          <div className="text-center py-10">
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">🧪 Bilgi Distilasyonu</h1>
            <p className="text-white/40 text-sm">{data.total} sohbet damıtıldı</p>
          </div>

          {/* AI Modelleri */}
          <section className="py-8">
            <h2 className="text-center text-xs font-semibold text-[#4AB8FF]/50 uppercase tracking-[0.2em] mb-10">
              Yapay Zeka İmbikleri
            </h2>
            <div className="flex justify-center items-end gap-6 md:gap-10 flex-wrap">
              {AI_MODELS.map((m) => {
                const count = data.modelCounts[m.key] || 0;
                if (count === 0) return null;
                const fillPct = Math.min(100, (count / maxModelCount) * 100);
                const drops = Math.min(count, 12);
                return (
                  <div key={m.key} className="flex flex-col items-center gap-2">
                    <div
                      className="relative w-20 h-20 md:w-24 md:h-24 rounded-full border-2 glow-anim flex items-center justify-center"
                      style={{ borderColor: m.color + "60", color: m.color }}
                    >
                      <div className="absolute inset-1 rounded-full opacity-20" style={{ background: `radial-gradient(circle at 30% 30%, ${m.color}, transparent 70%)` }} />
                      <span className="text-xs md:text-sm font-bold z-10 text-center leading-tight">{m.label}</span>
                      <div className="absolute -bottom-1 w-4 h-4 rounded-full" style={{ background: m.color, boxShadow: `0 0 10px ${m.color}` }} />
                    </div>
                    <div className="w-3 rounded-full relative overflow-hidden" style={{ height: `${40 + fillPct * 0.8}px`, background: m.color + "15" }}>
                      <div className="absolute bottom-0 left-0 right-0 transition-all duration-1000" style={{ height: `${fillPct}%`, background: `linear-gradient(180deg, ${m.color}60, ${m.color}20)` }} />
                    </div>
                    <div className="relative h-24 w-6">
                      {animStarted && Array.from({ length: drops }).map((_, i) => (
                        <div key={i} className="absolute left-1/2 drip-anim" style={{ top: "0", marginLeft: "-5px", animationDelay: `${i * 0.35 + Math.random() * 0.3}s`, animationDuration: `${2 + Math.random() * 1.2}s` }}>
                          <div className="w-2.5 h-3.5 rounded-full" style={{ background: `radial-gradient(circle at 30% 30%, ${m.color}, ${m.color}80)`, boxShadow: `0 0 8px ${m.color}80` }} />
                        </div>
                      ))}
                    </div>
                    <span className="text-[10px] text-white/30">{count} sohbet</span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Divider */}
          <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent my-8" />

          {/* Kategoriler */}
          <section className="py-8 pb-16">
            <h2 className="text-center text-xs font-semibold text-[#4AB8FF]/50 uppercase tracking-[0.2em] mb-10">
              Damıtılmış Değerler
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {CATEGORIES.map((cat) => {
                const score = data.categoryScores[cat.key] || 0;
                const pct = Math.min(100, (score / maxCatScore) * 100);
                return (
                  <div key={cat.key} className="relative surface-card rounded-2xl p-4 text-center overflow-hidden h-48 flex flex-col">
                    <div className="absolute bottom-0 left-0 right-0 rounded-2xl transition-all duration-[2500ms] ease-out" style={{ height: animStarted ? `${Math.max(8, pct)}%` : "0%", background: `linear-gradient(180deg, ${cat.color}10, ${cat.color}35)` }} />
                    <div className="relative z-10 flex-1 flex flex-col justify-center">
                      <div className="text-3xl mb-2 bubble-anim">{cat.emoji}</div>
                      <div className="text-sm font-semibold" style={{ color: cat.color }}>{cat.label}</div>
                      <div className="text-2xl font-bold mt-1 text-white">{animStarted ? <CountUp target={score} duration={2500} /> : 0}</div>
                      <div className="text-[10px] text-white/30 mt-1">{score > 0 ? "damıtıldı" : "bekleniyor"}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Ozet */}
          <div className="text-center pb-16 text-sm text-white/30">
            <p>{data.total} sohbet {Object.keys(data.modelCounts).length} AI modelinde işlenerek {Object.values(data.categoryScores).reduce((a, b) => a + b, 0)} değerli çıktı elde edildi.</p>
          </div>
        </div>
      )}
    </div>
  );
}

function BrainNetworkSection({ loading, hasData }: { loading: boolean; hasData: boolean }) {
  const [w, setW] = useState(1000);
  useEffect(() => {
    const update = () => setW(Math.min(1000, window.innerWidth - 40));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  if (loading || !hasData) return null;
  return (
    <div className="relative z-10 flex justify-center px-4 pt-6 pb-2">
      <NeuralNetwork width={w} height={260} nodeCount={90} className="opacity-60" />
    </div>
  );
}

function CountUp({ target, duration }: { target: number; duration: number }) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (target <= 0) { setValue(0); return; }
    const start = performance.now();
    const animate = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      setValue(Math.floor((1 - Math.pow(1 - p, 3)) * target));
      if (p < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [target, duration]);
  return <>{value}</>;
}
