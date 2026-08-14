"use client";

import { useState, useRef } from "react";

type InviteRow = { email: string; role: string };
type ResultRow = { email: string; status: "ok" | "skipped" | "error"; reason?: string };

function parseCSV(text: string): InviteRow[] {
  const rows: InviteRow[] = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.toLowerCase().startsWith("email")) continue;
    const [email, role] = trimmed.split(/[,;\t]/);
    if (email?.includes("@")) {
      rows.push({ email: email.trim(), role: (role?.trim().toUpperCase() === "COMPANY_ADMIN" ? "COMPANY_ADMIN" : "EMPLOYEE") });
    }
  }
  return rows;
}

export default function InviteButton({ companyId, remaining }: { companyId: string; remaining: number }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"single" | "bulk">("single");

  // Tekli davet
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("EMPLOYEE");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Toplu davet
  const [bulkRows, setBulkRows] = useState<InviteRow[]>([]);
  const [bulkText, setBulkText] = useState("");
  const [bulkResults, setBulkResults] = useState<ResultRow[] | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function close() {
    setOpen(false);
    setMessage(null);
    setBulkRows([]);
    setBulkText("");
    setBulkResults(null);
    setEmail("");
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    const res = await fetch("/api/dashboard/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setMessage({ type: "error", text: data.error || "Hata oluştu." });
    } else {
      setMessage({ type: "success", text: `${email} adresine davet gönderildi.` });
      setEmail("");
      setTimeout(() => close(), 2000);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const rows = parseCSV(text);
      setBulkRows(rows);
      setBulkText("");
      setBulkResults(null);
    };
    reader.readAsText(file);
  }

  function handleBulkTextChange(text: string) {
    setBulkText(text);
    setBulkRows(parseCSV(text));
    setBulkResults(null);
  }

  async function handleBulkSend() {
    if (bulkRows.length === 0) return;
    setBulkLoading(true);
    setBulkResults(null);
    const res = await fetch("/api/dashboard/invite/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invites: bulkRows }),
    });
    const data = await res.json();
    setBulkLoading(false);
    if (!res.ok) {
      setBulkResults([{ email: "—", status: "error", reason: data.error }]);
    } else {
      setBulkResults(data.results);
    }
  }

  const okCount = bulkResults?.filter((r) => r.status === "ok").length ?? 0;

  return (
    <>
      <button
        onClick={() => { setOpen(true); setMessage(null); }}
        disabled={remaining === 0}
        className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors"
        title={remaining === 0 ? "Tüm koltuklar dolu" : ""}
      >
        + Davet Gönder
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg">
            {/* Sekme başlıkları */}
            <div className="flex border-b border-gray-800">
              {(["single", "bulk"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => { setTab(t); setMessage(null); setBulkResults(null); }}
                  className={`flex-1 py-3.5 text-sm font-semibold transition-colors ${
                    tab === t ? "text-white border-b-2 border-blue-500" : "text-gray-500 hover:text-gray-300"
                  }`}
                >
                  {t === "single" ? "Tekli Davet" : "Toplu Davet"}
                </button>
              ))}
            </div>

            <div className="p-6">
              {/* Tekli Davet */}
              {tab === "single" && (
                <>
                  <p className="text-gray-400 text-sm mb-5">{remaining} koltuk boş · Davet e-posta ile gönderilecek.</p>
                  <form onSubmit={handleInvite} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1.5">E-posta *</label>
                      <input
                        type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                        className="w-full px-4 py-2.5 rounded-xl bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        placeholder="calisan@sirket.com"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1.5">Rol</label>
                      <select value={role} onChange={(e) => setRole(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl bg-gray-800 border border-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
                        <option value="EMPLOYEE">Çalışan</option>
                        <option value="COMPANY_ADMIN">Şirket Yöneticisi</option>
                      </select>
                    </div>
                    {message && (
                      <div className={`rounded-xl px-4 py-3 text-sm ${
                        message.type === "success" ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400" : "bg-red-500/10 border border-red-500/20 text-red-400"
                      }`}>{message.text}</div>
                    )}
                    <div className="flex gap-3 pt-2">
                      <button type="submit" disabled={loading}
                        className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white text-sm font-semibold rounded-xl transition-colors">
                        {loading ? "Gönderiliyor..." : "Davet Gönder"}
                      </button>
                      <button type="button" onClick={close}
                        className="px-5 py-2.5 text-gray-400 hover:text-white text-sm rounded-xl hover:bg-gray-800 transition-colors">
                        İptal
                      </button>
                    </div>
                  </form>
                </>
              )}

              {/* Toplu Davet */}
              {tab === "bulk" && !bulkResults && (
                <>
                  <p className="text-gray-400 text-sm mb-4">{remaining} koltuk boş · CSV/Excel dosyası yükle veya e-postaları yapıştır.</p>

                  {/* Dosya yükleme */}
                  <div
                    onClick={() => fileRef.current?.click()}
                    className="border-2 border-dashed border-gray-700 hover:border-blue-500 rounded-xl p-6 text-center cursor-pointer transition-colors mb-4"
                  >
                    <div className="text-2xl mb-2">📂</div>
                    <p className="text-white text-sm font-medium">CSV veya Excel dosyası seç</p>
                    <p className="text-gray-500 text-xs mt-1">İlk sütun: e-posta · İkinci sütun (opsiyonel): EMPLOYEE veya COMPANY_ADMIN</p>
                    <input ref={fileRef} type="file" accept=".csv,.txt,.xlsx,.xls" onChange={handleFileChange} className="hidden" />
                  </div>

                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex-1 h-px bg-gray-800" />
                    <span className="text-gray-500 text-xs">veya</span>
                    <div className="flex-1 h-px bg-gray-800" />
                  </div>

                  {/* Metin yapıştırma */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">E-postaları yapıştır</label>
                    <textarea
                      value={bulkText}
                      onChange={(e) => handleBulkTextChange(e.target.value)}
                      rows={5}
                      placeholder={"ali@sirket.com\nveli@sirket.com, COMPANY_ADMIN\nayse@sirket.com"}
                      className="w-full px-4 py-3 rounded-xl bg-gray-800 border border-gray-700 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-mono resize-none"
                    />
                    <p className="text-gray-600 text-xs mt-1">Her satıra bir e-posta. İkinci sütun rol (opsiyonel).</p>
                  </div>

                  {/* Önizleme */}
                  {bulkRows.length > 0 && (
                    <div className="bg-gray-800/50 rounded-xl p-3 mb-4 max-h-36 overflow-y-auto">
                      <p className="text-gray-400 text-xs mb-2">{bulkRows.length} kişi algılandı</p>
                      {bulkRows.slice(0, 8).map((r, i) => (
                        <div key={i} className="flex justify-between text-xs py-0.5">
                          <span className="text-white">{r.email}</span>
                          <span className="text-gray-500">{r.role === "COMPANY_ADMIN" ? "Yönetici" : "Çalışan"}</span>
                        </div>
                      ))}
                      {bulkRows.length > 8 && <p className="text-gray-600 text-xs mt-1">+{bulkRows.length - 8} kişi daha</p>}
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      onClick={handleBulkSend}
                      disabled={bulkRows.length === 0 || bulkLoading}
                      className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors"
                    >
                      {bulkLoading ? "Gönderiliyor..." : `${bulkRows.length} Davet Gönder`}
                    </button>
                    <button onClick={close} className="px-5 py-2.5 text-gray-400 hover:text-white text-sm rounded-xl hover:bg-gray-800 transition-colors">
                      İptal
                    </button>
                  </div>
                </>
              )}

              {/* Sonuçlar */}
              {tab === "bulk" && bulkResults && (
                <>
                  <div className={`rounded-xl px-4 py-3 text-sm mb-4 ${okCount > 0 ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400" : "bg-gray-800 text-gray-400"}`}>
                    {okCount} davet başarıyla gönderildi.
                    {bulkResults.filter(r => r.status !== "ok").length > 0 && ` · ${bulkResults.filter(r => r.status !== "ok").length} atlandı/hata.`}
                  </div>
                  <div className="max-h-52 overflow-y-auto space-y-1 mb-4">
                    {bulkResults.map((r, i) => (
                      <div key={i} className="flex justify-between text-xs py-1 border-b border-gray-800/50">
                        <span className="text-white">{r.email}</span>
                        <span className={r.status === "ok" ? "text-emerald-400" : r.status === "skipped" ? "text-yellow-400" : "text-red-400"}>
                          {r.status === "ok" ? "✓ Gönderildi" : r.reason ?? r.status}
                        </span>
                      </div>
                    ))}
                  </div>
                  <button onClick={close} className="w-full py-2.5 bg-gray-800 hover:bg-gray-700 text-white text-sm font-semibold rounded-xl transition-colors">
                    Kapat
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
