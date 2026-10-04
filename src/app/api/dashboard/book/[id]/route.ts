export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

import { requireUser } from "@/lib/auth-guard";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser({ roles: ["COMPANY_ADMIN", "EMPLOYEE"] });
  if (!auth.ok) return auth.response;
  const { user } = auth;
  const packageId = user.company!.packageId!;

  const { id } = await params;

  const [book, playerState, favorite] = await Promise.all([
    prisma.book.findUnique({
      where: { id },
      include: {
        chapters: { orderBy: { order: "asc" } },
        category: { select: { name: true } },
        packages: { select: { packageId: true } },
      },
    }),
    prisma.playerState.findUnique({
      where: { userId_bookId: { userId: user.id, bookId: id } },
    }),
    (prisma as any).userFavorite.findUnique({
      where: { userId_bookId: { userId: user.id, bookId: id } },
    }).catch(() => null),
  ]);

  if (!book) return NextResponse.json({ error: "Bulunamadı." }, { status: 404 });

  const inPackage = book.packages.some((pb) => pb.packageId === packageId);
  if (!inPackage) {
    return NextResponse.json({ error: "Bu kitap paketinizde yok." }, { status: 403 });
  }

  const isFavorite = !!favorite;
  const chapters = book.chapters.map((ch) => ({ ...ch, title: `Bölüm ${ch.order}` }));
  const { packages: _pb, ...bookRest } = book;

  // Mobil updatedAt karşılaştırması; clientSavedAt gerçek dinleme zamanını taşır
  const playerStateOut = playerState
    ? { ...playerState, updatedAt: (playerState.clientSavedAt ?? playerState.updatedAt).toISOString() }
    : null;

  return NextResponse.json(
    { book: { ...bookRest, chapters, isFavorite }, playerState: playerStateOut },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
