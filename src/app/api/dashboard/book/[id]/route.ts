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

  // Kitabın şirketin paketinde olduğunu doğrula
  const company = await prisma.company.findUnique({
    where: { id: session.companyId },
    select: { packageId: true, isActive: true },
  });

  if (!company?.isActive || !company.packageId) {
    return NextResponse.json({ error: "Erişim yok." }, { status: 403 });
  }

  const packageBook = await prisma.packageBook.findUnique({
    where: { packageId_bookId: { packageId: company.packageId, bookId: id } },
  });

  if (!packageBook) {
    return NextResponse.json({ error: "Bu kitap paketinizde yok." }, { status: 403 });
  }

  const [book, playerState] = await Promise.all([
    prisma.book.findUnique({
      where: { id },
      include: {
        chapters: { orderBy: { order: "asc" } },
        category: { select: { name: true } },
      },
    }),
    prisma.playerState.findUnique({
      where: { userId_bookId: { userId: session.id, bookId: id } },
    }),
  ]);

  if (!book) return NextResponse.json({ error: "Bulunamadı." }, { status: 404 });

  let isFavorite = false;
  try {
    const fav = await (prisma as any).userFavorite.findUnique({
      where: { userId_bookId: { userId: session.id, bookId: id } },
    });
    isFavorite = !!fav;
  } catch {}

  const chapters = book.chapters.map((ch) => ({ ...ch, title: `Bölüm ${ch.order}` }));

  return NextResponse.json({ book: { ...book, chapters, isFavorite }, playerState });
}
