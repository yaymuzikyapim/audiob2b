import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function PackagesPage() {
  const packages = await prisma.package.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { books: true, companies: true } },
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Paketler</h1>
          <p className="text-gray-400 mt-1 text-sm">{packages.length} paket tanımlı</p>
        </div>
        <Link
          href="/admin/packages/new"
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          + Paket Oluştur
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {packages.length === 0 && (
          <div className="col-span-3 bg-gray-900 border border-gray-800 rounded-2xl px-6 py-16 text-center text-gray-500">
            <div className="text-4xl mb-3">📦</div>
            <div className="font-medium text-white mb-1">Henüz paket yok</div>
            <div className="text-sm">Paket oluşturup içine kitap ekleyin, ardından şirketlere atayın.</div>
          </div>
        )}
        {packages.map((p) => (
          <Link key={p.id} href={`/admin/packages/${p.id}`}
            className="bg-gray-900 border border-gray-800 rounded-2xl p-6 hover:border-gray-700 transition-colors">
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-white font-semibold">{p.name}</h3>
              <span className={`text-xs px-2 py-0.5 rounded-full ${p.isActive ? "bg-emerald-400/10 text-emerald-400" : "bg-red-400/10 text-red-400"}`}>
                {p.isActive ? "Aktif" : "Pasif"}
              </span>
            </div>
            {p.description && <p className="text-gray-400 text-sm mb-4 line-clamp-2">{p.description}</p>}
            <div className="flex gap-4 text-sm">
              <span className="text-gray-400"><span className="text-white font-medium">{p._count.books}</span> kitap</span>
              <span className="text-gray-400"><span className="text-white font-medium">{p._count.companies}</span> şirket</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
