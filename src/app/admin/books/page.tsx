import Link from "next/link";
import { prisma } from "@/lib/prisma";

function formatDuration(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}s ${m}dk`;
  return `${m}dk`;
}

export default async function BooksPage() {
  const books = await prisma.book.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      category: { select: { name: true } },
      _count: { select: { chapters: true, packages: true } },
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Kitaplar</h1>
          <p className="text-gray-400 mt-1 text-sm">{books.length} sesli kitap kütüphanede</p>
        </div>
        <Link
          href="/admin/books/new"
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          + Kitap Ekle
        </Link>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        {books.length === 0 && (
          <div className="px-6 py-16 text-center text-gray-500">
            <div className="text-4xl mb-3">🎧</div>
            <div className="font-medium text-white mb-1">Henüz kitap yok</div>
            <div className="text-sm">İlk sesli kitabı eklemek için butona tıklayın.</div>
          </div>
        )}
        {books.length > 0 && (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800 text-left">
                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Kitap</th>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Kategori</th>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Süre</th>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Bölüm</th>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Paket</th>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Durum</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {books.map((b) => (
                <tr key={b.id} className="hover:bg-gray-800/40 transition-colors">
                  <td className="px-6 py-4">
                    <Link href={`/admin/books/${b.id}`} className="text-white font-medium hover:text-emerald-400 transition-colors text-sm">
                      {b.title}
                    </Link>
                    <div className="text-gray-500 text-xs mt-0.5">{b.author}{b.narrator ? ` · ${b.narrator}` : ""}</div>
                  </td>
                  <td className="px-6 py-4 text-gray-400 text-sm">{b.category?.name || "—"}</td>
                  <td className="px-6 py-4 text-gray-400 text-sm">{formatDuration(b.duration)}</td>
                  <td className="px-6 py-4 text-gray-400 text-sm">{b._count.chapters}</td>
                  <td className="px-6 py-4 text-gray-400 text-sm">{b._count.packages}</td>
                  <td className="px-6 py-4">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${b.isActive ? "bg-emerald-400/10 text-emerald-400" : "bg-red-400/10 text-red-400"}`}>
                      {b.isActive ? "Aktif" : "Pasif"}
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
