"use client";

import { useState, useEffect } from "react";

const inputCls =
  "w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400";

interface SubmittedPayload {
  name: string;
  company: string;
  email: string;
  phone: string;
  employeeCount: string;
  message: string;
  website?: string;
  kvkkAccepted: boolean;
  formLoadedAt: number;
}

export default function DemoRequestForm() {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = useState("");
  const [formLoadedAt, setFormLoadedAt] = useState<number>(0);
  const [lastSubmittedData, setLastSubmittedData] = useState<Record<string, string>>({});

  useEffect(() => {
    setFormLoadedAt(Date.now());
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("loading");
    setError("");

    const form = e.currentTarget;
    const formData = new FormData(form);

    const payload: SubmittedPayload = {
      name: String(formData.get("name") || ""),
      company: String(formData.get("company") || ""),
      email: String(formData.get("email") || ""),
      phone: String(formData.get("phone") || ""),
      employeeCount: String(formData.get("employeeCount") || ""),
      message: String(formData.get("message") || ""),
      website: String(formData.get("website") || ""),
      kvkkAccepted: formData.get("kvkkAccepted") === "on",
      formLoadedAt,
    };

    setLastSubmittedData({
      name: payload.name,
      company: payload.company,
      email: payload.email,
      phone: payload.phone,
      employeeCount: payload.employeeCount,
      message: payload.message,
    });

    try {
      const res = await fetch("/api/demo-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || "Talebiniz iletilirken bir sorun oluştu.");
        setStatus("error");
        return;
      }
      form.reset();
      setStatus("success");
    } catch {
      setError("Bağlantı hatası oluştu.");
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="rounded-2xl bg-green-50 border border-green-200 p-8 text-center">
        <p className="text-lg font-semibold text-green-800 mb-1">Talebiniz başarıyla alındı</p>
        <p className="text-sm text-green-700">
          Ekibimiz en kısa sürede sizinle iletişime geçerek kurumsal demonuzu hazırlayacaktır.
        </p>
      </div>
    );
  }

  const fallbackMailto = `mailto:satis@audiob2b.com.tr?subject=${encodeURIComponent(
    `AudioB2B Demo Talebi — ${lastSubmittedData.company || ""}`
  )}&body=${encodeURIComponent(
    `Ad Soyad: ${lastSubmittedData.name || ""}\nŞirket: ${lastSubmittedData.company || ""}\nİş E-postası: ${
      lastSubmittedData.email || ""
    }\nTelefon: ${lastSubmittedData.phone || ""}\nÇalışan Sayısı: ${
      lastSubmittedData.employeeCount || ""
    }\nMesaj: ${lastSubmittedData.message || ""}`
  )}`;

  return (
    <form onSubmit={onSubmit} className="space-y-4 text-left">
      <div className="grid sm:grid-cols-2 gap-4">
        <input name="name" required minLength={2} maxLength={100} placeholder="Ad Soyad *" className={inputCls} />
        <input name="company" required minLength={2} maxLength={150} placeholder="Şirket *" className={inputCls} />
        <input name="email" type="email" required maxLength={200} placeholder="İş e-postası *" className={inputCls} />
        <input name="phone" type="tel" maxLength={30} placeholder="Telefon" className={inputCls} />
      </div>

      <select name="employeeCount" defaultValue="" className={inputCls}>
        <option value="">Çalışan sayısı seçiniz</option>
        <option value="1-50">1-50</option>
        <option value="51-250">51-250</option>
        <option value="251-1000">251-1000</option>
        <option value="1000+">1000+</option>
      </select>

      <textarea name="message" rows={3} maxLength={1000} placeholder="Eklemek istediğiniz notlar (isteğe bağlı)" className={inputCls} />

      {/* Honeypot */}
      <input
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hidden"
      />

      {/* KVKK Onay Kutusu */}
      <div className="flex items-start gap-3 pt-1">
        <input
          id="kvkkAccepted"
          name="kvkkAccepted"
          type="checkbox"
          required
          className="mt-1 h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-orange-400 shrink-0 cursor-pointer"
        />
        <label htmlFor="kvkkAccepted" className="text-xs text-gray-500 leading-relaxed cursor-pointer">
          Kişisel verilerimin demo talebimin karşılanması ve benimle iletişime geçilmesi amacıyla işlenmesine ilişkin{" "}
          <a
            href="/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-orange-600 underline hover:text-orange-700"
          >
            Aydınlatma Metni&apos;ni
          </a>{" "}
          okudum.
        </label>
      </div>

      {status === "error" && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700 space-y-2">
          <p>{error}</p>
          <p className="text-xs text-gray-600">
            Talebinizin kaybolmaması için doğrudan e-posta gönderebilirsiniz:{" "}
            <a
              href={fallbackMailto}
              className="inline-block font-semibold text-orange-600 underline hover:text-orange-700 mt-1"
            >
              E-posta ile Gönder (Yedek) →
            </a>
          </p>
        </div>
      )}

      <button
        type="submit"
        disabled={status === "loading"}
        className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-semibold px-8 py-4 rounded-xl transition-colors text-base cursor-pointer"
      >
        {status === "loading" ? "İletiliyor..." : "Demo Talep Et"}
      </button>
    </form>
  );
}
