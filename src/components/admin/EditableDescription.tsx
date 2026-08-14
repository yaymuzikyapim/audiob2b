"use client";

import { useState, useRef, useEffect } from "react";

export default function EditableDescription({ bookId, initial }: { bookId: string; initial: string | null }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initial ?? "");
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) ref.current?.focus();
  }, [editing]);

  async function save() {
    setSaving(true);
    await fetch(`/api/admin/books/${bookId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: value }),
    });
    setSaving(false);
    setEditing(false);
  }

  function cancel() {
    setValue(initial ?? "");
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="mt-3">
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={4}
          className="w-full px-3 py-2.5 rounded-xl bg-gray-800 border border-gray-700 text-gray-300 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
        />
        <div className="flex gap-2 mt-2">
          <button onClick={save} disabled={saving}
            className="text-xs px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 text-white rounded-lg transition-colors">
            {saving ? "Kaydediliyor..." : "Kaydet"}
          </button>
          <button onClick={cancel}
            className="text-xs px-3 py-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors">
            İptal
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={() => setEditing(true)}
      className="group mt-3 cursor-pointer rounded-xl px-3 py-2 -mx-3 hover:bg-gray-800/50 transition-colors"
      title="Düzenlemek için tıklayın"
    >
      {value ? (
        <p className="text-gray-400 text-sm leading-relaxed">{value}</p>
      ) : (
        <p className="text-gray-600 text-sm italic">Açıklama eklemek için tıklayın...</p>
      )}
      <span className="text-gray-600 text-xs mt-1 hidden group-hover:inline">✏️ Düzenle</span>
    </div>
  );
}
