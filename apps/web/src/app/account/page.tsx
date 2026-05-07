"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";

export default function AccountPage() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [portalLoading, setPortalLoading] = useState(false);

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0a0e17] text-[#e0e7ff] flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-white/30 text-lg">Oturum acilmamis.</p>
          <button onClick={() => router.push("/login")} className="px-6 py-3 bg-[#4AB8FF] text-[#0a0e17] rounded-2xl font-semibold hover:opacity-90 transition-all">Giris Yap</button>
        </div>
      </div>
    );
  }

  async function openPortal() {
    setPortalLoading(true);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      setPortalLoading(false);
    }
  }

  const planColor = user.subscription?.plan === "enterprise" ? "#fbbf24" : user.subscription?.plan === "pro" ? "#4AB8FF" : "#94a3b8";

  return (
    <div className="min-h-screen bg-[#0a0e17] text-[#e0e7ff] px-6 py-12">
      <div className="max-w-lg mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8">Hesabim</h1>

        <div className="surface-elevated rounded-3xl p-8 space-y-6 mb-6">
          <div>
            <label className="text-xs text-white/40 mb-1.5 block">Email</label>
            <p className="text-white font-medium">{user.email}</p>
          </div>
          <div>
            <label className="text-xs text-white/40 mb-1.5 block">Isim</label>
            <p className="text-white font-medium">{user.name || "—"}</p>
          </div>
        </div>

        <div className="surface-elevated rounded-3xl p-8 space-y-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-xs text-white/40 mb-1.5 block">Aktif Plan</label>
              <span className="text-lg font-semibold capitalize" style={{ color: planColor }}>
                {user.subscription?.plan || "free"}
              </span>
            </div>
            <span className={`text-xs px-3 py-1.5 rounded-xl font-medium ${user.subscription?.status === "active" ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-white/5 text-white/40 border border-white/10"}`}>
              {user.subscription?.status === "active" ? "Aktif" : user.subscription?.status || "inactive"}
            </span>
          </div>

          {user.subscription?.current_period_end && (
            <div>
              <label className="text-xs text-white/40 mb-1.5 block">Donem Sonu</label>
              <p className="text-white/70 text-sm">{new Date(user.subscription.current_period_end).toLocaleDateString("tr-TR")}</p>
            </div>
          )}

          {user.subscription?.plan !== "free" && (
            <button
              onClick={openPortal}
              disabled={portalLoading}
              className="w-full py-3 rounded-xl border border-white/10 bg-white/5 text-white/70 hover:bg-white/10 transition-all text-sm font-medium"
            >
              {portalLoading ? "Yonlendiriliyor..." : "Aboneligi Yonet"}
            </button>
          )}
        </div>

        <button
          onClick={async () => { await logout(); router.push("/"); }}
          className="w-full py-3.5 rounded-2xl border border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all text-sm font-medium"
        >
          Cikis Yap
        </button>
      </div>
    </div>
  );
}
