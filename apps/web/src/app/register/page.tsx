"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 6) { setError("Sifre en az 6 karakter olmali"); return; }
    setLoading(true);
    const ok = await register(email, password, name);
    setLoading(false);
    if (ok) router.push("/pricing");
    else setError("Kayit basarisiz veya email zaten kullaniliyor");
  }

  return (
    <div className="min-h-screen bg-[#0a0e17] text-[#e0e7ff] flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-white mb-2">Kayit Ol</h1>
          <p className="text-white/40 text-sm">SnP Knowledge Base uyesi olun.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs text-white/40 mb-1.5 block">Isim</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[#4AB8FF]/50 transition-all"
              placeholder="Ad Soyad"
            />
          </div>
          <div>
            <label className="text-xs text-white/40 mb-1.5 block">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[#4AB8FF]/50 transition-all"
              placeholder="siz@ornek.com"
            />
          </div>
          <div>
            <label className="text-xs text-white/40 mb-1.5 block">Sifre</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[#4AB8FF]/50 transition-all"
              placeholder="En az 6 karakter"
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-[#4AB8FF] text-[#0a0e17] rounded-2xl font-semibold hover:opacity-90 transition-all disabled:opacity-50"
          >
            {loading ? "Kayit yapiliyor..." : "Kayit Ol"}
          </button>
        </form>

        <p className="text-center text-sm text-white/30 mt-6">
          Zaten hesabiniz var mi?{" "}
          <Link href="/login" className="text-[#4AB8FF] hover:text-white transition-colors">Giris Yap</Link>
        </p>
      </div>
    </div>
  );
}
