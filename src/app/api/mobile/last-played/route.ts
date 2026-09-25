export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getActiveAccess } from "@/lib/access";

export async function GET() {
  const session = await getSession();
  if (!session || session.role === "SUPER_ADMIN") {
    return NextResponse.json({ lastPlayed: null });
  }

  const access = await getActiveAccess(session.id);
  if (!access.ok) return NextResponse.json({ lastPlayed: null });

  const { packageId } = access.data;

  const state = await prisma.playerState.findFirst({
    where: { userId: session.id },
    orderBy: { updatedAt: "desc" },
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
    where: { id: access.data.companyId },
    select: { brandColor: true },
  });

  return NextResponse.json({
    lastPlayed: {
      bookId: state.book.id,
      bookTitle: state.book.title,
      coverUrl: state.book.coverUrl ?? null,
      totalDuration: state.book.duration,
      chapterId: state.chapterId ?? null,
      positionSec: state.positionSec,
      chapters: state.book.chapters,
      brandColor: company?.brandColor ?? null,
    },
  });
}
