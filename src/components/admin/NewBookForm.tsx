"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

function cropToSquare(file: File, size = 600): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const min = Math.min(img.width, img.height);
      const sx = (img.width - min) / 2;
      const sy = (img.height - min) / 2;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      canvas.getContext("2d")!.drawImage(img, sx, sy, min, min, 0, 0, size, size);
      canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.92);
    };
    img.src = URL.createObjectURL(file);
  });
}

interface Category { id: string; name: string }

export default function NewBookForm({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const coverRef = useRef<HTMLInputElement>(null);
  const submittingRef = useRef(false);

  const [form, setForm] = useState({
    title: "",
    author: "",
    narrator: "",
    duration: "",
    description: "",
    isbn: "",
    categoryId: "",
    publishedAt: "",
  });

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function parseDuration(raw: string): number {
    // "3:45:00" veya "225" (dakika) ya da "13500" (saniye) formatlarını destekle
    if (raw.includes(":")) {
      const parts = raw.split(":").map(Number);
      if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
      if (parts.length === 2) return parts[0] * 60 + parts[1];
    }
    const n = parseInt(raw);
    // 1000'den küçükse dakika olarak yorumla
    return n < 1000 ? n * 60 : n;
  }

  async function onCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setCoverFile(f);
    const square = await cropToSquare(f);
    setCoverPreview(URL.createObjectURL(square));
    // Kırpılmış blob'u file yerine kullan
    const squareFile = new File([square], f.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" });
    setCoverFile(squareFile);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;
    setLoading(true);
    setError("");

    let coverUrl = "";

    // Kapak görseli seçildiyse önce S3'e yükle
    if (coverFile) {
      const urlRes = await fetch(`/api/admin/cover-upload-url?ext=jpg`);
      const { uploadUrl, key } = await urlRes.json();

      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": "image/jpeg" },
        body: coverFile,
      });

      if (!uploadRes.ok) {
        setError("Kapak görseli yüklenemedi.");
        setLoading(false);
        submittingRef.current = false;
        return;
      }

      coverUrl = `/api/covers/${key.replace("covers/", "")}`;
    }

    const res = await fetch("/api/admin/books", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        duration: parseDuration(form.duration),
        categoryId: form.categoryId || null,
        coverUrl: coverUrl || null,
      }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || "Hata oluştu.");
      setLoading(false);
      submittingRef.current = false;
    } else {
      router.push(`/admin/books/${data.id}`);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-5">
      <div className="grid grid-cols-2 gap-5">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">Kitap Adı *</label>
          <input value={form.title} onChange={(e) => set("title", e.target.value)} required
            className="w-full px-4 py-2.5 rounded-xl bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
            placeholder="Atomik Alışkanlıklar" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">Yazar *</label>
          <input value={form.author} onChange={(e) => set("author", e.target.value)} required
            className="w-full px-4 py-2.5 rounded-xl bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
            placeholder="James Clear" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-5">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">Seslendiren</label>
          <input value={form.narrator} onChange={(e) => set("narrator", e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
            placeholder="Ahmet Yılmaz" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">
            Toplam Süre * <span className="text-gray-500 font-normal">(örn: 5:30:00 veya 330 dk)</span>
          </label>
          <input value={form.duration} onChange={(e) => set("duration", e.target.value)} required
            className="w-full px-4 py-2.5 rounded-xl bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
            placeholder="5:30:00" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-5">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">Kategori</label>
          <select value={form.categoryId} onChange={(e) => set("categoryId", e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl bg-gray-800 border border-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm">
            <option value="">Kategori seçilmedi</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">Yayın Tarihi</label>
          <input type="date" value={form.publishedAt} onChange={(e) => set("publishedAt", e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl bg-gray-800 border border-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm" />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1.5">Kapak Görseli <span className="text-gray-500 font-normal">(JPG, PNG, WEBP)</span></label>
        <div className="flex gap-4 items-start">
          <div
            onClick={() => coverRef.current?.click()}
            className="flex-1 border-2 border-dashed border-gray-700 hover:border-gray-600 rounded-xl p-4 text-center cursor-pointer transition-colors"
          >
            {coverPreview ? (
              <div className="text-white text-sm font-medium">{coverFile?.name}</div>
            ) : (
              <div>
                <div className="text-xl mb-1">🖼️</div>
                <div className="text-gray-400 text-sm">Tıklayın veya sürükleyin</div>
                <div className="text-gray-600 text-xs mt-0.5">JPG, PNG, WEBP · Max 5 MB</div>
              </div>
            )}
          </div>
          {coverPreview && (
            <img src={coverPreview} alt="Önizleme" className="w-20 h-20 object-cover rounded-xl border border-gray-700 flex-shrink-0" />
          )}
        </div>
        <input ref={coverRef} type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" onChange={onCoverChange} className="hidden" />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1.5">Açıklama</label>
        <textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={3}
          className="w-full px-4 py-2.5 rounded-xl bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm resize-none"
          placeholder="Kitap hakkında kısa bir açıklama..." />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1.5">ISBN</label>
        <input value={form.isbn} onChange={(e) => set("isbn", e.target.value)}
          className="w-full px-4 py-2.5 rounded-xl bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
          placeholder="978-..." />
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm">{error}</div>
      )}

      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={loading}
          className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors">
          {loading ? "Kaydediliyor..." : "Kitabı Kaydet"}
        </button>
        <button type="button" onClick={() => router.back()}
          className="px-6 py-2.5 text-gray-400 hover:text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition-colors">
          İptal
        </button>
      </div>
    </form>
  );
}
