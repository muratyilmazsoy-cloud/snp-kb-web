"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";

const PRO_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID;
const ENTERPRISE_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_ENTERPRISE_PRICE_ID;

const PLANS = [
  {
    key: "free",
    name: "Free",
    price: "$0",
    period: "",
    description: "Bireysel kullanım için temel özellikler.",
    features: ["5 sohbet yükleme", "Temel arama", "Sohbet görüntüleme"],
    disabledFeatures: ["ZIP indirme", "Distilasyon", "Yönetim paneli"],
    cta: "Ücretsiz Başla",
    color: "#94a3b8",
    priceId: null,
  },
  {
    key: "pro",
    name: "Pro",
    price: "$9",
    period: "/ay",
    description: "Profesyonel kullanım için tüm özellikler.",
    features: ["Sınırsız sohbet yükleme", "Gelişmiş arama", "ZIP indirme", "Distilasyon", "Nostalji modu"],
    disabledFeatures: ["Yönetim paneli"],
    cta: "Pro'ya Geç",
    color: "#4AB8FF",
    priceId: PRO_PRICE_ID,
  },
  {
    key: "enterprise",
    name: "Enterprise",
    price: "$29",
    period: "/ay",
    description: "Ekipler ve yönetim için tam kontrol.",
    features: ["Pro'nun tüm özellikleri", "Yönetim paneli", "Kullanıcı yönetimi", "Öncelikli destek"],
    disabledFeatures: [],
    cta: "Enterprise'a Geç",
    color: "#fbbf24",
    priceId: ENTERPRISE_PRICE_ID,
  },
];

export default function PricingPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function subscribe(priceId: string | null | undefined, planKey: string) {
    setError("");
    if (!priceId) {
      if (!user) { router.push("/register"); return; }
      return;
    }
    if (!user) { router.push("/login?redirect=/pricing"); return; }
    if (user.subscription?.plan === planKey && user.subscription?.status === "active") return;

    setLoading(planKey);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error || "Ödeme başlatılamadı.");
        setLoading(null);
      }
    } catch (err) {
      console.error("Checkout error:", err);
      setError("Bir hata oluştu. Lütfen tekrar deneyin.");
      setLoading(null);
    }
  }

  const missingEnv = !PRO_PRICE_ID || !ENTERPRISE_PRICE_ID;

  return (
    <div className="min-h-screen bg-[#0a0e17] text-[#e0e7ff] px-6 py-16">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">Fiyatlandırma</h1>
          <p className="text-white/40 text-lg max-w-lg mx-auto">Bilginizi arşivlemek için size uygun planı seçin.</p>
        </div>

        {missingEnv && (
          <div className="mb-8 p-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-300 text-sm text-center">
            <strong>⚠️ Stripe yapılandırması eksik.</strong> Lütfen <code className="bg-amber-500/20 px-1.5 py-0.5 rounded">NEXT_PUBLIC_STRIPE_PRO_PRICE_ID</code> ve{" "}
            <code className="bg-amber-500/20 px-1.5 py-0.5 rounded">NEXT_PUBLIC_STRIPE_ENTERPRISE_PRICE_ID</code> ortam değişkenlerini ekleyin.
          </div>
        )}

        {error && (
          <div className="mb-8 p-4 rounded-2xl border border-red-500/30 bg-red-500/10 text-red-300 text-sm text-center">
            {error}
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-6">
          {PLANS.map((plan) => {
            const isCurrent = user?.subscription?.plan === plan.key && user?.subscription?.status === "active";
            const canSubscribe = !!plan.priceId || plan.key === "free";
            return (
              <div key={plan.key} className={`surface-card rounded-3xl p-8 flex flex-col ${isCurrent ? "border-2" : ""}`} style={isCurrent ? { borderColor: `${plan.color}40` } : {}}>
                <div className="mb-6">
                  <h3 className="text-xl font-semibold text-white mb-2">{plan.name}</h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold" style={{ color: plan.color }}>{plan.price}</span>
                    <span className="text-white/40">{plan.period}</span>
                  </div>
                  <p className="text-white/40 text-sm mt-2">{plan.description}</p>
                </div>

                <div className="flex-1 space-y-3 mb-8">
                  {plan.features.map((f) => (
                    <div key={f} className="flex items-center gap-3 text-sm text-white/70">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={plan.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                      {f}
                    </div>
                  ))}
                  {plan.disabledFeatures.map((f) => (
                    <div key={f} className="flex items-center gap-3 text-sm text-white/20">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                      {f}
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => subscribe(plan.priceId, plan.key)}
                  disabled={!!loading || isCurrent || (!canSubscribe && plan.key !== "free")}
                  className="w-full py-3.5 rounded-2xl font-semibold text-sm transition-all disabled:opacity-50"
                  style={{
                    background: isCurrent ? `${plan.color}20` : plan.key === "free" ? "rgba(255,255,255,0.05)" : plan.color,
                    color: isCurrent ? plan.color : plan.key === "free" ? "rgba(255,255,255,0.7)" : "#0a0e17",
                    border: plan.key === "free" ? "1px solid rgba(255,255,255,0.1)" : "none",
                  }}
                >
                  {isCurrent ? "Aktif Plan" : loading === plan.key ? "Yönlendiriliyor..." : !canSubscribe && plan.key !== "free" ? "Yakında" : plan.cta}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
