"use client";

import { useState, useRef, useEffect } from "react";

export default function EditableField({
  bookId,
  field,
  label,
  initial,
  placeholder,
}: {
  bookId: string;
  field: string;
  label: string;
  initial: string | null;
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initial ?? "");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  async function save() {
    setSaving(true);
    await fetch(`/api/admin/books/${bookId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value || null }),
    });
    setSaving(false);
    setEditing(false);
  }

  function cancel() {
    setValue(initial ?? "");
    setEditing(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") save();
    if (e.key === "Escape") cancel();
  }

  return (
    <div className="flex items-baseline gap-2 mt-1.5">
      <span className="text-gray-600 text-sm flex-shrink-0">{label}</span>

      {editing ? (
        <div className="flex items-center gap-2 flex-1">
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            className="flex-1 px-2.5 py-1 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <button onClick={save} disabled={saving}
            className="text-xs px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 text-white rounded-lg transition-colors flex-shrink-0">
            {saving ? "..." : "Kaydet"}
          </button>
          <button onClick={cancel}
            className="text-xs px-2.5 py-1 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors flex-shrink-0">
            İptal
          </button>
        </div>
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="group flex items-center gap-1.5 text-left"
          title="Düzenlemek için tıklayın"
        >
          <span className={`text-sm ${value ? "text-gray-300" : "text-gray-600 italic"}`}>
            {value || (placeholder ?? "Eklemek için tıklayın...")}
          </span>
          <span className="text-gray-700 text-xs hidden group-hover:inline">✏️</span>
        </button>
      )}
    </div>
  );
}
