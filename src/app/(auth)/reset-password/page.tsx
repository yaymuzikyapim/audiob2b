"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

function ResetForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Şifreler eşleşmiyor.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (res.ok) {
        setDone(true);
      } else {
        setError(data.error ?? "Bir hata oluştu.");
      }
    } catch {
      setError("Bağlantı hatası.");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="text-center space-y-4">
        <p className="text-red-400 text-sm">Geçersiz bağlantı.</p>
        <Link href="/forgot-password" className="text-sm text-emerald-400 hover:text-emerald-300 transition">
          Yeni sıfırlama bağlantısı iste
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="space-y-4 text-center">
        <div className="text-4xl">✓</div>
        <p className="text-gray-300 text-sm">Şifreniz başarıyla güncellendi.</p>
        <Link
          href="/login"
          className="block text-sm text-emerald-400 hover:text-emerald-300 transition mt-2"
        >
          Giriş sayfasına git →
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1.5">Yeni Şifre</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          maxLength={72}
          className="w-full px-4 py-3 rounded-xl bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
          placeholder="En az 8 karakter, büyük harf ve rakam"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1.5">Şifre Tekrar</label>
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          className="w-full px-4 py-3 rounded-xl bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
          placeholder="••••••••"
        />
      </div>

      <p className="text-xs text-gray-500">
        En az 8 karakter, 1 büyük harf ve 1 rakam içermelidir.
      </p>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition"
      >
        {loading ? "Kaydediliyor..." : "Şifremi Güncelle"}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white">AudioB2B</h1>
          <p className="text-gray-400 mt-2">Kurumsal Sesli Kitap Platformu</p>
        </div>
        <div className="bg-gray-900 rounded-2xl p-8 shadow-xl border border-gray-800">
          <h2 className="text-xl font-semibold text-white mb-6">Yeni Şifre Belirle</h2>
          <Suspense fallback={<div className="text-gray-400 text-sm">Yükleniyor...</div>}>
            <ResetForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
