import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import AudioPlayer from "@/components/dashboard/AudioPlayer";

function formatDuration(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}s ${m}dk`;
  return `${m}dk`;
}

export default async function ListenPage({ params }: { params: Promise<{ bookId: string }> }) {
  const session = await getSession();
  if (!session || session.role === "SUPER_ADMIN") redirect("/login");
  if (!session.companyId) redirect("/dashboard");

  const { bookId } = await params;

  // Kitabın pakette olduğunu doğrula
  const company = await prisma.company.findUnique({
    where: { id: session.companyId },
    select: { packageId: true, isActive: true },
  });

  if (!company?.isActive || !company.packageId) redirect("/dashboard");

  const inPackage = await prisma.packageBook.findUnique({
    where: { packageId_bookId: { packageId: company.packageId, bookId } },
  });
  if (!inPackage) notFound();

  const [book, playerState, bookmarksRaw, companyBranding] = await Promise.all([
    prisma.book.findUnique({
      where: { id: bookId },
      include: {
        chapters: { orderBy: { order: "asc" } },
        category: { select: { name: true } },
      },
    }),
    prisma.playerState.findUnique({
      where: { userId_bookId: { userId: session.id, bookId } },
    }),
    prisma.bookmark.findMany({
      where: { userId: session.id, bookId },
      orderBy: { createdAt: "asc" },
    }),
    prisma.user.findUnique({
      where: { id: session.id },
      select: { company: { select: { brandColor: true } } },
    }),
  ]);

  if (!book) notFound();

  const brandColor = companyBranding?.company?.brandColor ?? "#2563eb";

  return (
    <div className="max-w-4xl">
      {/* Kitap başlık alanı */}
      <div className="flex gap-6 mb-8">
        {book.coverUrl ? (
          <img src={book.coverUrl} alt={book.title}
            className="w-32 h-32 object-cover rounded-2xl border border-gray-800 flex-shrink-0 shadow-xl" />
        ) : (
          <div className="w-32 h-44 bg-gray-800 rounded-2xl flex items-center justify-center text-4xl flex-shrink-0">🎧</div>
        )}
        <div className="flex-1 pt-2">
          <h1 className="text-2xl font-bold text-white">{book.title}</h1>
          <p className="text-gray-400 mt-1">{book.author}</p>
          {book.narrator && <p className="text-gray-500 text-sm mt-0.5">Seslendiren: {book.narrator}</p>}
          <div className="flex gap-3 mt-3">
            {book.category && (
              <span className="text-xs bg-gray-800 text-gray-400 px-3 py-1 rounded-full">{book.category.name}</span>
            )}
            <span className="text-xs bg-gray-800 text-gray-400 px-3 py-1 rounded-full">{formatDuration(book.duration)}</span>
            <span className="text-xs bg-gray-800 text-gray-400 px-3 py-1 rounded-full">{book.chapters.length} bölüm</span>
          </div>
          {book.description && (
            <p className="text-gray-400 text-sm mt-3 leading-relaxed">{book.description}</p>
          )}
        </div>
      </div>

      {/* Audio Player */}
      <AudioPlayer
        book={{
          id: book.id,
          title: book.title,
          author: book.author,
          coverUrl: book.coverUrl,
          chapters: book.chapters,
        }}
        initialPositionSec={playerState?.positionSec ?? 0}
        initialChapterId={playerState?.chapterId ?? null}
        initialBookmarks={bookmarksRaw.map((b) => ({
          ...b,
          createdAt: b.createdAt.toISOString(),
        }))}
        brandColor={brandColor}
      />
    </div>
  );
}
