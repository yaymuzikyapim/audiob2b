"use client";

import { useState } from "react";

interface Category { id: string; name: string }

export default function EditableCategoryField({
  bookId,
  initialCategoryId,
  initialCategoryName,
  categories,
}: {
  bookId: string;
  initialCategoryId: string | null;
  initialCategoryName: string | null;
  categories: Category[];
}) {
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState(initialCategoryId ?? "");
  const [displayName, setDisplayName] = useState(initialCategoryName ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await fetch(`/api/admin/books/${bookId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryId: selected || null }),
    });
    setSaving(false);
    setDisplayName(categories.find((c) => c.id === selected)?.name ?? "");
    setEditing(false);
  }

  function cancel() {
    setSelected(initialCategoryId ?? "");
    setEditing(false);
  }

  return (
    <div className="flex items-baseline gap-2 mt-1.5">
      <span className="text-gray-600 text-sm flex-shrink-0">Kategori:</span>

      {editing ? (
        <div className="flex items-center gap-2">
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            autoFocus
            className="px-2.5 py-1 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">— Kategori yok —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <button onClick={save} disabled={saving}
            className="text-xs px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 text-white rounded-lg transition-colors">
            {saving ? "..." : "Kaydet"}
          </button>
          <button onClick={cancel}
            className="text-xs px-2.5 py-1 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors">
            İptal
          </button>
        </div>
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="group flex items-center gap-1.5 text-left"
          title="Düzenlemek için tıklayın"
        >
          <span className={`text-sm ${displayName ? "text-gray-300" : "text-gray-600 italic"}`}>
            {displayName || "Eklemek için tıklayın..."}
          </span>
          <span className="text-gray-700 text-xs hidden group-hover:inline">✏️</span>
        </button>
      )}
    </div>
  );
}
