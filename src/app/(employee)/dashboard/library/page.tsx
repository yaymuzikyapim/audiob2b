export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import BookRow from "@/components/library/BookRow";
import BookCard, { BookCardItem } from "@/components/library/BookCard";
import LibrarySearch from "@/components/library/LibrarySearch";
import { CATEGORY_ORDER, CATEGORY_LAST, SHELF_LIMIT, categoryToSlug } from "@/lib/category-slugs";
import { countCompletedBooks, MetricRow } from "@/lib/metrics";

type RawBook = {
  id: string;
  title: string;
  author: string;
  narrator: string | null;
  duration: number;
  coverUrl: string | null;
  category: { name: string } | null;
  chapters: { id: string }[];
};

async function LibraryContent({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
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
            where: { book: { isActive: true, chapters: { some: {} } } },
            select: {
              book: {
                select: {
                  id: true, title: true, author: true, narrator: true,
                  duration: true, coverUrl: true,
                  category: { select: { name: true } },
                  chapters: { select: { id: true }, take: 1 },
                },
              },
            },
          },
        },
      },
    },
  });

  const color = company?.brandColor ?? "#2563eb";
  const rawBooks = (company?.package?.books.map((pb) => pb.book).filter(Boolean) ?? []) as RawBook[];
  const bookIds = rawBooks.map((b) => b.id);

  const playerStates = await prisma.playerState.findMany({
    where: { userId: session.id, bookId: { in: bookIds } },
    select: { bookId: true, positionSec: true, updatedAt: true },
  });
  const stateMap = new Map(playerStates.map((ps) => [ps.bookId, ps]));

  const toCard = (b: RawBook): BookCardItem => {
    const ps = stateMap.get(b.id);
    return {
      id: b.id,
      title: b.title,
      author: b.author,
      narrator: b.narrator,
      duration: b.duration,
      coverUrl: b.coverUrl,
      hasAudio: b.chapters.length > 0,
      progressPct: ps ? Math.min(100, Math.round((ps.positionSec / b.duration) * 100)) : 0,
    };
  };

  const { q: rawQ } = await searchParams;
  const q = rawQ?.trim() ?? "";

  // ── Search mode ──────────────────────────────────────────────────────────────
  if (q) {
    const ql = q.toLowerCase();
    const matches = rawBooks
      .filter((b) => b.title.toLowerCase().includes(ql) || b.author.toLowerCase().includes(ql))
      .map(toCard);

    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Kütüphane</h1>
        </div>
        <LibrarySearch defaultValue={q} />
        <p className="text-gray-400 text-sm mb-4">
          &ldquo;{q}&rdquo; için {matches.length} sonuç
        </p>
        {matches.length > 0 ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3">
            {matches.map((book) => (
              <BookCard key={book.id} book={book} color={color} />
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-sm">Kitap bulunamadı.</p>
        )}
      </div>
    );
  }

  // ── "Dinlemeye devam et" ─────────────────────────────────────────────────────
  const inProgressStates = playerStates
    .filter((ps) => ps.positionSec > 0)
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .slice(0, 20);

  let continueBooks: BookCardItem[] = [];

  if (inProgressStates.length > 0) {
    const inProgressBookIds = inProgressStates.map((ps) => ps.bookId);

    const [booksWithChapters, playHistories] = await Promise.all([
      prisma.book.findMany({
        where: { id: { in: inProgressBookIds } },
        select: { id: true, chapters: { select: { id: true } } },
      }),
      prisma.playHistory.findMany({
        where: {
          userId: session.id,
          bookId: { in: inProgressBookIds },
          clientVersion: 2,
          chapterId: { not: null },
        },
        select: { bookId: true, chapterId: true, completedPct: true, playedAt: true },
      }),
    ]);

    const chaptersByBook = new Map(
      booksWithChapters.map((b) => [b.id, new Set(b.chapters.map((c) => c.id))])
    );

    const metricRows: MetricRow[] = playHistories.map((ph) => ({
      userId: session.id,
      bookId: ph.bookId,
      chapterId: ph.chapterId,
      listenedSec: 0,
      completedPct: ph.completedPct,
      playedAt: ph.playedAt,
    }));

    const epoch = new Date(0);
    const far = new Date("2099-01-01");
    const completedBookIds = new Set<string>();

    for (const bookId of inProgressBookIds) {
      const bookRows = metricRows.filter((r) => r.bookId === bookId);
      const chapters = new Map([[bookId, chaptersByBook.get(bookId) ?? new Set<string>()]]);
      if (countCompletedBooks(bookRows, epoch, far, chapters) > 0) {
        completedBookIds.add(bookId);
      }
    }

    const bookMap = new Map(rawBooks.map((b) => [b.id, b]));
    continueBooks = inProgressStates
      .filter((ps) => !completedBookIds.has(ps.bookId))
      .slice(0, SHELF_LIMIT)
      .map((ps) => {
        const b = bookMap.get(ps.bookId);
        return b ? toCard(b) : null;
      })
      .filter((b): b is BookCardItem => b !== null);
  }

  // ── Group by category ────────────────────────────────────────────────────────
  const byCategory = new Map<string, RawBook[]>();
  for (const b of rawBooks) {
    const cat = b.category?.name ?? "Diğer";
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(b);
  }

  const orderedCats = [
    ...CATEGORY_ORDER.filter((k) => byCategory.has(k)),
    ...[...byCategory.keys()].filter((k) => !CATEGORY_ORDER.includes(k) && !CATEGORY_LAST.includes(k)).sort((a, b) => a.localeCompare(b, "tr-TR")),
    ...CATEGORY_LAST.filter((k) => byCategory.has(k)),
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Kütüphane</h1>
        <p className="text-gray-400 mt-1 text-sm">
          {company?.package?.name ?? "Demo"} · {rawBooks.length} kitap
        </p>
      </div>

      <LibrarySearch />

      {continueBooks.length > 0 && (
        <BookRow title="Dinlemeye devam et" books={continueBooks} color={color} />
      )}

      {orderedCats.map((cat) => {
        const catBooks = byCategory.get(cat)!;
        const shelfBooks = catBooks.slice(0, SHELF_LIMIT).map(toCard);
        const slug = categoryToSlug(cat);
        return (
          <BookRow
            key={cat}
            title={cat}
            books={shelfBooks}
            color={color}
            totalCount={catBooks.length}
            href={`/dashboard/library/category/${slug}`}
          />
        );
      })}
    </div>
  );
}

export default function LibraryPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  return (
    <Suspense fallback={<div className="text-gray-400 text-sm p-6">Yükleniyor…</div>}>
      <LibraryContent searchParams={searchParams} />
    </Suspense>
  );
}
