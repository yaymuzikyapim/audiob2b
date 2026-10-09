export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import BookRow from "@/components/library/BookRow";
import BookCard, { BookCardItem } from "@/components/library/BookCard";
import LibrarySearch from "@/components/library/LibrarySearch";
import { CATEGORY_ORDER, CATEGORY_LAST, SHELF_LIMIT, categoryToSlug } from "@/lib/category-slugs";

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

async function AdminLibraryContent({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "COMPANY_ADMIN") redirect("/dashboard");
  if (!user.company?.id) redirect("/dashboard/admin");

  const company = await prisma.company.findUnique({
    where: { id: user.company.id },
    select: {
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

  // Listener counts — distinct userId per bookId from PlayHistory (clientVersion=2)
  const listenerRows = await prisma.playHistory.findMany({
    where: { bookId: { in: bookIds }, clientVersion: 2 },
    select: { bookId: true, userId: true },
    distinct: ["bookId", "userId"],
  });
  const listenerMap = new Map<string, number>();
  for (const r of listenerRows) {
    listenerMap.set(r.bookId, (listenerMap.get(r.bookId) ?? 0) + 1);
  }

  const toCard = (b: RawBook): BookCardItem => ({
    id: b.id,
    title: b.title,
    author: b.author,
    narrator: b.narrator,
    duration: b.duration,
    coverUrl: b.coverUrl,
    hasAudio: b.chapters.length > 0,
    progressPct: 0,
    listenerCount: listenerMap.get(b.id) ?? 0,
  });

  const { q: rawQ } = await searchParams;
  const q = rawQ?.trim() ?? "";

  // ── Search mode ──────────────────────────────────────────────────────────────
  if (q) {
    const ql = q.toLocaleLowerCase("tr-TR");
    const matches = rawBooks
      .filter((b) => b.title.toLocaleLowerCase("tr-TR").includes(ql) || b.author.toLocaleLowerCase("tr-TR").includes(ql))
      .map(toCard);

    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Kütüphane</h1>
        </div>
        <LibrarySearch defaultValue={q} />
        <p className="text-gray-400 text-sm mb-4">&ldquo;{q}&rdquo; için {matches.length} sonuç</p>
        {matches.length > 0 ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3">
            {matches.map((book) => (
              <BookCard key={book.id} book={book} color={color} showListeners />
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-sm">Kitap bulunamadı.</p>
        )}
      </div>
    );
  }

  // ── Category rows ────────────────────────────────────────────────────────────
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
            href={`/dashboard/admin/library/category/${slug}`}
            showListeners
          />
        );
      })}
    </div>
  );
}

export default function AdminLibraryPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  return (
    <Suspense fallback={<div className="text-gray-400 text-sm p-6">Yükleniyor…</div>}>
      <AdminLibraryContent searchParams={searchParams} />
    </Suspense>
  );
}
