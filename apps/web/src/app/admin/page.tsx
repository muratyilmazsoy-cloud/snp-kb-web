"use client";

import { useEffect, useState, useCallback } from "react";

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

interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  stripe_customer_id: string | null;
  created_at: string;
  subscription: { plan: string; status: string; current_period_end: string | null } | null;
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

function fmtDate(raw: string) {
  const d = new Date(raw);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("tr-TR");
}

function getPlanColor(plan?: string): string {
  switch (plan) {
    case "pro": return "#4AB8FF";
    case "enterprise": return "#fbbf24";
    default: return "#94a3b8";
  }
}

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<"sohbetler" | "kullanicilar">("sohbetler");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editOpen, setEditOpen] = useState(false);
  const [editData, setEditData] = useState<Partial<Conversation>>({});
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [convRes, userRes] = await Promise.all([
        fetch("/api/conversations?limit=500", { cache: "no-store" }),
        fetch("/api/admin/users", { cache: "no-store" }),
      ]);
      const convData = await convRes.json();
      const userData = await userRes.json();
      setConversations(convData.conversations || []);
      setUsers(userData.users || []);
    } catch { /* */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const filtered = conversations.filter((c) =>
    (c.title || "").toLowerCase().includes(search.toLowerCase()) ||
    (c.tags || "").toLowerCase().includes(search.toLowerCase()) ||
    (c.project || "").toLowerCase().includes(search.toLowerCase())
  );

  function toggleSelect(id: string) {
    setSelected((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }
  function toggleSelectAll() {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((c) => c.id)));
  }
  function openEdit(c: Conversation) {
    setEditId(c.id);
    setEditData({ title: c.title, model: c.model, project: c.project, tags: c.tags, created_at: c.created_at?.slice(0, 10) });
    setEditOpen(true);
  }
  async function saveEdit() {
    if (!editId) return;
    const body: Record<string, string> = {};
    if (editData.title !== undefined) body.title = editData.title;
    if (editData.model !== undefined) body.model = editData.model;
    if (editData.project !== undefined) body.project = editData.project;
    if (editData.tags !== undefined) body.tags = editData.tags;
    if (editData.created_at !== undefined) body.created_at = editData.created_at;
    await fetch(`/api/conversations/${editId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setEditOpen(false);
    fetchAll();
  }
  async function deleteOne(id: string) {
    await fetch(`/api/conversations/${id}`, { method: "DELETE" });
    setDeleteConfirm(null);
    fetchAll();
  }
  async function bulkDelete() {
    await Promise.all(Array.from(selected).map((id) => fetch(`/api/conversations/${id}`, { method: "DELETE" })));
    setSelected(new Set());
    setBulkDeleteConfirm(false);
    fetchAll();
  }

  return (
    <div className="min-h-screen bg-[#0a0e17] text-[#e0e7ff] px-6 py-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Yonetim Paneli</h1>
            <p className="text-white/30 text-sm mt-1">{activeTab === "sohbetler" ? `${conversations.length} kayit` : `${users.length} kullanici`}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex bg-white/5 rounded-xl p-1">
              <button onClick={() => setActiveTab("sohbetler")} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === "sohbetler" ? "bg-[#4AB8FF]/20 text-[#4AB8FF]" : "text-white/40 hover:text-white"}`}>Sohbetler</button>
              <button onClick={() => setActiveTab("kullanicilar")} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === "kullanicilar" ? "bg-[#4AB8FF]/20 text-[#4AB8FF]" : "text-white/40 hover:text-white"}`}>Kullanicilar</button>
            </div>
            {activeTab === "sohbetler" && (
              <>
                <input type="text" placeholder="Ara..." value={search} onChange={(e) => setSearch(e.target.value)} className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#4AB8FF]/50 w-56 transition-all" />
                {selected.size > 0 && (
                  <button onClick={() => setBulkDeleteConfirm(true)} className="px-4 py-2 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl text-sm font-medium hover:bg-red-500/20 transition-all">({selected.size}) Sil</button>
                )}
              </>
            )}
          </div>
        </div>

        {activeTab === "sohbetler" && (
          <>
            {loading ? (
              <div className="flex justify-center py-20"><div className="w-10 h-10 border-2 border-white/10 border-t-[#4AB8FF] rounded-full animate-spin" /></div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-20"><p className="text-white/20 text-lg">Kayit bulunamadi.</p></div>
            ) : (
              <div className="surface-elevated rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-white/40 text-left">
                        <th className="px-4 py-3 w-10"><input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0} onChange={toggleSelectAll} className="rounded border-white/20 bg-white/5" /></th>
                        <th className="px-4 py-3 font-medium">Baslik</th>
                        <th className="px-4 py-3 font-medium">Model</th>
                        <th className="px-4 py-3 font-medium">Proje</th>
                        <th className="px-4 py-3 font-medium">Etiketler</th>
                        <th className="px-4 py-3 font-medium">Tarih</th>
                        <th className="px-4 py-3 font-medium text-right">Islem</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((c) => {
                        const mObj = AI_MODELS.find((m) => m.key === c.model);
                        return (
                          <tr key={c.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                            <td className="px-4 py-3"><input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleSelect(c.id)} className="rounded border-white/20 bg-white/5" /></td>
                            <td className="px-4 py-3"><a href={`/conversation/${c.id}`} className="text-white hover:text-[#4AB8FF] transition-colors font-medium truncate max-w-[200px] inline-block">{c.title}</a></td>
                            <td className="px-4 py-3">{mObj && <span className="text-xs px-2 py-1 rounded-lg font-medium" style={{ background: `${mObj.color}15`, color: mObj.color, border: `1px solid ${mObj.color}30` }}>{mObj.label}</span>}</td>
                            <td className="px-4 py-3 text-white/50">{c.project || "—"}</td>
                            <td className="px-4 py-3 text-white/40">{c.tags || "—"}</td>
                            <td className="px-4 py-3 text-white/40 whitespace-nowrap">{fmtDate(c.created_at)}</td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex justify-end gap-2">
                                <button onClick={() => openEdit(c)} className="px-3 py-1.5 rounded-lg text-xs border border-white/10 bg-white/5 hover:bg-white/10 text-white/70 transition-all">Duzenle</button>
                                <button onClick={() => setDeleteConfirm(c.id)} className="px-3 py-1.5 rounded-lg text-xs border border-red-500/20 bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-all">Sil</button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === "kullanicilar" && (
          <div className="surface-elevated rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-white/40 text-left">
                    <th className="px-4 py-3 font-medium">Email</th>
                    <th className="px-4 py-3 font-medium">Isim</th>
                    <th className="px-4 py-3 font-medium">Plan</th>
                    <th className="px-4 py-3 font-medium">Durum</th>
                    <th className="px-4 py-3 font-medium">Donem Sonu</th>
                    <th className="px-4 py-3 font-medium">Kayit Tarihi</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3 text-white">{u.email}</td>
                      <td className="px-4 py-3 text-white/50">{u.name || "—"}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs px-2 py-1 rounded-lg font-medium capitalize" style={{ background: `${getPlanColor(u.subscription?.plan)}15`, color: getPlanColor(u.subscription?.plan), border: `1px solid ${getPlanColor(u.subscription?.plan)}30` }}>
                          {u.subscription?.plan || "free"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-1 rounded-lg font-medium ${u.subscription?.status === "active" ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-white/5 text-white/40 border border-white/10"}`}>
                          {u.subscription?.status || "inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-white/40 whitespace-nowrap">{u.subscription?.current_period_end ? fmtDate(u.subscription.current_period_end) : "—"}</td>
                      <td className="px-4 py-3 text-white/40 whitespace-nowrap">{fmtDate(u.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Edit Modal */}
        {editOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }}>
            <div className="surface-elevated rounded-3xl p-8 w-full max-w-lg space-y-5">
              <h2 className="text-xl font-semibold text-white">Kayit Duzenle</h2>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-white/40 mb-1.5 block">Baslik</label>
                  <input value={editData.title || ""} onChange={(e) => setEditData({ ...editData, title: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#4AB8FF]/50 transition-all" />
                </div>
                <div>
                  <label className="text-xs text-white/40 mb-1.5 block">Model</label>
                  <select value={editData.model || ""} onChange={(e) => setEditData({ ...editData, model: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#4AB8FF]/50 transition-all">
                    {AI_MODELS.map((m) => <option key={m.key} value={m.key} style={{ background: "#0a0e17" }}>{m.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-white/40 mb-1.5 block">Proje</label>
                  <input value={editData.project || ""} onChange={(e) => setEditData({ ...editData, project: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#4AB8FF]/50 transition-all" />
                </div>
                <div>
                  <label className="text-xs text-white/40 mb-1.5 block">Etiketler</label>
                  <input value={editData.tags || ""} onChange={(e) => setEditData({ ...editData, tags: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#4AB8FF]/50 transition-all" />
                </div>
                <div>
                  <label className="text-xs text-white/40 mb-1.5 block">Tarih</label>
                  <input type="date" value={editData.created_at || ""} onChange={(e) => setEditData({ ...editData, created_at: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#4AB8FF]/50 transition-all" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setEditOpen(false)} className="flex-1 py-3 rounded-xl border border-white/10 text-white/60 hover:bg-white/5 transition-all text-sm font-medium">Iptal</button>
                <button onClick={saveEdit} className="flex-1 py-3 rounded-xl bg-[#4AB8FF] text-[#0a0e17] font-semibold hover:opacity-90 transition-all text-sm">Kaydet</button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirm */}
        {deleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }}>
            <div className="surface-elevated rounded-3xl p-8 w-full max-w-sm text-center space-y-5">
              <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto"><span className="text-2xl">🗑️</span></div>
              <h3 className="text-lg font-semibold text-white">Silmek istediginize emin misiniz?</h3>
              <p className="text-white/40 text-sm">Bu islem geri alinamaz.</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-3 rounded-xl border border-white/10 text-white/60 hover:bg-white/5 transition-all text-sm font-medium">Iptal</button>
                <button onClick={() => deleteOne(deleteConfirm)} className="flex-1 py-3 rounded-xl bg-red-500 text-white font-semibold hover:bg-red-600 transition-all text-sm">Sil</button>
              </div>
            </div>
          </div>
        )}

        {/* Bulk Delete Confirm */}
        {bulkDeleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }}>
            <div className="surface-elevated rounded-3xl p-8 w-full max-w-sm text-center space-y-5">
              <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto"><span className="text-2xl">🗑️</span></div>
              <h3 className="text-lg font-semibold text-white">{selected.size} kayit silinsin mi?</h3>
              <p className="text-white/40 text-sm">Bu islem geri alinamaz.</p>
              <div className="flex gap-3">
                <button onClick={() => setBulkDeleteConfirm(false)} className="flex-1 py-3 rounded-xl border border-white/10 text-white/60 hover:bg-white/5 transition-all text-sm font-medium">Iptal</button>
                <button onClick={bulkDelete} className="flex-1 py-3 rounded-xl bg-red-500 text-white font-semibold hover:bg-red-600 transition-all text-sm">Hepsini Sil</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
