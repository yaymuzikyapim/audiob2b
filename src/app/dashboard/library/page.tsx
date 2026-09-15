import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import LibraryGrid from "@/components/dashboard/LibraryGrid";

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
            where: { book: { isActive: true } },
            include: {
              book: {
                select: {
                  id: true, title: true, author: true, narrator: true,
                  duration: true, coverUrl: true, description: true,
                  category: { select: { name: true } },
                  _count: { select: { chapters: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  const color = company?.brandColor ?? "#2563eb";
  const rawBooks = company?.package?.books.map((pb) => pb.book).filter(Boolean) ?? [];
  const bookIds = rawBooks.map((b) => b!.id);

  const [playerStates, userFavorites] = await Promise.all([
    prisma.playerState.findMany({
      where: { userId: session.id, bookId: { in: bookIds } },
      select: { bookId: true, positionSec: true },
    }),
    (prisma as any).userFavorite.findMany({
      where: { userId: session.id, bookId: { in: bookIds } },
      select: { bookId: true },
    }).catch(() => []),
  ]);

  const stateMap = Object.fromEntries(playerStates.map((ps: any) => [ps.bookId, ps.positionSec]));
  const favoriteSet = new Set((userFavorites as any[]).map((f) => f.bookId));

  const books = rawBooks.map((b) => ({
    id: b!.id,
    title: b!.title,
    author: b!.author,
    narrator: b!.narrator,
    duration: b!.duration,
    coverUrl: b!.coverUrl,
    description: b!.description ?? null,
    hasAudio: b!._count.chapters > 0,
    progressPct: stateMap[b!.id]
      ? Math.min(100, Math.round((stateMap[b!.id] / b!.duration) * 100))
      : 0,
    isFavorite: favoriteSet.has(b!.id),
    category: b!.category?.name ?? null,
  }));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Kütüphane</h1>
        <p className="text-gray-400 mt-1 text-sm">
          {company?.package?.name ?? "Demo"} · {books.length} kitap
        </p>
      </div>
      <LibraryGrid books={books} color={color} />
    </div>
  );
}
