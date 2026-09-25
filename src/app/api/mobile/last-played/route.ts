export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session || session.role === "SUPER_ADMIN") {
    return NextResponse.json({ lastPlayed: null });
  }

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

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { company: { select: { brandColor: true } } },
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
      brandColor: user?.company?.brandColor ?? null,
    },
  });
}
