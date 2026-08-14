"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function MemberActions({
  userId,
  isActive,
  isSelf,
}: {
  userId: string;
  isActive: boolean;
  isSelf: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [confirm, setConfirm] = useState(false);

  if (isSelf) return null;

  async function handleAction(action: "toggle_active" | "remove") {
    setLoading(true);
    await fetch("/api/dashboard/member", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, action }),
    });
    setLoading(false);
    setConfirm(false);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => handleAction("toggle_active")}
        disabled={loading}
        className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50 ${
          isActive
            ? "bg-orange-400/10 text-orange-400 hover:bg-orange-400/20"
            : "bg-emerald-400/10 text-emerald-400 hover:bg-emerald-400/20"
        }`}
      >
        {isActive ? "Pasife Al" : "Aktive Et"}
      </button>

      {!confirm ? (
        <button
          onClick={() => setConfirm(true)}
          className="text-xs px-3 py-1.5 rounded-lg font-medium bg-red-400/10 text-red-400 hover:bg-red-400/20 transition-colors"
        >
          Çıkar
        </button>
      ) : (
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-400">Emin misin?</span>
          <button
            onClick={() => handleAction("remove")}
            disabled={loading}
            className="text-xs px-2.5 py-1 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50"
          >
            Evet
          </button>
          <button
            onClick={() => setConfirm(false)}
            className="text-xs px-2.5 py-1 rounded-lg text-gray-400 hover:text-white transition-colors"
          >
            İptal
          </button>
        </div>
      )}
    </div>
  );
}
