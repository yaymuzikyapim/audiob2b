export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const auth = await requireUser({ roles: ["COMPANY_ADMIN", "EMPLOYEE"] });
  if (!auth.ok) return auth.response;
  const { user } = auth;
  const packageId = user.company!.packageId!;

  const state = await prisma.playerState.findFirst({
    where: { userId: user.id },
    // clientSavedAt gerçek dinleme zamanını taşır; NULL ise updatedAt'e dön
    orderBy: [{ clientSavedAt: { sort: "desc", nulls: "last" } }, { updatedAt: "desc" }],
    include: {
      book: {
        select: {
          id: true,
          title: true,
          coverUrl: true,
          duration: true,
          chapters: {
            select: { id: true, title: true, order: true, duration: true, s3Key: true },
            orderBy: { order: "asc" },
          },
        },
      },
    },
  });

  if (!state) return NextResponse.json({ lastPlayed: null });

  // Kitap hâlâ kullanıcının paketinde mi? (many-to-many: PackageBook)
  const inPackage = await prisma.packageBook.findUnique({
    where: { packageId_bookId: { packageId, bookId: state.book.id } },
  });
  if (!inPackage) return NextResponse.json({ lastPlayed: null });

  const company = await prisma.company.findUnique({
    where: { id: user.companyId! },
    select: { brandColor: true },
  });

  return NextResponse.json(
    {
      lastPlayed: {
        bookId: state.book.id,
        bookTitle: state.book.title,
        coverUrl: state.book.coverUrl ?? null,
        totalDuration: state.book.duration,
        chapterId: state.chapterId ?? null,
        positionSec: state.positionSec,
        // Mobil karşılaştırma kodu updatedAt alanını okur; clientSavedAt gerçek zamanı taşır
        updatedAt: (state.clientSavedAt ?? state.updatedAt).toISOString(),
        chapters: state.book.chapters,
        brandColor: company?.brandColor ?? null,
      },
    },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
