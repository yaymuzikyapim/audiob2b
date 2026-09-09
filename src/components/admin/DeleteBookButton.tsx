"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function DeleteBookButton({ bookId }: { bookId: string }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    setLoading(true);
    await fetch(`/api/admin/books/${bookId}`, { method: "DELETE" });
    router.push("/admin/books");
    router.refresh();
  }

  if (!confirm) {
    return (
      <button
        onClick={() => setConfirm(true)}
        className="text-xs px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
      >
        Kitabı Sil
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-red-400">Emin misiniz?</span>
      <button
        onClick={handleDelete}
        disabled={loading}
        className="text-xs px-3 py-1.5 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50"
      >
        {loading ? "Siliniyor..." : "Evet, Sil"}
      </button>
      <button
        onClick={() => setConfirm(false)}
        className="text-xs px-3 py-1.5 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
      >
        İptal
      </button>
    </div>
  );
}
