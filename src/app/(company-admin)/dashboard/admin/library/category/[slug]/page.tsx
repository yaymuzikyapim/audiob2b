export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import BookCard, { BookCardItem } from "@/components/library/BookCard";
import LibrarySearch from "@/components/library/LibrarySearch";
import { categoryToSlug } from "@/lib/category-slugs";

const PER_PAGE = 48;

async function AdminCategoryContent({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.company?.id) redirect("/dashboard/admin");

  const { slug } = await params;
  const { q: rawQ, page: rawPage } = await searchParams;

  const q = rawQ?.trim() ?? "";
  const page = Math.max(1, parseInt(rawPage ?? "1", 10) || 1);

  const company = await prisma.company.findUnique({
    where: { id: user.company.id },
    select: {
      brandColor: true,
      package: { select: { id: true } },
    },
  });

  const pkgId = company?.package?.id;
  if (!pkgId) redirect("/dashboard/admin/library");

  // Slug'a karşılık gelen kategori adını DB'den bul (sabit eşleme yok)
  const pkgCategories = await prisma.category.findMany({
    where: { books: { some: { packages: { some: { packageId: pkgId } } } } },
    select: { name: true },
  });
  const catName = pkgCategories.find((c) => categoryToSlug(c.name) === slug)?.name;
  if (!catName) notFound();

  const color = company?.brandColor ?? "#2563eb";

  const whereBook = {
    isActive: true,
    chapters: { some: {} },
    category: { name: catName },
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" as const } },
            { author: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [totalCount, pkgBooks] = await Promise.all([
    prisma.packageBook.count({ where: { packageId: pkgId, book: whereBook } }),
    prisma.packageBook.findMany({
      where: { packageId: pkgId, book: whereBook },
      select: {
        book: {
          select: {
            id: true, title: true, author: true, narrator: true,
            duration: true, coverUrl: true,
            chapters: { select: { id: true }, take: 1 },
            seriesOrder: true,
          },
        },
      },
      orderBy: [{ book: { seriesOrder: "asc" } }, { book: { title: "asc" } }],
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
  ]);

  const bookIds = pkgBooks.map((pb) => pb.book.id);
  const listenerRows = bookIds.length > 0
    ? await prisma.playHistory.findMany({
        where: { bookId: { in: bookIds }, clientVersion: 2 },
        select: { bookId: true, userId: true },
        distinct: ["bookId", "userId"],
      })
    : [];
  const listenerMap = new Map<string, number>();
  for (const r of listenerRows) {
    listenerMap.set(r.bookId, (listenerMap.get(r.bookId) ?? 0) + 1);
  }

  const totalPages = Math.ceil(totalCount / PER_PAGE);

  const books: BookCardItem[] = pkgBooks.map((pb) => {
    const b = pb.book;
    return {
      id: b.id,
      title: b.title,
      author: b.author,
      narrator: b.narrator,
      duration: b.duration,
      coverUrl: b.coverUrl,
      hasAudio: b.chapters.length > 0,
      progressPct: 0,
      listenerCount: listenerMap.get(b.id) ?? 0,
    };
  });

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/dashboard/admin/library"
          className="inline-flex items-center gap-1 text-gray-400 text-sm hover:text-white transition-colors mb-3"
        >
          <ChevronLeft className="w-4 h-4" />
          Kütüphane
        </Link>
        <h1 className="text-2xl font-bold text-white">{catName}</h1>
        <p className="text-gray-400 mt-1 text-sm">{totalCount} kitap</p>
      </div>

      <LibrarySearch defaultValue={q} />

      {books.length === 0 ? (
        <p className="text-gray-500 text-sm">
          {q ? `"${q}" için kitap bulunamadı.` : "Bu kategoride kitap bulunmuyor."}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3">
            {books.map((book) => (
              <BookCard key={book.id} book={book} color={color} showListeners />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-8">
              {page > 1 && (
                <Link
                  href={`?${new URLSearchParams({ ...(q ? { q } : {}), page: String(page - 1) })}`}
                  className="px-4 py-2 text-sm bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors"
                >
                  ← Önceki
                </Link>
              )}
              <span className="px-4 py-2 text-sm text-gray-400">
                {page} / {totalPages}
              </span>
              {page < totalPages && (
                <Link
                  href={`?${new URLSearchParams({ ...(q ? { q } : {}), page: String(page + 1) })}`}
                  className="px-4 py-2 text-sm bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors"
                >
                  Sonraki →
                </Link>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function AdminCategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  return (
    <Suspense fallback={<div className="text-gray-400 text-sm p-6">Yükleniyor…</div>}>
      <AdminCategoryContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}
