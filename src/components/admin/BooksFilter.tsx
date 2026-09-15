"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

interface Props {
  categories: { name: string }[];
  total: number;
  filtered: number;
}

export default function BooksFilter({ categories, total, filtered }: Props) {
  const router = useRouter();
  const sp = useSearchParams();

  const update = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(sp.toString());
      if (value) params.set(key, value);
      else params.delete(key);
      router.push(`/admin/books?${params.toString()}`);
    },
    [router, sp]
  );

  const category = sp.get("category") ?? "";
  const status   = sp.get("status") ?? "";
  const q        = sp.get("q") ?? "";
  const hasFilter = category || status || q;

  return (
    <div className="flex flex-wrap items-center gap-3 mb-6">
      {/* Arama */}
      <input
        type="text"
        placeholder="Kitap veya yazar ara..."
        defaultValue={q}
        onChange={(e) => {
          clearTimeout((window as any).__bfq);
          (window as any).__bfq = setTimeout(() => update("q", e.target.value.trim()), 350);
        }}
        className="px-3 py-2 rounded-xl bg-gray-800 border border-gray-700 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 w-56"
      />

      {/* Kategori */}
      <select
        value={category}
        onChange={(e) => update("category", e.target.value)}
        className="px-3 py-2 rounded-xl bg-gray-800 border border-gray-700 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
      >
        <option value="">Tüm kategoriler</option>
        {categories.map((c) => (
          <option key={c.name} value={c.name}>{c.name}</option>
        ))}
      </select>

      {/* Durum */}
      <select
        value={status}
        onChange={(e) => update("status", e.target.value)}
        className="px-3 py-2 rounded-xl bg-gray-800 border border-gray-700 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
      >
        <option value="">Tüm durumlar</option>
        <option value="active">Aktif</option>
        <option value="passive">Pasif</option>
      </select>

      {/* Sonuç sayısı + temizle */}
      <span className="text-sm text-gray-500 ml-1">
        {hasFilter ? `${filtered} / ${total} kitap` : `${total} kitap`}
      </span>

      {hasFilter && (
        <button
          onClick={() => router.push("/admin/books")}
          className="text-xs text-gray-400 hover:text-white transition-colors px-2 py-1 rounded-lg hover:bg-gray-800"
        >
          ✕ Filtreyi temizle
        </button>
      )}
    </div>
  );
}
