"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface Book { id: string; title: string; author: string; duration: number }

function formatDuration(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}s ${m}dk`;
  return `${m}dk`;
}

export default function PackageBookManager({
  packageId,
  inPackageIds,
  currentBooks,
  allBooks,
}: {
  packageId: string;
  inPackageIds: string[];
  currentBooks: Book[];
  allBooks: Book[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set(inPackageIds));
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isPending, startTransition] = useTransition();

  const hasChanges = JSON.stringify([...selected].sort()) !== JSON.stringify([...inPackageIds].sort());

  const filteredBooks = allBooks.filter(
    (b) =>
      b.title.toLowerCase().includes(search.toLowerCase()) ||
      b.author.toLowerCase().includes(search.toLowerCase())
  );

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    await fetch(`/api/admin/packages/${packageId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookIds: Array.from(selected) }),
    });
    setSaving(false);
    setAdding(false);
    startTransition(() => router.refresh());
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
        <h2 className="text-white font-semibold">Paketteki Kitaplar ({selected.size})</h2>
        <div className="flex gap-2">
          {hasChanges && (
            <button onClick={handleSave} disabled={saving}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 text-white text-sm font-semibold rounded-xl transition-colors">
              {saving ? "Kaydediliyor..." : "Değişiklikleri Kaydet"}
            </button>
          )}
          <button onClick={() => setAdding((v) => !v)}
            className="px-4 py-1.5 text-sm font-medium text-gray-300 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-xl transition-colors">
            {adding ? "Kapat" : "+ Kitap Ekle/Çıkar"}
          </button>
        </div>
      </div>

      {adding && (
        <div className="border-b border-gray-800 p-4">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Kitap veya yazar ara..."
            className="w-full px-4 py-2.5 rounded-xl bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
          />
          <div className="mt-3 max-h-64 overflow-y-auto space-y-1">
            {filteredBooks.map((b) => (
              <label key={b.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selected.has(b.id)}
                  onChange={() => toggle(b.id)}
                  className="accent-emerald-500 w-4 h-4"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-white text-sm font-medium truncate">{b.title}</div>
                  <div className="text-gray-500 text-xs">{b.author} · {formatDuration(b.duration)}</div>
                </div>
              </label>
            ))}
            {filteredBooks.length === 0 && (
              <div className="text-gray-500 text-sm text-center py-4">Sonuç bulunamadı.</div>
            )}
          </div>
        </div>
      )}

      <div className="divide-y divide-gray-800">
        {currentBooks.filter((b) => selected.has(b.id)).length === 0 && (
          <div className="px-6 py-8 text-center text-gray-500 text-sm">
            Pakette henüz kitap yok. "Kitap Ekle/Çıkar" ile ekleyin.
          </div>
        )}
        {allBooks.filter((b) => selected.has(b.id)).map((b) => (
          <div key={b.id} className="flex items-center justify-between px-6 py-3">
            <div>
              <div className="text-white text-sm font-medium">{b.title}</div>
              <div className="text-gray-500 text-xs">{b.author}</div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-gray-500 text-xs">{formatDuration(b.duration)}</span>
              {adding && (
                <button onClick={() => toggle(b.id)} className="text-red-400 hover:text-red-300 text-xs transition-colors">Çıkar</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
