"use client";

import { useState } from "react";

export default function ResetPasswordButton({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw }),
      });
      const data = await res.json();
      if (res.ok) {
        setMsg({ ok: true, text: "Şifre güncellendi." });
        setPw("");
        setTimeout(() => { setOpen(false); setMsg(null); }, 1500);
      } else {
        setMsg({ ok: false, text: data.error ?? "Hata oluştu." });
      }
    } catch {
      setMsg({ ok: false, text: "Bağlantı hatası." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => { setOpen(true); setMsg(null); setPw(""); }}
        className="text-xs text-gray-500 hover:text-white transition-colors px-2 py-1 rounded-lg hover:bg-gray-800"
      >
        Şifre Değiştir
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-80 shadow-xl">
            <h3 className="text-white font-semibold mb-4">Şifre Değiştir</h3>
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <input
                type="password"
                placeholder="Yeni şifre (en az 6 karakter)"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                minLength={6}
                required
                className="px-3 py-2 rounded-xl bg-gray-800 border border-gray-700 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              {msg && (
                <p className={`text-xs ${msg.ok ? "text-emerald-400" : "text-red-400"}`}>{msg.text}</p>
              )}
              <div className="flex gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex-1 px-3 py-2 rounded-xl bg-gray-800 text-gray-400 text-sm hover:bg-gray-700 transition-colors"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {loading ? "Kaydediliyor…" : "Kaydet"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
