export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-guard";

export async function GET(req: NextRequest) {
  const auth = await requireUser({ roles: ["COMPANY_ADMIN", "EMPLOYEE"] });
  if (!auth.ok) return auth.response;
  const { user } = auth;

  const bookId = req.nextUrl.searchParams.get("bookId");
  if (!bookId) return NextResponse.json({ error: "bookId gerekli." }, { status: 400 });

  const bookmarks = await prisma.bookmark.findMany({
    where: { userId: user.id, bookId },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ bookmarks });
}

export async function POST(req: NextRequest) {
  const auth = await requireUser({ roles: ["COMPANY_ADMIN", "EMPLOYEE"] });
  if (!auth.ok) return auth.response;
  const { user } = auth;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  const { bookId, chapterId, positionSec, note } = body as {
    bookId?: string; chapterId?: string; positionSec?: number; note?: string;
  };

  if (!bookId || positionSec === undefined) {
    return NextResponse.json({ error: "bookId ve positionSec zorunlu." }, { status: 400 });
  }

  const book = await prisma.book.findUnique({ where: { id: bookId }, select: { id: true } });
  if (!book) return NextResponse.json({ error: "BOOK_NOT_FOUND" }, { status: 404 });

  if (chapterId) {
    const chapter = await prisma.chapter.findFirst({
      where: { id: chapterId, bookId },
      select: { id: true },
    });
    if (!chapter) return NextResponse.json({ error: "CHAPTER_NOT_FOUND" }, { status: 404 });
  }

  const bookmark = await prisma.bookmark.create({
    data: {
      userId: user.id,
      bookId,
      chapterId: chapterId ?? null,
      positionSec: Math.floor(positionSec),
      note: note ?? null,
    },
  });

  return NextResponse.json({ bookmark });
}
