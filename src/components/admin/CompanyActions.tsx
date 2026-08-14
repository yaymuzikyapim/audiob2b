"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Package { id: string; name: string }

interface Company {
  id: string;
  name: string;
  slug: string;
  licenseType: string;
  maxSeats: number;
  packageId: string | null;
  startDate: Date;
  endDate: Date;
  notes: string | null;
  isActive: boolean;
}

export default function CompanyActions({ company, packages }: { company: Company; packages: Package[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    name: company.name,
    licenseType: company.licenseType,
    maxSeats: company.maxSeats.toString(),
    packageId: company.packageId || "",
    startDate: new Date(company.startDate).toISOString().slice(0, 10),
    endDate: new Date(company.endDate).toISOString().slice(0, 10),
    notes: company.notes || "",
    isActive: company.isActive,
  });

  function set(field: string, value: string | boolean) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSave() {
    setLoading(true);
    setError("");
    const res = await fetch(`/api/admin/companies/${company.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, maxSeats: parseInt(form.maxSeats) }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error || "Hata oluştu."); return; }
    setEditing(false);
    router.refresh();
  }

  async function handleToggle() {
    await fetch(`/api/admin/companies/${company.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !company.isActive }),
    });
    router.refresh();
  }

  if (!editing) {
    return (
      <div className="flex gap-2">
        <button
          onClick={() => setEditing(true)}
          className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-xl transition-colors"
        >
          Düzenle
        </button>
        <button
          onClick={handleToggle}
          className={`px-4 py-2 text-sm font-medium rounded-xl transition-colors ${company.isActive ? "text-red-400 hover:bg-red-400/10" : "text-emerald-400 hover:bg-emerald-400/10"}`}
        >
          {company.isActive ? "Pasife Al" : "Aktive Et"}
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-lg">
        <h3 className="text-white font-semibold mb-5">Şirketi Düzenle</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Şirket Adı</label>
            <input value={form.name} onChange={(e) => set("name", e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Lisans Tipi</label>
              <select value={form.licenseType} onChange={(e) => set("licenseType", e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                <option value="PER_SEAT">Koltuk Başına</option>
                <option value="FLEX_POOL">Esnek Havuz</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Maks. Koltuk</label>
              <input type="number" value={form.maxSeats} onChange={(e) => set("maxSeats", e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Paket</label>
            <select value={form.packageId} onChange={(e) => set("packageId", e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
              <option value="">Paket seçilmedi</option>
              {packages.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Başlangıç</label>
              <input type="date" value={form.startDate} onChange={(e) => set("startDate", e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Bitiş</label>
              <input type="date" value={form.endDate} onChange={(e) => set("endDate", e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">İç Not</label>
            <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2}
              className="w-full px-4 py-2.5 rounded-xl bg-gray-800 border border-gray-700 text-white text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
        </div>
        {error && <div className="mt-3 text-red-400 text-sm">{error}</div>}
        <div className="flex gap-3 mt-5">
          <button onClick={handleSave} disabled={loading}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 text-white text-sm font-semibold rounded-xl transition-colors">
            {loading ? "Kaydediliyor..." : "Kaydet"}
          </button>
          <button onClick={() => setEditing(false)}
            className="px-5 py-2.5 text-gray-400 hover:text-white text-sm rounded-xl hover:bg-gray-800 transition-colors">
            İptal
          </button>
        </div>
      </div>
    </div>
  );
}
