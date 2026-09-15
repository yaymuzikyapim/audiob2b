"use client";

import { useState } from "react";

interface Series { id: string; name: string }

export default function EditableSeriesField({
  bookId,
  initialSeriesId,
  initialSeriesName,
  initialSeriesOrder,
  seriesList,
}: {
  bookId: string;
  initialSeriesId: string | null;
  initialSeriesName: string | null;
  initialSeriesOrder: number | null;
  seriesList: Series[];
}) {
  const [editing, setEditing] = useState(false);
  const [selectedId, setSelectedId] = useState(initialSeriesId ?? "");
  const [order, setOrder] = useState(String(initialSeriesOrder ?? ""));
  const [displayName, setDisplayName] = useState(initialSeriesName ?? "");
  const [displayOrder, setDisplayOrder] = useState(initialSeriesOrder);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await fetch(`/api/admin/books/${bookId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seriesId: selectedId || null, seriesOrder: selectedId ? order : null }),
    });
    setSaving(false);
    setDisplayName(seriesList.find((s) => s.id === selectedId)?.name ?? "");
    setDisplayOrder(order ? parseInt(order) : null);
    setEditing(false);
  }

  function cancel() {
    setSelectedId(initialSeriesId ?? "");
    setOrder(String(initialSeriesOrder ?? ""));
    setEditing(false);
  }

  return (
    <div className="flex items-baseline gap-2 mt-1.5">
      <span className="text-gray-600 text-sm flex-shrink-0">Seri:</span>

      {editing ? (
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            autoFocus
            className="px-2.5 py-1 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">— Seri yok —</option>
            {seriesList.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          {selectedId && (
            <input
              type="number"
              value={order}
              onChange={(e) => setOrder(e.target.value)}
              placeholder="Sıra"
              className="w-16 px-2.5 py-1 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          )}
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
            {displayName ? `${displayName}${displayOrder != null ? ` #${displayOrder}` : ""}` : "Eklemek için tıklayın..."}
          </span>
          <span className="text-gray-700 text-xs hidden group-hover:inline">✏️</span>
        </button>
      )}
    </div>
  );
}
