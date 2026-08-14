import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import ChapterUploader from "@/components/admin/ChapterUploader";
import CoverUploader from "@/components/admin/CoverUploader";
import EditableDescription from "@/components/admin/EditableDescription";
import EditableField from "@/components/admin/EditableField";
import EditableCategoryField from "@/components/admin/EditableCategoryField";

function formatDuration(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}s ${m}dk ${s}sn`;
  return `${m}dk ${s}sn`;
}

export default async function BookDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [book, categories] = await Promise.all([
    prisma.book.findUnique({
      where: { id },
      include: {
        category: true,
        chapters: { orderBy: { order: "asc" } },
        packages: { include: { package: { select: { id: true, name: true } } } },
      },
    }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!book) notFound();

  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/admin/books" className="hover:text-white transition-colors">Kitaplar</Link>
        <span>/</span>
        <span className="text-white">{book.title}</span>
      </div>

      <div className="flex gap-6 mb-8">
        <CoverUploader bookId={book.id} currentCoverUrl={book.coverUrl} />
        <div className="flex-1">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">{book.title}</h1>
              <EditableField bookId={book.id} field="author" label="Yazan:" initial={book.author} placeholder="Yazar adı" />
              <EditableField bookId={book.id} field="narrator" label="Seslendiren:" initial={book.narrator} placeholder="Seslendiren adı" />
            </div>
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${book.isActive ? "bg-emerald-400/10 text-emerald-400" : "bg-red-400/10 text-red-400"}`}>
              {book.isActive ? "Aktif" : "Pasif"}
            </span>
          </div>
          <EditableCategoryField
            bookId={book.id}
            initialCategoryId={book.categoryId}
            initialCategoryName={book.category?.name ?? null}
            categories={categories}
          />
          <EditableDescription bookId={book.id} initial={book.description} />
          <div className="flex gap-4 mt-4 text-sm text-gray-500">
            <span>{formatDuration(book.duration)}</span>
            {book.isbn && <span>· ISBN: {book.isbn}</span>}
          </div>
        </div>
      </div>

      {/* Packages */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl mb-6">
        <div className="px-6 py-4 border-b border-gray-800">
          <h2 className="text-white font-semibold">Dahil Olduğu Paketler ({book.packages.length})</h2>
        </div>
        <div className="divide-y divide-gray-800">
          {book.packages.length === 0 && (
            <div className="px-6 py-6 text-center text-gray-500 text-sm">Bu kitap henüz hiçbir pakete eklenmemiş.</div>
          )}
          {book.packages.map((pb) => (
            <Link key={pb.package.id} href={`/admin/packages/${pb.package.id}`}
              className="flex items-center justify-between px-6 py-4 hover:bg-gray-800/50 transition-colors">
              <span className="text-white text-sm font-medium">{pb.package.name}</span>
              <span className="text-gray-500 text-xs">Pakete git →</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Chapters */}
      <ChapterUploader bookId={book.id} chapters={book.chapters} />
    </div>
  );
}
