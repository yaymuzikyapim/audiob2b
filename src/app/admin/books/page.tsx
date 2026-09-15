import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import BooksFilter from "@/components/admin/BooksFilter";
import ToggleActiveButton from "@/components/admin/ToggleActiveButton";

function formatDuration(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}s ${m}dk`;
  return `${m}dk`;
}

export default async function BooksPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; status?: string; q?: string }>;
}) {
  const { category, status, q } = await searchParams;

  const where: Record<string, unknown> = {};
  if (category) where.category = { name: category };
  if (status === "active")  where.isActive = true;
  if (status === "passive") where.isActive = false;
  if (q) where.OR = [
    { title:    { contains: q, mode: "insensitive" } },
    { author:   { contains: q, mode: "insensitive" } },
    { narrator: { contains: q, mode: "insensitive" } },
  ];

  const [books, total, categories] = await Promise.all([
    prisma.book.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        category: { select: { name: true } },
        _count: { select: { chapters: true, packages: true } },
      },
    }),
    prisma.book.count(),
    prisma.category.findMany({
      where: { books: { some: {} } },
      orderBy: { name: "asc" },
      select: { name: true },
    }),
  ]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Kitaplar</h1>
        </div>
        <div className="flex gap-3">
          <Link
            href="/admin/books/import"
            className="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            CSV İçe Aktar
          </Link>
          <Link
            href="/admin/books/new"
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            + Kitap Ekle
          </Link>
        </div>
      </div>

      <Suspense>
        <BooksFilter categories={categories} total={total} filtered={books.length} />
      </Suspense>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        {books.length === 0 && (
          <div className="px-6 py-16 text-center text-gray-500">
            <div className="text-4xl mb-3">🔍</div>
            <div className="font-medium text-white mb-1">Sonuç bulunamadı</div>
            <div className="text-sm">Farklı bir filtre deneyin.</div>
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
                    <Link href={`/admin/books/${b.id}`} className="flex items-center gap-3 group">
                      <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-800 flex-shrink-0">
                        {b.coverUrl ? (
                          <Image src={b.coverUrl} alt={b.title} width={40} height={40} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-600 text-lg">🎧</div>
                        )}
                      </div>
                      <div>
                        <div className="text-white font-medium group-hover:text-emerald-400 transition-colors text-sm">{b.title}</div>
                        <div className="text-gray-500 text-xs mt-0.5">{b.author}{b.narrator ? ` · ${b.narrator}` : ""}</div>
                      </div>
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-gray-400 text-sm">{b.category?.name || "—"}</td>
                  <td className="px-6 py-4 text-gray-400 text-sm">{formatDuration(b.duration)}</td>
                  <td className="px-6 py-4 text-gray-400 text-sm">{b._count.chapters}</td>
                  <td className="px-6 py-4 text-gray-400 text-sm">{b._count.packages}</td>
                  <td className="px-6 py-4">
                    <ToggleActiveButton bookId={b.id} isActive={b.isActive} />
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
