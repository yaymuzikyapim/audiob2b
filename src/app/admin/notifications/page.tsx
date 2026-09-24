"use client";

import { useState, useEffect } from "react";

interface Company {
  id: string;
  name: string;
}

export default function NotificationsPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [target, setTarget] = useState<"all" | "company">("all");
  const [companyId, setCompanyId] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [bookId, setBookId] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ sent: number; failed: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/companies")
      .then((r) => r.json())
      .then((d) => setCompanies(d ?? []))
      .catch(() => {});
  }, []);

  async function handleSend() {
    if (!title.trim() || !body.trim()) {
      setError("Başlık ve mesaj zorunlu.");
      return;
    }
    setSending(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          data: bookId.trim() ? { bookId: bookId.trim() } : {},
          target,
          ...(target === "company" ? { companyId } : {}),
        }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Bir hata oluştu."); return; }
      setResult({ sent: json.sent, failed: json.failed });
      setTitle("");
      setBody("");
      setBookId("");
    } catch {
      setError("Ağ hatası.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold text-white mb-6">Bildirim Gönder</h1>

      {/* Hedef */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-400 mb-2">Hedef</label>
        <div className="flex gap-3">
          {(["all", "company"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTarget(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                target === t
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                  : "bg-gray-800 text-gray-400 border border-gray-700 hover:text-white"
              }`}
            >
              {t === "all" ? "Tüm kullanıcılar" : "Şirkete göre"}
            </button>
          ))}
        </div>
      </div>

      {target === "company" && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-400 mb-2">Şirket</label>
          <select
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
          >
            <option value="">— Seçin —</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Başlık */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-400 mb-2">Başlık</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Bildirim başlığı"
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500"
        />
      </div>

      {/* Mesaj */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-400 mb-2">Mesaj</label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Bildirim metni"
          rows={3}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 resize-none"
        />
      </div>

      {/* Kitap ID (opsiyonel) */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-400 mb-2">
          Kitap ID <span className="text-gray-600">(opsiyonel — tıklayınca kitabı açar)</span>
        </label>
        <input
          type="text"
          value={bookId}
          onChange={(e) => setBookId(e.target.value)}
          placeholder="book_xxxx"
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500"
        />
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {result && (
        <div className="mb-4 px-4 py-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400 text-sm">
          Gönderildi: <strong>{result.sent}</strong> &nbsp;|&nbsp; Başarısız: <strong>{result.failed}</strong>
        </div>
      )}

      <button
        onClick={handleSend}
        disabled={sending || (target === "company" && !companyId)}
        className="w-full py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors"
      >
        {sending ? "Gönderiliyor…" : "Bildirim Gönder"}
      </button>
    </div>
  );
}
