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

  const { bookId, chapterId, positionSec, note } = await req.json();

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
