"use client";

import { useState, useRef } from "react";
import Link from "next/link";

const COLUMNS = ["isbn", "title", "author", "narrator", "category", "duration_minutes", "publish_date", "description"] as const;
const LABELS: Record<string, string> = {
  isbn: "ISBN",
  title: "Başlık *",
  author: "Yazar *",
  narrator: "Seslendiren",
  category: "Kategori",
  duration_minutes: "Süre (dakika)",
  publish_date: "Yayın Tarihi (YYYY-MM-DD)",
  description: "Açıklama",
};

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split("\n").filter(Boolean);
  if (lines.length < 2) return [];

  const header = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  return lines.slice(1).map((line) => {
    const values = line.split(",");
    const row: Record<string, string> = {};
    header.forEach((key, i) => { row[key] = (values[i] ?? "").trim().replace(/^"|"$/g, ""); });
    return row;
  });
}

export default function ImportPage() {
  const [csvText, setCsvText] = useState("");
  const [preview, setPreview] = useState<Record<string, string>[]>([]);
  const [status, setStatus] = useState<{ created: number; skipped: number; errors: string[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleParse() {
    const rows = parseCSV(csvText);
    setPreview(rows.slice(0, 5));
    setStatus(null);
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setCsvText(text);
      setPreview(parseCSV(text).slice(0, 5));
      setStatus(null);
    };
    reader.readAsText(f, "UTF-8");
  }

  async function handleImport() {
    const rows = parseCSV(csvText);
    if (rows.length === 0) return;
    setLoading(true);
    setStatus(null);
    const res = await fetch("/api/admin/books/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows }),
    });
    const data = await res.json();
    setStatus(data);
    setLoading(false);
  }

  const templateCSV = COLUMNS.join(",") + "\n" +
    '9786055571344,Atomik Alışkanlıklar,James Clear,Ahmet Yılmaz,Kişisel Gelişim,480,2021-01-01,Küçük alışkanlıkların büyük farkları\n' +
    '9786050963533,Sapiens,Yuval Noah Harari,Mehmet Kaya,Tarih,720,2020-06-15,İnsanlığın kısa tarihi';

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-3 mb-8">
        <Link href="/admin/books" className="text-gray-500 hover:text-white transition-colors text-sm">← Kitaplar</Link>
        <span className="text-gray-700">/</span>
        <h1 className="text-2xl font-bold text-white">CSV ile Toplu İçe Aktar</h1>
      </div>

      {/* Kolon şablonu */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-6">
        <h2 className="text-sm font-semibold text-gray-300 mb-3">CSV Kolon Sırası</h2>
        <div className="flex flex-wrap gap-2 mb-4">
          {COLUMNS.map((col) => (
            <span key={col} className="px-2.5 py-1 bg-gray-800 rounded-lg text-xs text-gray-300 font-mono">
              {LABELS[col]}
            </span>
          ))}
        </div>
        <button
          onClick={() => {
            const blob = new Blob([templateCSV], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a"); a.href = url; a.download = "audiob2b-import-template.csv"; a.click();
          }}
          className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
        >
          Şablon CSV indir →
        </button>
      </div>

      {/* Yükleme alanı */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-6 space-y-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => fileRef.current?.click()}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium rounded-xl transition-colors"
          >
            CSV Dosyası Seç
          </button>
          <span className="text-gray-500 text-sm">veya aşağıya yapıştırın</span>
          <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} className="hidden" />
        </div>

        <textarea
          value={csvText}
          onChange={(e) => setCsvText(e.target.value)}
          rows={8}
          placeholder={"isbn,title,author,narrator,category,duration_minutes,publish_date,description\n9786055571344,Atomik Alışkanlıklar,James Clear,..."}
          className="w-full px-4 py-3 rounded-xl bg-gray-800 border border-gray-700 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs font-mono resize-none"
        />

        <button
          onClick={handleParse}
          disabled={!csvText.trim()}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-white text-sm font-medium rounded-xl transition-colors"
        >
          Önizle
        </button>
      </div>

      {/* Önizleme */}
      {preview.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-6">
          <h2 className="text-sm font-semibold text-gray-300 mb-3">Önizleme (ilk 5 satır)</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="pb-2 text-left text-gray-500 pr-4">Başlık</th>
                  <th className="pb-2 text-left text-gray-500 pr-4">Yazar</th>
                  <th className="pb-2 text-left text-gray-500 pr-4">Kategori</th>
                  <th className="pb-2 text-left text-gray-500 pr-4">Süre</th>
                  <th className="pb-2 text-left text-gray-500">ISBN</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {preview.map((row, i) => (
                  <tr key={i}>
                    <td className="py-2 text-white pr-4">{row.title || "—"}</td>
                    <td className="py-2 text-gray-400 pr-4">{row.author || "—"}</td>
                    <td className="py-2 text-gray-400 pr-4">{row.category || "—"}</td>
                    <td className="py-2 text-gray-400 pr-4">{row.duration_minutes ? `${row.duration_minutes} dk` : "—"}</td>
                    <td className="py-2 text-gray-500">{row.isbn || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 pt-4 border-t border-gray-800 flex items-center gap-4">
            <span className="text-sm text-gray-400">{parseCSV(csvText).length} satır bulundu</span>
            <button
              onClick={handleImport}
              disabled={loading}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors"
            >
              {loading ? "İçe aktarılıyor..." : "İçe Aktar"}
            </button>
          </div>
        </div>
      )}

      {/* Sonuç */}
      {status && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">Sonuç</h2>
          <div className="flex gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-emerald-400">{status.created}</div>
              <div className="text-xs text-gray-500 mt-1">Eklendi</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-400">{status.skipped}</div>
              <div className="text-xs text-gray-500 mt-1">Atlandı</div>
            </div>
            {status.errors.length > 0 && (
              <div className="text-center">
                <div className="text-3xl font-bold text-red-400">{status.errors.length}</div>
                <div className="text-xs text-gray-500 mt-1">Hata</div>
              </div>
            )}
          </div>
          {status.errors.length > 0 && (
            <div className="mt-4 text-xs text-red-400">
              Hata veren kitaplar: {status.errors.join(", ")}
            </div>
          )}
          <Link href="/admin/books" className="mt-4 inline-block text-emerald-400 hover:text-emerald-300 text-sm transition-colors">
            Kitap listesine dön →
          </Link>
        </div>
      )}
    </div>
  );
}
