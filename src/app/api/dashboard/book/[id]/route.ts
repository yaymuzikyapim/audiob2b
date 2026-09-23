export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getActiveAccess } from "@/lib/access";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role === "SUPER_ADMIN") {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }

  const { id } = await params;

  // Erişim kontrolü + kitap sorguları — tek round-trip
  const [access, book, playerState, favorite] = await Promise.all([
    getActiveAccess(session.id),
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

  if (!access.ok) return access.response;
  const { packageId } = access.data;

  if (!book) return NextResponse.json({ error: "Bulunamadı." }, { status: 404 });

  const inPackage = book.packageBooks.some((pb) => pb.packageId === packageId);
  if (!inPackage) {
    return NextResponse.json({ error: "Bu kitap paketinizde yok." }, { status: 403 });
  }

  const isFavorite = !!favorite;
  const chapters = book.chapters.map((ch) => ({ ...ch, title: `Bölüm ${ch.order}` }));
  const { packageBooks: _pb, ...bookRest } = book;

  return NextResponse.json({ book: { ...bookRest, chapters, isFavorite }, playerState });
}
