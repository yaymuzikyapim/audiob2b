"use client";

import { useState } from "react";

export default function ResetPasswordButton({ userId }: { userId: string }) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function handleSendLink() {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}/send-reset`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        setMsg({ ok: true, text: "Sıfırlama bağlantısı gönderildi." });
        setTimeout(() => setMsg(null), 3000);
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
    <div className="flex items-center gap-2">
      <button
        onClick={handleSendLink}
        disabled={loading}
        className="text-xs text-gray-500 hover:text-white transition-colors px-2 py-1 rounded-lg hover:bg-gray-800 disabled:opacity-50"
      >
        {loading ? "Gönderiliyor…" : "Şifre Sıfırla"}
      </button>
      {msg && (
        <span className={`text-xs ${msg.ok ? "text-emerald-400" : "text-red-400"}`}>
          {msg.text}
        </span>
      )}
    </div>
  );
}
