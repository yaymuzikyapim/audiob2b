import Link from "next/link";
import { prisma } from "@/lib/prisma";

function formatDate(d: Date) {
  return new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(d));
}

export default async function CompaniesPage() {
  const companies = await prisma.company.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      package: { select: { name: true } },
      _count: { select: { users: true } },
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Şirketler</h1>
          <p className="text-gray-400 mt-1 text-sm">{companies.length} şirket kayıtlı</p>
        </div>
        <Link
          href="/admin/companies/new"
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          + Şirket Ekle
        </Link>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        {companies.length === 0 && (
          <div className="px-6 py-16 text-center text-gray-500">
            <div className="text-4xl mb-3">🏢</div>
            <div className="font-medium text-white mb-1">Henüz şirket yok</div>
            <div className="text-sm">İlk kurumsal müşteriyi eklemek için butona tıklayın.</div>
          </div>
        )}
        {companies.length > 0 && (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800 text-left">
                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Şirket</th>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Paket</th>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Lisans</th>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Kullanıcı</th>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Bitiş</th>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Durum</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {companies.map((c) => (
                <tr key={c.id} className="hover:bg-gray-800/40 transition-colors">
                  <td className="px-6 py-4">
                    <Link href={`/admin/companies/${c.id}`} className="text-white font-medium hover:text-emerald-400 transition-colors">
                      {c.name}
                    </Link>
                    <div className="text-gray-500 text-xs mt-0.5">/{c.slug}</div>
                  </td>
                  <td className="px-6 py-4 text-gray-400 text-sm">{c.package?.name || "—"}</td>
                  <td className="px-6 py-4 text-gray-400 text-sm">
                    {c.licenseType === "PER_SEAT" ? `${c.maxSeats} koltuk` : `${c.maxSeats} havuz`}
                  </td>
                  <td className="px-6 py-4 text-gray-400 text-sm">{c._count.users}</td>
                  <td className="px-6 py-4 text-gray-400 text-sm">{formatDate(c.endDate)}</td>
                  <td className="px-6 py-4">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${c.isActive ? "bg-emerald-400/10 text-emerald-400" : "bg-red-400/10 text-red-400"}`}>
                      {c.isActive ? "Aktif" : "Pasif"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
