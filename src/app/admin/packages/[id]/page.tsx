import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import PackageBookManager from "@/components/admin/PackageBookManager";

function formatDuration(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}s ${m}dk`;
  return `${m}dk`;
}

export default async function PackageDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [pkg, allBooks] = await Promise.all([
    prisma.package.findUnique({
      where: { id },
      include: {
        books: { include: { book: { select: { id: true, title: true, author: true, duration: true, coverUrl: true } } } },
        companies: { select: { id: true, name: true, isActive: true } },
      },
    }),
    prisma.book.findMany({
      where: { isActive: true },
      orderBy: { title: "asc" },
      select: { id: true, title: true, author: true, duration: true },
    }),
  ]);

  if (!pkg) notFound();

  const inPackageIds = new Set(pkg.books.map((pb) => pb.bookId));
  const totalDuration = pkg.books.reduce((acc, pb) => acc + pb.book.duration, 0);

  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/admin/packages" className="hover:text-white transition-colors">Paketler</Link>
        <span>/</span>
        <span className="text-white">{pkg.name}</span>
      </div>

      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">{pkg.name}</h1>
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${pkg.isActive ? "bg-emerald-400/10 text-emerald-400" : "bg-red-400/10 text-red-400"}`}>
              {pkg.isActive ? "Aktif" : "Pasif"}
            </span>
          </div>
          {pkg.description && <p className="text-gray-400 mt-1 text-sm">{pkg.description}</p>}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <div className="text-2xl font-bold text-white">{pkg.books.length}</div>
          <div className="text-gray-400 text-sm mt-1">Kitap</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <div className="text-2xl font-bold text-white">{formatDuration(totalDuration)}</div>
          <div className="text-gray-400 text-sm mt-1">Toplam Süre</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <div className="text-2xl font-bold text-white">{pkg.companies.length}</div>
          <div className="text-gray-400 text-sm mt-1">Şirket</div>
        </div>
      </div>

      {/* Book manager */}
      <PackageBookManager
        packageId={id}
        inPackageIds={Array.from(inPackageIds)}
        currentBooks={pkg.books.map((pb) => pb.book)}
        allBooks={allBooks}
      />

      {/* Companies using this package */}
      {pkg.companies.length > 0 && (
        <div className="mt-6 bg-gray-900 border border-gray-800 rounded-2xl">
          <div className="px-6 py-4 border-b border-gray-800">
            <h2 className="text-white font-semibold">Bu Paketi Kullanan Şirketler</h2>
          </div>
          <div className="divide-y divide-gray-800">
            {pkg.companies.map((c) => (
              <Link key={c.id} href={`/admin/companies/${c.id}`}
                className="flex items-center justify-between px-6 py-4 hover:bg-gray-800/50 transition-colors">
                <span className="text-white text-sm font-medium">{c.name}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${c.isActive ? "bg-emerald-400/10 text-emerald-400" : "bg-red-400/10 text-red-400"}`}>
                  {c.isActive ? "Aktif" : "Pasif"}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
