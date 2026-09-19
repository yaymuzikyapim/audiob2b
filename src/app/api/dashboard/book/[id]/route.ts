export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role === "SUPER_ADMIN" || !session.companyId) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }

  const { id } = await params;

  // Tüm sorgular tek batch — 1 DB round-trip
  const [company, book, playerState, favorite] = await Promise.all([
    prisma.company.findUnique({
      where: { id: session.companyId },
      select: { packageId: true, isActive: true },
    }),
    prisma.book.findUnique({
      where: { id },
      include: {
        chapters: { orderBy: { order: "asc" } },
        category: { select: { name: true } },
        packageBooks: { select: { packageId: true } },
      },
    }),
    prisma.playerState.findUnique({
      where: { userId_bookId: { userId: session.id, bookId: id } },
    }),
    (prisma as any).userFavorite.findUnique({
      where: { userId_bookId: { userId: session.id, bookId: id } },
    }).catch(() => null),
  ]);

  if (!company?.isActive || !company.packageId) {
    return NextResponse.json({ error: "Erişim yok." }, { status: 403 });
  }

  if (!book) return NextResponse.json({ error: "Bulunamadı." }, { status: 404 });

  // Paket kontrolü — bellek içi, ek DB sorgusu yok
  const inPackage = book.packageBooks.some((pb) => pb.packageId === company.packageId);
  if (!inPackage) {
    return NextResponse.json({ error: "Bu kitap paketinizde yok." }, { status: 403 });
  }

  const isFavorite = !!favorite;
  const chapters = book.chapters.map((ch) => ({ ...ch, title: `Bölüm ${ch.order}` }));
  const { packageBooks: _pb, ...bookRest } = book;

  return NextResponse.json({ book: { ...bookRest, chapters, isFavorite }, playerState });
}
