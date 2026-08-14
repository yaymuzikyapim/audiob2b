"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewPackagePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/admin/packages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || "Hata oluştu.");
    } else {
      router.push(`/admin/packages/${data.id}`);
    }
  }

  return (
    <div className="max-w-lg">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Yeni Paket Oluştur</h1>
        <p className="text-gray-400 mt-1 text-sm">Paket oluşturup içine kitaplar ekleyebilirsiniz.</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">Paket Adı *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required
            className="w-full px-4 py-2.5 rounded-xl bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
            placeholder="Starter, Pro, Enterprise..." />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">Açıklama</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
            className="w-full px-4 py-2.5 rounded-xl bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm resize-none"
            placeholder="Bu paketin içerdiği kitaplar, hedef kitle..." />
        </div>
        {error && <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm">{error}</div>}
        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={loading}
            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 text-white text-sm font-semibold rounded-xl transition-colors">
            {loading ? "Oluşturuluyor..." : "Paketi Oluştur"}
          </button>
          <button type="button" onClick={() => router.back()}
            className="px-6 py-2.5 text-gray-400 hover:text-white text-sm rounded-xl hover:bg-gray-800 transition-colors">
            İptal
          </button>
        </div>
      </form>
    </div>
  );
}
