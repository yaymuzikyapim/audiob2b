export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role === "SUPER_ADMIN") {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }

  const { id } = await params;

  // Kullanıcı + şirket + kitap bilgileri — tek round-trip
  const [user, book, playerState, favorite] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.id },
      select: {
        isActive: true,
        company: {
          select: { id: true, packageId: true, isActive: true, endDate: true },
        },
      },
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

  if (!user?.isActive) {
    return NextResponse.json({ error: "Hesap pasif." }, { status: 403 });
  }

  const company = user.company;
  if (!company?.isActive) {
    return NextResponse.json({ error: "Erişim yok." }, { status: 403 });
  }

  if (company.endDate && company.endDate < new Date()) {
    return NextResponse.json({ error: "Lisans süresi doldu." }, { status: 403 });
  }

  if (!company.packageId) {
    return NextResponse.json({ error: "Aktif paket yok." }, { status: 403 });
  }

  if (!book) return NextResponse.json({ error: "Bulunamadı." }, { status: 404 });

  const inPackage = book.packageBooks.some((pb) => pb.packageId === company.packageId);
  if (!inPackage) {
    return NextResponse.json({ error: "Bu kitap paketinizde yok." }, { status: 403 });
  }

  const isFavorite = !!favorite;
  const chapters = book.chapters.map((ch) => ({ ...ch, title: `Bölüm ${ch.order}` }));
  const { packageBooks: _pb, ...bookRest } = book;

  return NextResponse.json({ book: { ...bookRest, chapters, isFavorite }, playerState });
}
