"use client";

import { useState, useRef } from "react";
import Link from "next/link";

// RFC 4180 CSV parser — tırnaklı alanları ve satır içi virgülleri destekler
function parseCSVRaw(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  const n = text.length;

  while (i < n) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += ch; i++; continue;
    }
    if (ch === '"') { inQuotes = true; i++; continue; }
    if (ch === ',') { row.push(field); field = ""; i++; continue; }
    if (ch === '\n' || ch === '\r') {
      row.push(field); field = "";
      if (row.some(f => f.trim())) rows.push(row);
      row = [];
      if (ch === '\r' && text[i + 1] === '\n') i++;
      i++; continue;
    }
    field += ch; i++;
  }
  if (field || row.length) { row.push(field); if (row.some(f => f.trim())) rows.push(row); }
  return rows;
}

// DD.MM.YYYY → YYYY-MM-DD
function parseDate(raw: string): string | null {
  if (!raw?.trim()) return null;
  const m = raw.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  // Zaten ISO formatındaysa doğrudan döndür
  if (/^\d{4}-\d{2}-\d{2}/.test(raw.trim())) return raw.trim().slice(0, 10);
  return null;
}

interface BookRow {
  isbn?: string;
  title: string;
  author: string;
  narrator?: string;
  category?: string;
  duration_minutes?: string;
  publish_date?: string;
  description?: string;
}

function parseSesleCSV(text: string): BookRow[] {
  const allRows = parseCSVRaw(text);

  // Başlık satırını bul: "ISBN" içeren ilk satır
  const headerIdx = allRows.findIndex(r => r.some(c => c.trim().toUpperCase() === "ISBN"));
  if (headerIdx === -1) return [];

  const headers = allRows[headerIdx].map(h => h.trim());

  const idx = {
    isbn: headers.findIndex(h => h.toUpperCase() === "ISBN"),
    title: headers.findIndex(h => h === "Title"),
    author: headers.findIndex(h => h === "Author(s)"),
    narrator: headers.findIndex(h => h === "Narrator(s)"),
    category: headers.findIndex(h => h === "Category"),
    duration: headers.findIndex(h => h === "Length (minutes)"),
    publishDate: headers.findIndex(h => h === "PUBLISH DATE"),
    description: headers.findIndex(h => h === "Turkish"),
  };

  return allRows.slice(headerIdx + 1)
    .filter(r => r.length > 1)
    .map(r => ({
      isbn: r[idx.isbn]?.trim() || undefined,
      title: r[idx.title]?.trim() || "",
      author: r[idx.author]?.trim() || "",
      narrator: r[idx.narrator]?.trim() || undefined,
      category: r[idx.category]?.trim() || undefined,
      duration_minutes: r[idx.duration]?.trim() || undefined,
      publish_date: parseDate(r[idx.publishDate]) || undefined,
      description: r[idx.description]?.trim() || undefined,
    }))
    .filter(r => r.title && r.author);
}

export default function ImportPage() {
  const [csvText, setCsvText] = useState("");
  const [preview, setPreview] = useState<BookRow[]>([]);
  const [parsedRows, setParsedRows] = useState<BookRow[]>([]);
  const [status, setStatus] = useState<{ created: number; skipped: number; errors: string[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleParse(text = csvText) {
    const rows = parseSesleCSV(text);
    setParsedRows(rows);
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
      handleParse(text);
    };
    reader.readAsText(f, "UTF-8");
  }

  async function handleImport() {
    if (parsedRows.length === 0) return;
    setLoading(true);
    setStatus(null);

    // 100'er satır halinde gönder
    const BATCH = 100;
    let created = 0, skipped = 0;
    const errors: string[] = [];

    for (let i = 0; i < parsedRows.length; i += BATCH) {
      const batch = parsedRows.slice(i, i + BATCH);
      const res = await fetch("/api/admin/books/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: batch }),
      });
      const data = await res.json();
      created += data.created ?? 0;
      skipped += data.skipped ?? 0;
      errors.push(...(data.errors ?? []));
    }

    setStatus({ created, skipped, errors });
    setLoading(false);
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-3 mb-8">
        <Link href="/admin/books" className="text-gray-500 hover:text-white transition-colors text-sm">← Kitaplar</Link>
        <span className="text-gray-700">/</span>
        <h1 className="text-2xl font-bold text-white">CSV ile Toplu İçe Aktar</h1>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-6 text-sm text-gray-400 space-y-1">
        <div className="text-white font-medium mb-2">Sesle Kitap PIM formatını destekler</div>
        <div>Google Sheets → <span className="text-gray-300">Dosya → İndir → Virgülle Ayrılmış Değerler (.csv)</span></div>
        <div>Otomatik olarak şu kolonları okur: <span className="text-gray-300">ISBN · Title · Author(s) · Narrator(s) · Category · Length (minutes) · PUBLISH DATE · Turkish (açıklama)</span></div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-6 space-y-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => fileRef.current?.click()}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            CSV Dosyası Seç
          </button>
          <span className="text-gray-500 text-sm">veya aşağıya yapıştırın</span>
          <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} className="hidden" />
        </div>

        <textarea
          value={csvText}
          onChange={(e) => setCsvText(e.target.value)}
          rows={6}
          placeholder="CSV içeriğini buraya yapıştırın..."
          className="w-full px-4 py-3 rounded-xl bg-gray-800 border border-gray-700 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs font-mono resize-none"
        />

        <button
          onClick={() => handleParse()}
          disabled={!csvText.trim()}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-white text-sm font-medium rounded-xl transition-colors"
        >
          Önizle
        </button>
      </div>

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
                    <td className="py-2 text-white pr-4 max-w-[200px] truncate">{row.title || "—"}</td>
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
            <span className="text-sm text-gray-400">{parsedRows.length} kitap bulundu</span>
            <button
              onClick={handleImport}
              disabled={loading}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors"
            >
              {loading ? "İçe aktarılıyor..." : `${parsedRows.length} Kitabı İçe Aktar`}
            </button>
          </div>
        </div>
      )}

      {status && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">Sonuç</h2>
          <div className="flex gap-8">
            <div className="text-center">
              <div className="text-3xl font-bold text-emerald-400">{status.created}</div>
              <div className="text-xs text-gray-500 mt-1">Eklendi</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-400">{status.skipped}</div>
              <div className="text-xs text-gray-500 mt-1">Atlandı (mükerrer)</div>
            </div>
            {status.errors.length > 0 && (
              <div className="text-center">
                <div className="text-3xl font-bold text-red-400">{status.errors.length}</div>
                <div className="text-xs text-gray-500 mt-1">Hata</div>
              </div>
            )}
          </div>
          {status.errors.length > 0 && (
            <div className="mt-4 text-xs text-red-400">Hata veren: {status.errors.slice(0, 10).join(", ")}</div>
          )}
          <Link href="/admin/books" className="mt-4 inline-block text-emerald-400 hover:text-emerald-300 text-sm transition-colors">
            Kitap listesine dön →
          </Link>
        </div>
      )}
    </div>
  );
}
