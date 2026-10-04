"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const SLUGS = ["tpao-teklif"];

export default function NewLinkForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [label, setLabel] = useState("");
  const [slug, setSlug] = useState("tpao-teklif");
  const [days, setDays] = useState("60");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/admin/proposals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label, slug, daysValid: parseInt(days) }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error || "Hata oluştu."); return; }
    setOpen(false);
    setLabel("");
    router.refresh();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-xl transition-colors"
      >
        + Yeni Bağlantı
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <form onSubmit={handleSubmit} className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-sm space-y-4">
        <h3 className="text-white font-semibold">Yeni Teklif Bağlantısı</h3>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Etiket</label>
          <input
            value={label} onChange={(e) => setLabel(e.target.value)} required
            placeholder="TPAO"
            className="w-full px-4 py-2.5 rounded-xl bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Teklif Dosyası</label>
          <select
            value={slug} onChange={(e) => setSlug(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {SLUGS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Geçerlilik (gün)</label>
          <input
            type="number" min="1" max="365" value={days} onChange={(e) => setDays(e.target.value)} required
            className="w-full px-4 py-2.5 rounded-xl bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <div className="flex gap-3 pt-1">
          <button type="submit" disabled={loading}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 text-white text-sm font-semibold rounded-xl transition-colors">
            {loading ? "Oluşturuluyor..." : "Oluştur"}
          </button>
          <button type="button" onClick={() => setOpen(false)}
            className="px-5 py-2.5 text-gray-400 hover:text-white text-sm rounded-xl hover:bg-gray-800 transition-colors">
            İptal
          </button>
        </div>
      </form>
    </div>
  );
}
