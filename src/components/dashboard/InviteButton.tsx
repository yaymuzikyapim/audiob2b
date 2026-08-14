"use client";

import { useState } from "react";

export default function InviteButton({ companyId, remaining }: { companyId: string; remaining: number }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("EMPLOYEE");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

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
      setTimeout(() => { setOpen(false); setMessage(null); }, 2000);
    }
  }

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
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-white font-semibold mb-1">Çalışan Davet Et</h3>
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
                  message.type === "success"
                    ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                    : "bg-red-500/10 border border-red-500/20 text-red-400"
                }`}>
                  {message.text}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={loading}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white text-sm font-semibold rounded-xl transition-colors">
                  {loading ? "Gönderiliyor..." : "Davet Gönder"}
                </button>
                <button type="button" onClick={() => setOpen(false)}
                  className="px-5 py-2.5 text-gray-400 hover:text-white text-sm rounded-xl hover:bg-gray-800 transition-colors">
                  İptal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
