"use client";

import { useRef, useState } from "react";
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

export default function CoverUploader({ bookId, currentCoverUrl }: { bookId: string; currentCoverUrl: string | null }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(currentCoverUrl);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError("");

    // Kare kırp → 600x600 JPEG
    const squareBlob = await cropToSquare(file);
    setPreview(URL.createObjectURL(squareBlob));

    const urlRes = await fetch(`/api/admin/cover-upload-url?ext=jpg`);
    const { uploadUrl, key } = await urlRes.json();

    const uploadRes = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": "image/jpeg" }, body: squareBlob });

    if (!uploadRes.ok) {
      setError("Yükleme başarısız.");
      setUploading(false);
      return;
    }

    const coverUrl = `/api/covers/${key.replace("covers/", "")}`;
    const patchRes = await fetch(`/api/admin/books/${bookId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ coverUrl }),
    });

    setUploading(false);
    if (!patchRes.ok) {
      setError("Kapak güncellenemedi.");
    } else {
      router.refresh();
    }
  }

  return (
    <div className="relative group flex-shrink-0">
      <div
        onClick={() => !uploading && inputRef.current?.click()}
        className="w-32 h-32 rounded-xl border border-gray-800 overflow-hidden cursor-pointer relative"
      >
        {preview ? (
          <img src={preview} alt="Kapak" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gray-800 flex items-center justify-center text-gray-600 text-xs text-center px-2">
            Kapak yok
          </div>
        )}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <span className="text-white text-xs font-medium">{uploading ? "Yükleniyor..." : "Değiştir"}</span>
        </div>
      </div>
      {error && <div className="text-red-400 text-xs mt-1">{error}</div>}
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" onChange={onChange} className="hidden" />
    </div>
  );
}
