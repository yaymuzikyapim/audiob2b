import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

function formatDuration(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}s ${m}dk`;
  return `${m}dk`;
}

function formatDate(d: Date) {
  return new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(d));
}

export default async function DashboardHome() {
  const session = await getSession();
  if (!session || session.role === "SUPER_ADMIN") redirect("/login");
  if (!session.companyId) {
    return (
      <div className="text-center py-20">
        <div className="text-4xl mb-4">⚠️</div>
        <h2 className="text-white text-xl font-semibold mb-2">Şirkete bağlı değilsiniz</h2>
        <p className="text-gray-400 text-sm">Yöneticinizle iletişime geçin.</p>
      </div>
    );
  }

  const company = await prisma.company.findUnique({
    where: { id: session.companyId },
    select: {
      name: true,
      endDate: true,
      maxSeats: true,
      isActive: true,
      brandColor: true,
      package: { select: { name: true, books: { select: { bookId: true } } } },
      _count: { select: { users: true } },
    },
  });

  const color = company?.brandColor ?? "#2563eb";

  // Son dinlemeler
  const recentStates = await prisma.playerState.findMany({
    where: { userId: session.id },
    orderBy: { updatedAt: "desc" },
    take: 3,
    include: {
      book: { select: { id: true, title: true, author: true, duration: true, coverUrl: true } },
    },
  });

  const bookCount = company?.package?.books.length ?? 0;
  const daysLeft = company ? Math.ceil((new Date(company.endDate).getTime() - Date.now()) / 86400000) : 0;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Merhaba{session.name ? `, ${session.name.split(" ")[0]}` : ""} 👋</h1>
        <p className="text-gray-400 mt-1 text-sm">{company?.name} · {session.role === "COMPANY_ADMIN" ? "Şirket Yöneticisi" : "Çalışan"}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <div className="text-2xl font-bold" style={{ color }}>{bookCount}</div>
          <div className="text-white font-medium text-sm mt-1">Erişilebilir Kitap</div>
          <div className="text-gray-500 text-xs mt-0.5">{company?.package?.name || "Paket atanmamış"}</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <div className="text-2xl font-bold text-white">{company?._count.users ?? 0}</div>
          <div className="text-white font-medium text-sm mt-1">Ekip Üyesi</div>
          <div className="text-gray-500 text-xs mt-0.5">{company?.maxSeats} koltuk lisanslı</div>
        </div>
        <div className={`bg-gray-900 border rounded-2xl p-5 ${daysLeft < 30 ? "border-orange-500/30" : "border-gray-800"}`}>
          <div className={`text-2xl font-bold ${daysLeft < 30 ? "text-orange-400" : "text-white"}`}>
            {daysLeft > 0 ? `${daysLeft} gün` : "Süresi doldu"}
          </div>
          <div className="text-white font-medium text-sm mt-1">Lisans Süresi</div>
          <div className="text-gray-500 text-xs mt-0.5">{company ? formatDate(company.endDate) : ""}'e kadar</div>
        </div>
      </div>

      {/* Devam et */}
      {recentStates.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-semibold">Kaldığın Yerden Devam Et</h2>
            <Link href="/dashboard/library" className="text-sm transition-colors hover:opacity-80" style={{ color }}>Tümünü gör</Link>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {recentStates.map((ps) => {
              const pct = Math.min(100, Math.round((ps.positionSec / ps.book.duration) * 100));
              return (
                <Link key={ps.bookId} href={`/dashboard/listen/${ps.bookId}`}
                  className="bg-gray-900 border border-gray-800 rounded-2xl p-4 hover:border-gray-700 transition-colors group">
                  <div className="flex gap-3 mb-3">
                    {ps.book.coverUrl ? (
                      <img src={ps.book.coverUrl} alt="" className="w-12 h-12 object-cover rounded-lg flex-shrink-0" />
                    ) : (
                      <div className="w-12 h-12 bg-gray-800 rounded-lg flex-shrink-0 flex items-center justify-center text-xl">🎧</div>
                    )}
                    <div className="min-w-0">
                      <div className="text-white text-sm font-medium truncate">{ps.book.title}</div>
                      <div className="text-gray-500 text-xs mt-0.5">{ps.book.author}</div>
                    </div>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-1.5">
                    <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
                  </div>
                  <div className="flex justify-between mt-1.5">
                    <span className="text-xs" style={{ color }}>%{pct} tamamlandı</span>
                    <span className="text-gray-500 text-xs">{formatDuration(ps.book.duration)}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Kütüphaneye git */}
      {recentStates.length === 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center">
          <div className="text-4xl mb-3">🎧</div>
          <h3 className="text-white font-semibold mb-2">Dinlemeye başla</h3>
          <p className="text-gray-400 text-sm mb-4">Kütüphanende {bookCount} sesli kitap seni bekliyor.</p>
          <Link href="/dashboard/library"
            className="inline-flex px-5 py-2.5 text-white text-sm font-semibold rounded-xl transition-opacity hover:opacity-85"
            style={{ backgroundColor: color }}>
            Kütüphaneye Git
          </Link>
        </div>
      )}
    </div>
  );
}
