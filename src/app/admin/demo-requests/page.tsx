import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Demo Talepleri — Admin" };

function fmt(d: Date) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(d));
}

export default async function DemoRequestsPage() {
  const requests = await prisma.demoRequest.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Demo Talepleri</h1>
          <p className="text-gray-400 text-sm mt-1">{requests.length} talep (en yeni önce, maks. 200)</p>
        </div>
      </div>

      {requests.length === 0 ? (
        <div className="text-gray-500 text-sm">Henüz demo talebi yok.</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-800">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-900 text-gray-400 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3">Tarih</th>
                <th className="px-4 py-3">Şirket</th>
                <th className="px-4 py-3">Ad Soyad</th>
                <th className="px-4 py-3">E-posta</th>
                <th className="px-4 py-3">Çalışan</th>
                <th className="px-4 py-3">Mesaj</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {requests.map((r) => (
                <tr key={r.id} className="bg-gray-950 hover:bg-gray-900 transition-colors">
                  <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{fmt(r.createdAt)}</td>
                  <td className="px-4 py-3 text-white font-medium">{r.company}</td>
                  <td className="px-4 py-3 text-gray-200">{r.name}</td>
                  <td className="px-4 py-3">
                    <a href={`mailto:${r.email}`} className="text-orange-400 hover:underline">{r.email}</a>
                    {r.phone ? <span className="block text-gray-500 text-xs">{r.phone}</span> : null}
                  </td>
                  <td className="px-4 py-3 text-gray-400">{r.employeeCount || "—"}</td>
                  <td className="px-4 py-3 text-gray-400 max-w-xs truncate" title={r.message ?? ""}>
                    {r.message || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
