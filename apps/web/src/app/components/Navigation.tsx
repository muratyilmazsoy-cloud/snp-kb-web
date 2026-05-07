"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Menu, X, Brain, Archive, FlaskConical, Settings, LogIn, User } from "lucide-react";

const NAV_ITEMS = [
  { label: "Anasayfa", href: "/", icon: Brain },
  { label: "Nostalji", href: "/nostalji", icon: Archive },
  { label: "Distilasyon", href: "/distilasyon", icon: FlaskConical },
];

export default function Navigation() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const isActive = (href: string) => pathname === href;

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0a0e17]/90 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-[1280px] mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#4AB8FF]/10 border border-[#4AB8FF]/20 flex items-center justify-center">
              <Brain size={18} className="text-[#4AB8FF]" />
            </div>
            <span className="text-white font-semibold text-sm tracking-tight">
              SnP <span className="text-white/40 font-normal">Knowledge Base</span>
            </span>
          </Link>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    active ? "text-[#4AB8FF] bg-[#4AB8FF]/10" : "text-white/50 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <Icon size={16} />{item.label}
                </Link>
              );
            })}
            {user?.subscription?.plan === "enterprise" && (
              <Link href="/admin" className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${isActive("/admin") ? "text-[#4AB8FF] bg-[#4AB8FF]/10" : "text-white/50 hover:text-white hover:bg-white/5"}`}>
                <Settings size={16} />Yonetim
              </Link>
            )}
          </div>

          {/* Desktop auth */}
          <div className="hidden md:flex items-center gap-2">
            {user ? (
              <>
                <Link href="/account" className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white/70 hover:text-white hover:bg-white/5 transition-all">
                  <User size={16} />
                  <span className="text-xs px-2 py-0.5 rounded-lg font-medium capitalize" style={{ background: `${getPlanColor(user.subscription?.plan)}15`, color: getPlanColor(user.subscription?.plan), border: `1px solid ${getPlanColor(user.subscription?.plan)}30` }}>
                    {user.subscription?.plan || "free"}
                  </span>
                </Link>
                <button onClick={() => logout()} className="px-4 py-2 rounded-xl text-sm font-medium text-white/40 hover:text-white hover:bg-white/5 transition-all">Cikis</button>
              </>
            ) : (
              <>
                <Link href="/login" className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white/50 hover:text-white hover:bg-white/5 transition-all">
                  <LogIn size={16} />Giris
                </Link>
                <Link href="/register" className="px-4 py-2 rounded-xl text-sm font-medium bg-[#4AB8FF] text-[#0a0e17] hover:opacity-90 transition-all">Kayit Ol</Link>
              </>
            )}
          </div>

          <button onClick={() => setMobileOpen(true)} className="md:hidden flex items-center justify-center w-10 h-10 rounded-lg text-white/70 hover:text-white hover:bg-white/5 transition-all" style={{ border: "1px solid rgba(255,255,255,0.15)" }}>
            <Menu size={22} />
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="fixed inset-0 flex flex-col" style={{ background: "#0a0e17", zIndex: 99999 }}>
          <div className="flex items-center justify-between px-4 h-14 border-b border-white/10 flex-shrink-0">
            <span className="text-white font-semibold text-sm">SnP KB</span>
            <button onClick={() => setMobileOpen(false)} className="w-10 h-10 flex items-center justify-center rounded-lg bg-white/5 text-white/60 hover:text-white hover:bg-white/10 transition-all">
              <X size={22} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)} className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl mb-2 transition-all ${active ? "bg-[#4AB8FF]/10 border border-[#4AB8FF]/20" : "border border-white/5 hover:bg-white/[0.03]"}`} style={{ background: active ? undefined : "rgba(255,255,255,0.02)" }}>
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: active ? "rgba(74,184,255,0.15)" : "rgba(255,255,255,0.05)", border: active ? "1px solid rgba(74,184,255,0.25)" : "1px solid rgba(255,255,255,0.1)" }}>
                    <Icon size={22} className={active ? "text-[#4AB8FF]" : "text-white/50"} />
                  </div>
                  <span className={`flex-1 text-left text-[15px] ${active ? "text-[#4AB8FF] font-medium" : "text-white"}`}>{item.label}</span>
                </Link>
              );
            })}
            {user?.subscription?.plan === "enterprise" && (
              <Link href="/admin" onClick={() => setMobileOpen(false)} className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl mb-2 transition-all ${isActive("/admin") ? "bg-[#4AB8FF]/10 border border-[#4AB8FF]/20" : "border border-white/5 hover:bg-white/[0.03]"}`}>
                <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: isActive("/admin") ? "rgba(74,184,255,0.15)" : "rgba(255,255,255,0.05)", border: isActive("/admin") ? "1px solid rgba(74,184,255,0.25)" : "1px solid rgba(255,255,255,0.1)" }}>
                  <Settings size={22} className={isActive("/admin") ? "text-[#4AB8FF]" : "text-white/50"} />
                </div>
                <span className="flex-1 text-left text-[15px] text-white">Yonetim</span>
              </Link>
            )}

            <div className="border-t border-white/10 mt-4 pt-4">
              {user ? (
                <>
                  <Link href="/account" onClick={() => setMobileOpen(false)} className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl mb-2 border border-white/5 hover:bg-white/[0.03] transition-all" style={{ background: "rgba(255,255,255,0.02)" }}>
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-white/5 border border-white/10">
                      <User size={22} className="text-white/50" />
                    </div>
                    <div className="flex-1 text-left">
                      <div className="text-[15px] text-white">{user.email}</div>
                      <div className="text-xs text-white/30 capitalize">{user.subscription?.plan || "free"}</div>
                    </div>
                  </Link>
                  <button onClick={() => { logout(); setMobileOpen(false); }} className="w-full py-3 rounded-xl border border-white/10 text-white/60 hover:bg-white/5 transition-all text-sm font-medium">Cikis Yap</button>
                </>
              ) : (
                <div className="flex gap-3">
                  <Link href="/login" onClick={() => setMobileOpen(false)} className="flex-1 py-3 rounded-xl border border-white/10 text-white/60 hover:bg-white/5 transition-all text-sm font-medium text-center">Giris Yap</Link>
                  <Link href="/register" onClick={() => setMobileOpen(false)} className="flex-1 py-3 rounded-xl bg-[#4AB8FF] text-[#0a0e17] font-semibold hover:opacity-90 transition-all text-sm text-center">Kayit Ol</Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function getPlanColor(plan?: string): string {
  switch (plan) {
    case "pro": return "#4AB8FF";
    case "enterprise": return "#fbbf24";
    default: return "#94a3b8";
  }
}
