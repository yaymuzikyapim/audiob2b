"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminInviteButton({ companyId }: { companyId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("EMPLOYEE");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    const res = await fetch(`/api/admin/companies/${companyId}/invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || "Hata oluştu.");
    } else {
      setSuccess(data.warning ? `Davet oluşturuldu (e-posta gönderilemedi). Link: ${data.inviteUrl}` : "Davet e-postası gönderildi!");
      setEmail("");
      router.refresh();
    }
  }

  return (
    <>
      <button onClick={() => { setOpen(true); setError(""); setSuccess(""); }}
        className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors">
        + Davet Gönder
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setOpen(false)}>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-white font-semibold mb-5">Kullanıcı Davet Et</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">E-posta *</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                  className="w-full px-4 py-2.5 rounded-xl bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                  placeholder="kullanici@sirket.com" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Rol</label>
                <select value={role} onChange={(e) => setRole(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-gray-800 border border-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm">
                  <option value="EMPLOYEE">Çalışan</option>
                  <option value="COMPANY_ADMIN">Şirket Yöneticisi</option>
                </select>
              </div>
              {error && <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm">{error}</div>}
              {success && <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3 text-emerald-400 text-sm">{success}</div>}
              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={loading}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 text-white text-sm font-semibold rounded-xl transition-colors">
                  {loading ? "Gönderiliyor..." : "Davet Gönder"}
                </button>
                <button type="button" onClick={() => setOpen(false)}
                  className="px-5 py-2.5 text-gray-400 hover:text-white hover:bg-gray-800 text-sm rounded-xl transition-colors">
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
