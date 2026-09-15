"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ToggleActiveButton({
  bookId,
  isActive,
}: {
  bookId: string;
  isActive: boolean;
}) {
  const [active, setActive] = useState(isActive);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function toggle() {
    setLoading(true);
    const next = !active;
    setActive(next);
    await fetch(`/api/admin/books/${bookId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: next }),
    });
    setLoading(false);
    router.refresh();
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      title={active ? "Pasife al" : "Aktife al"}
      className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors cursor-pointer
        ${active
          ? "bg-emerald-400/10 text-emerald-400 hover:bg-emerald-400/20"
          : "bg-red-400/10 text-red-400 hover:bg-red-400/20"
        } ${loading ? "opacity-50" : ""}`}
    >
      {active ? "Aktif" : "Pasif"}
    </button>
  );
}
