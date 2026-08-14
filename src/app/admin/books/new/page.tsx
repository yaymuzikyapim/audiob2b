import { prisma } from "@/lib/prisma";
import NewBookForm from "@/components/admin/NewBookForm";

export default async function NewBookPage() {
  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Yeni Kitap Ekle</h1>
        <p className="text-gray-400 mt-1 text-sm">Kütüphaneye yeni bir sesli kitap ekleyin.</p>
      </div>
      <NewBookForm categories={categories} />
    </div>
  );
}
