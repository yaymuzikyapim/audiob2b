export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

// POST: { targetName: string, targetSlug: string, sourceNames: string[] }
// sourceNames içindeki tüm kategorileri targetName altında birleştirir
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }

  const { targetName, targetSlug, sourceNames } = await req.json() as {
    targetName: string;
    targetSlug: string;
    sourceNames: string[];
  };

  if (!targetName || !targetSlug || !Array.isArray(sourceNames) || sourceNames.length === 0) {
    return NextResponse.json({ error: "Geçersiz veri." }, { status: 400 });
  }

  // Hedef kategoriyi bul ya da oluştur
  let target = await prisma.category.findFirst({ where: { name: targetName } });
  if (!target) {
    target = await prisma.category.create({ data: { name: targetName, slug: targetSlug } });
  }

  // Kaynak kategorileri bul (hedefin kendisi hariç)
  const sources = await prisma.category.findMany({
    where: { name: { in: sourceNames }, id: { not: target.id } },
  });

  if (sources.length === 0) {
    return NextResponse.json({ message: "Birleştirilecek kaynak kategori bulunamadı.", merged: 0 });
  }

  const sourceIds = sources.map((s) => s.id);

  // Kitapları hedef kategoriye taşı
  const updated = await prisma.book.updateMany({
    where: { categoryId: { in: sourceIds } },
    data: { categoryId: target.id },
  });

  // Boş kalan kaynak kategorileri sil
  await prisma.category.deleteMany({ where: { id: { in: sourceIds } } });

  return NextResponse.json({
    target: targetName,
    merged: sources.map((s) => s.name),
    booksUpdated: updated.count,
  });
}
