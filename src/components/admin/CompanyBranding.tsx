"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

function cropToSquare(file: File, size = 400): Promise<Blob> {
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

export default function CompanyBranding({
  companyId,
  currentLogoUrl,
  currentBrandColor,
}: {
  companyId: string;
  currentLogoUrl: string | null;
  currentBrandColor: string;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [logoUrl, setLogoUrl] = useState<string | null>(currentLogoUrl);
  const [brandColor, setBrandColor] = useState(currentBrandColor || "#2563eb");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"idle" | "ok" | "err">("idle");

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const squareBlob = await cropToSquare(file);

      const res = await fetch(`/api/admin/logo-upload-url?contentType=image/jpeg`);
      const { uploadUrl, key } = await res.json();

      await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": "image/jpeg" },
        body: squareBlob,
      });

      setLogoUrl(`/api/logos/${key.replace("logos/", "")}`);
    } catch {
      alert("Logo yüklenirken hata oluştu.");
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setStatus("idle");
    try {
      const res = await fetch(`/api/admin/companies/${companyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logoUrl, brandColor }),
      });
      if (!res.ok) throw new Error();
      setStatus("ok");
      router.refresh();
    } catch {
      setStatus("err");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
      <h2 className="text-white font-semibold mb-5">Kurumsal Görünüm</h2>

      <div className="flex items-start gap-8">
        {/* Logo */}
        <div className="flex-1">
          <div className="text-gray-500 text-xs uppercase tracking-wide mb-3">Şirket Logosu</div>
          <div
            className="w-28 h-28 rounded-xl border-2 border-dashed border-gray-700 flex items-center justify-center cursor-pointer hover:border-gray-500 transition-colors relative overflow-hidden"
            style={logoUrl ? { border: "none" } : {}}
            onClick={() => fileRef.current?.click()}
          >
            {logoUrl ? (
              <>
                <img
                  src={logoUrl}
                  alt="Logo"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl">
                  <span className="text-white text-xs font-semibold">Değiştir</span>
                </div>
              </>
            ) : uploading ? (
              <span className="text-gray-500 text-sm">Yükleniyor...</span>
            ) : (
              <div className="text-center">
                <div className="text-2xl mb-1">🖼️</div>
                <span className="text-gray-500 text-xs">PNG, JPG veya WEBP yükle</span>
              </div>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,.jpg,.jpeg,.png,.webp"
            className="hidden"
            onChange={handleLogoChange}
          />
        </div>

        {/* Brand color */}
        <div>
          <div className="text-gray-500 text-xs uppercase tracking-wide mb-3">Kurumsal Renk</div>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={brandColor}
              onChange={(e) => setBrandColor(e.target.value)}
              className="w-14 h-14 rounded-xl cursor-pointer border-2 border-gray-700 bg-transparent"
              title="Renk seç"
            />
            <div>
              <div
                className="w-40 h-9 rounded-xl flex items-center justify-center text-sm font-semibold"
                style={{ backgroundColor: brandColor + "22", color: brandColor }}
              >
                Aktif menü örneği
              </div>
              <div className="text-gray-600 text-xs mt-1.5 font-mono">{brandColor}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mt-6 pt-5 border-t border-gray-800">
        {status === "ok" && (
          <span className="text-emerald-400 text-sm">Kaydedildi.</span>
        )}
        {status === "err" && (
          <span className="text-red-400 text-sm">Bir hata oluştu.</span>
        )}
        {status === "idle" && <span />}

        <button
          onClick={handleSave}
          disabled={saving || uploading}
          className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors"
        >
          {saving ? "Kaydediliyor..." : "Kaydet"}
        </button>
      </div>
    </div>
  );
}
