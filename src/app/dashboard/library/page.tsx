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

export default async function LibraryPage() {
  const session = await getSession();
  if (!session || session.role === "SUPER_ADMIN") redirect("/login");
  if (!session.companyId) redirect("/dashboard");

  const company = await prisma.company.findUnique({
    where: { id: session.companyId },
    select: {
      isActive: true,
      brandColor: true,
      package: {
        select: {
          name: true,
          books: {
            include: {
              book: {
                select: {
                  id: true, title: true, author: true, narrator: true,
                  duration: true, coverUrl: true, description: true,
                  category: { select: { name: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  const books = company?.package?.books.map((pb) => pb.book) ?? [];
  const color = company?.brandColor ?? "#2563eb";

  const playerStates = await prisma.playerState.findMany({
    where: { userId: session.id, bookId: { in: books.map((b) => b.id) } },
    select: { bookId: true, positionSec: true },
  });
  const stateMap = Object.fromEntries(playerStates.map((ps) => [ps.bookId, ps.positionSec]));

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Kütüphane</h1>
        <p className="text-gray-400 mt-1 text-sm">
          {company?.package?.name ? `${company.package.name} paketi` : "Paket atanmamış"} · {books.length} kitap
        </p>
      </div>

      {books.length === 0 && (
        <div className="text-center py-20">
          <div className="text-4xl mb-3">📭</div>
          <h3 className="text-white font-semibold mb-2">Kütüphane boş</h3>
          <p className="text-gray-400 text-sm">Şirketinizin paketinde henüz kitap bulunmuyor.</p>
        </div>
      )}

      <div className="grid grid-cols-4 gap-5">
        {books.map((book) => {
          const pos = stateMap[book.id] ?? 0;
          const pct = pos > 0 ? Math.min(100, Math.round((pos / book.duration) * 100)) : 0;

          return (
            <Link key={book.id} href={`/dashboard/listen/${book.id}`}
              className="group bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden hover:border-gray-700 transition-colors">
              {book.coverUrl ? (
                <img src={book.coverUrl} alt={book.title} className="w-full aspect-square object-cover" />
              ) : (
                <div className="w-full aspect-square bg-gray-800 flex items-center justify-center text-4xl">🎧</div>
              )}
              <div className="p-4">
                <h3 className="text-white font-semibold text-sm line-clamp-2 transition-colors group-hover:opacity-80">{book.title}</h3>
                <p className="text-gray-500 text-xs mt-1">{book.author}</p>
                {book.narrator && <p className="text-gray-600 text-xs mt-0.5">Seslendiren: {book.narrator}</p>}
                <div className="flex items-center justify-between mt-3">
                  {book.category && (
                    <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">{book.category.name}</span>
                  )}
                  <span className="text-gray-500 text-xs">{formatDuration(book.duration)}</span>
                </div>
                {pct > 0 && (
                  <div className="mt-3">
                    <div className="w-full bg-gray-800 rounded-full h-1">
                      <div className="h-1 rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
                    </div>
                    <span className="text-xs mt-1 block" style={{ color }}>%{pct} tamamlandı</span>
                  </div>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
