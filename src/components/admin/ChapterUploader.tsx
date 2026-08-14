"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

interface Chapter {
  id: string;
  title: string;
  order: number;
  duration: number;
  s3Key: string;
}

interface QueueItem {
  id: string;
  file: File;
  title: string;
  order: number | null;
  duration: number;
  durationReady: boolean;
  valid: boolean;       // 3 haneli sayıyla bitiyor mu?
  status: "waiting" | "uploading" | "done" | "error";
  progress: number;
  errorMsg: string;
}

function formatDuration(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function parseOrder(filename: string): number | null {
  const base = filename.replace(/\.[^.]+$/, "");
  const m = base.match(/(\d{3})$/);
  return m ? parseInt(m[1], 10) : null;
}

function isValidName(filename: string) {
  const base = filename.replace(/\.[^.]+$/, "");
  return /\d{3}$/.test(base);
}

let uid = 0;
function nextId() { return String(++uid); }

export default function ChapterUploader({ bookId, chapters }: { bookId: string; chapters: Chapter[] }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const queueRef = useRef<QueueItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

  // queueRef her render'da güncel state'i tutar
  queueRef.current = queue;

  function updateItem(id: string, patch: Partial<QueueItem>) {
    setQueue((q) => q.map((item) => item.id === id ? { ...item, ...patch } : item));
  }

  function readDuration(item: QueueItem) {
    const audio = new Audio();
    const url = URL.createObjectURL(item.file);
    audio.src = url;
    audio.onloadedmetadata = () => {
      updateItem(item.id, { duration: Math.round(audio.duration), durationReady: true });
      URL.revokeObjectURL(url);
    };
    audio.onerror = () => { updateItem(item.id, { durationReady: true }); URL.revokeObjectURL(url); };
  }

  function addFiles(files: File[]) {
    const audioFiles = files.filter((f) => /\.(mp3|m4a|wav|ogg|aac)$/i.test(f.name));
    if (!audioFiles.length) return;

    // Zaten kuyrukta var mı kontrol et
    setQueue((prev) => {
      const existingNames = new Set(prev.map((i) => i.file.name));
      const newItems: QueueItem[] = audioFiles
        .filter((f) => !existingNames.has(f.name))
        .map((f) => ({
          id: nextId(),
          file: f,
          title: f.name.replace(/\.[^.]+$/, ""),
          order: parseOrder(f.name),
          duration: 0,
          durationReady: false,
          valid: isValidName(f.name),
          status: "waiting",
          progress: 0,
          errorMsg: "",
        }));
      newItems.forEach(readDuration);
      return [...prev, ...newItems].sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999));
    });
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    addFiles(files);
  }, []);

  function onFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) addFiles(Array.from(e.target.files));
    e.target.value = "";
  }

  function removeItem(id: string) {
    setQueue((q) => q.filter((item) => item.id !== id));
  }

  async function uploadItem(item: QueueItem): Promise<boolean> {
    updateItem(item.id, { status: "uploading", progress: 0, errorMsg: "" });

    const ext = item.file.name.split(".").pop()?.toLowerCase() || "mp3";

    const res = await fetch(`/api/admin/books/${bookId}/chapters`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: item.title,
        order: item.order ?? 0,
        duration: item.duration,
        ext,
      }),
    });

    if (!res.ok) {
      const d = await res.json();
      updateItem(item.id, { status: "error", errorMsg: d.error || "API hatası" });
      return false;
    }

    const { uploadUrl } = await res.json();
    const contentType = ext === "m4a" || ext === "aac" ? "audio/mp4" : "audio/mpeg";

    const ok = await new Promise<boolean>((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) updateItem(item.id, { progress: Math.round((e.loaded / e.total) * 100) });
      };
      xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300);
      xhr.onerror = () => resolve(false);
      xhr.open("PUT", uploadUrl);
      xhr.setRequestHeader("Content-Type", contentType);
      xhr.send(item.file);
    });

    if (ok) {
      updateItem(item.id, { status: "done", progress: 100 });
    } else {
      updateItem(item.id, { status: "error", errorMsg: "S3 yükleme başarısız" });
    }
    return ok;
  }

  async function uploadAll() {
    const snapshot = queueRef.current;
    const pending = snapshot.filter((i) => i.valid && i.status === "waiting");
    if (!pending.length) return;
    setUploading(true);
    // Metadata henüz yüklenmemişse max 2s bekle
    if (pending.some((i) => !i.durationReady)) {
      await new Promise<void>((r) => setTimeout(r, 2000));
    }
    // Beklemenin ardından güncel snapshot'ı al
    const toUpload = queueRef.current.filter((i) => i.valid && i.status === "waiting");
    for (const item of toUpload) {
      await uploadItem(item);
    }
    setUploading(false);
    router.refresh();
  }

  async function handleDelete(chapterId: string, title: string) {
    if (!confirm(`"${title}" bölümünü silmek istediğinize emin misiniz?`)) return;
    await fetch(`/api/admin/books/${bookId}/chapters`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chapterId }),
    });
    router.refresh();
  }

  const waitingValid = queue.filter((i) => i.valid && i.status === "waiting").length;
  const invalidCount = queue.filter((i) => !i.valid).length;
  const doneCount = queue.filter((i) => i.status === "done").length;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl">
      <div className="px-6 py-4 border-b border-gray-800">
        <h2 className="text-white font-semibold">Bölümler ({chapters.length})</h2>
      </div>

      {/* Drag & Drop Zone */}
      <div className="p-6 border-b border-gray-800">
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
          className={`w-full border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-colors ${
            dragging
              ? "border-emerald-500 bg-emerald-500/5"
              : "border-gray-700 hover:border-gray-600 hover:bg-gray-800/30"
          }`}
        >
          <div className="text-3xl mb-3">🎵</div>
          <p className="text-gray-300 text-sm font-medium">
            Ses dosyalarını buraya sürükleyin veya tıklayın
          </p>
          <p className="text-gray-600 text-xs mt-1">
            MP3, M4A · Çoklu seçim desteklenir · Dosya adı <span className="text-gray-400 font-mono">KitapAdi_001.mp3</span> formatında olmalı
          </p>
          <input
            ref={fileRef}
            type="file"
            accept="audio/mpeg,audio/mp4,audio/m4a,.mp3,.m4a,.wav,.aac"
            multiple
            onChange={onFileInput}
            className="hidden"
          />
        </div>

        {/* Format uyarı kutusu */}
        {invalidCount > 0 && (
          <div className="mt-4 bg-orange-500/10 border border-orange-500/30 rounded-xl px-4 py-3 flex items-start gap-3">
            <span className="text-orange-400 text-lg flex-shrink-0">⚠️</span>
            <div>
              <div className="text-orange-400 text-sm font-semibold">
                {invalidCount} dosya isimlendirme kuralına uymuyor
              </div>
              <div className="text-orange-300/80 text-xs mt-0.5">
                Dosya adı üç haneli ve ardışık bir rakamla bitmelidir.
                Örnek: <span className="font-mono">Kitap_Part001.mp3</span>, <span className="font-mono">Kitap_Part002.mp3</span>
              </div>
            </div>
          </div>
        )}

        {/* Kuyruk */}
        {queue.length > 0 && (
          <div className="mt-4 space-y-2">
            {queue.map((item) => (
              <div
                key={item.id}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${
                  !item.valid
                    ? "border-orange-500/30 bg-orange-500/5"
                    : item.status === "error"
                    ? "border-red-500/30 bg-red-500/5"
                    : item.status === "done"
                    ? "border-emerald-500/20 bg-emerald-500/5"
                    : "border-gray-700 bg-gray-800/50"
                }`}
              >
                {/* Sıra no */}
                <div className="w-8 text-center flex-shrink-0">
                  {item.order !== null ? (
                    <span className="text-white text-sm font-mono font-bold">{item.order}</span>
                  ) : (
                    <span className="text-orange-400 text-sm">?</span>
                  )}
                </div>

                {/* Dosya adı + durum */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-white text-sm truncate font-medium">{item.file.name}</span>
                    {!item.valid && (
                      <span className="flex-shrink-0 text-xs bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full">
                        Format hatalı
                      </span>
                    )}
                    {item.status === "done" && (
                      <span className="flex-shrink-0 text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">
                        ✓ Yüklendi
                      </span>
                    )}
                    {item.status === "error" && (
                      <span className="flex-shrink-0 text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">
                        Hata
                      </span>
                    )}
                  </div>
                  {item.status === "uploading" && (
                    <div className="mt-1.5 w-full bg-gray-700 rounded-full h-1">
                      <div className="bg-emerald-500 h-1 rounded-full transition-all" style={{ width: `${item.progress}%` }} />
                    </div>
                  )}
                  {item.status === "error" && item.errorMsg && (
                    <div className="text-red-400 text-xs mt-0.5">{item.errorMsg}</div>
                  )}
                </div>

                {/* Süre */}
                <div className="flex-shrink-0 text-gray-500 text-xs w-14 text-right">
                  {item.durationReady
                    ? item.duration > 0 ? formatDuration(item.duration) : "—"
                    : <span className="animate-pulse">…</span>}
                </div>

                {/* Boyut */}
                <div className="flex-shrink-0 text-gray-600 text-xs w-14 text-right">
                  {(item.file.size / 1024 / 1024).toFixed(1)} MB
                </div>

                {/* Kaldır */}
                {item.status !== "uploading" && (
                  <button
                    onClick={() => removeItem(item.id)}
                    className="flex-shrink-0 text-gray-600 hover:text-red-400 transition-colors p-1"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                    </svg>
                  </button>
                )}
              </div>
            ))}

            {/* Eylem barı */}
            <div className="flex items-center justify-between pt-2">
              <div className="text-gray-500 text-xs">
                {doneCount > 0 && <span className="text-emerald-400">{doneCount} yüklendi · </span>}
                {waitingValid} dosya yüklenmeye hazır
                {invalidCount > 0 && <span className="text-orange-400"> · {invalidCount} geçersiz (atlanır)</span>}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setQueue([])}
                  disabled={uploading}
                  className="text-xs px-3 py-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-40"
                >
                  Listeyi Temizle
                </button>
                <button
                  onClick={uploadAll}
                  disabled={uploading || waitingValid === 0}
                  className="text-sm px-5 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors"
                >
                  {uploading ? "Yükleniyor..." : `${waitingValid} Bölümü Yükle`}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Mevcut bölüm listesi */}
      <div className="divide-y divide-gray-800">
        {chapters.length === 0 && (
          <div className="px-6 py-8 text-center text-gray-500 text-sm">
            Henüz bölüm yüklenmemiş.
          </div>
        )}
        {chapters.map((ch) => (
          <div key={ch.id} className="flex items-center justify-between px-6 py-3">
            <div className="flex items-center gap-4">
              <span className="text-gray-600 text-sm w-6 font-mono">{ch.order}</span>
              <div>
                <div className="text-white text-sm font-medium">{ch.title}</div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-400/10 text-emerald-400">Yüklendi</span>
              <span className="text-gray-500 text-xs font-mono">{formatDuration(ch.duration)}</span>
              <button
                onClick={() => handleDelete(ch.id, ch.title)}
                className="text-gray-600 hover:text-red-400 text-xs transition-colors"
              >
                Sil
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
