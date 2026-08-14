import Link from "next/link";
import { prisma } from "@/lib/prisma";

function formatDate(d: Date) {
  return new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(d));
}

export default async function AdminDashboard() {
  const [companiesTotal, booksTotal, packagesTotal, usersTotal, activeCompanies, recentCompanies] =
    await Promise.all([
      prisma.company.count(),
      prisma.book.count(),
      prisma.package.count(),
      prisma.user.count({ where: { role: { not: "SUPER_ADMIN" } } }),
      prisma.company.count({ where: { isActive: true } }),
      prisma.company.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, name: true, createdAt: true, isActive: true, maxSeats: true, licenseType: true },
      }),
    ]);

  const stats = [
    { label: "Toplam Şirket", value: companiesTotal, sub: `${activeCompanies} aktif`, href: "/admin/companies", color: "emerald" },
    { label: "Kitap", value: booksTotal, sub: "kütüphanede", href: "/admin/books", color: "blue" },
    { label: "Paket", value: packagesTotal, sub: "tanımlı", href: "/admin/packages", color: "purple" },
    { label: "Kullanıcı", value: usersTotal, sub: "toplam (admin hariç)", href: "#", color: "orange" },
  ];

  const colorMap: Record<string, string> = {
    emerald: "text-emerald-400 bg-emerald-400/10",
    blue: "text-blue-400 bg-blue-400/10",
    purple: "text-purple-400 bg-purple-400/10",
    orange: "text-orange-400 bg-orange-400/10",
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Genel Bakış</h1>
        <p className="text-gray-400 mt-1 text-sm">AudioB2B platform özeti</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="bg-gray-900 border border-gray-800 rounded-2xl p-5 hover:border-gray-700 transition-colors">
            <div className={`text-3xl font-bold mb-1 ${colorMap[s.color].split(" ")[0]}`}>{s.value}</div>
            <div className="text-white font-medium text-sm">{s.label}</div>
            <div className="text-gray-500 text-xs mt-0.5">{s.sub}</div>
          </Link>
        ))}
      </div>

      {/* Recent companies */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h2 className="text-white font-semibold">Son Eklenen Şirketler</h2>
          <Link href="/admin/companies/new" className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors">
            + Şirket Ekle
          </Link>
        </div>
        <div className="divide-y divide-gray-800">
          {recentCompanies.length === 0 && (
            <div className="px-6 py-8 text-center text-gray-500 text-sm">Henüz şirket eklenmemiş.</div>
          )}
          {recentCompanies.map((c) => (
            <Link key={c.id} href={`/admin/companies/${c.id}`} className="flex items-center justify-between px-6 py-4 hover:bg-gray-800/50 transition-colors">
              <div>
                <div className="text-white font-medium text-sm">{c.name}</div>
                <div className="text-gray-500 text-xs mt-0.5">{formatDate(c.createdAt)} · {c.maxSeats} koltuk · {c.licenseType === "PER_SEAT" ? "Koltuk Başı" : "Esnek Havuz"}</div>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${c.isActive ? "bg-emerald-400/10 text-emerald-400" : "bg-red-400/10 text-red-400"}`}>
                {c.isActive ? "Aktif" : "Pasif"}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
