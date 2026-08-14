export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  const bookId = req.nextUrl.searchParams.get("bookId");
  if (!bookId) return NextResponse.json({ error: "bookId gerekli." }, { status: 400 });

  const bookmarks = await prisma.bookmark.findMany({
    where: { userId: session.id, bookId },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ bookmarks });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  const { bookId, chapterId, positionSec, note } = await req.json();

  const bookmark = await prisma.bookmark.create({
    data: {
      userId: session.id,
      bookId,
      chapterId: chapterId ?? null,
      positionSec: Math.floor(positionSec),
      note: note ?? null,
    },
  });

  return NextResponse.json({ bookmark });
}
