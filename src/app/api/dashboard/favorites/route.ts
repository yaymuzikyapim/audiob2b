export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-guard";

export async function GET() {
  const auth = await requireUser({ roles: ["COMPANY_ADMIN", "EMPLOYEE"] });
  if (!auth.ok) return auth.response;
  const { user } = auth;

  const favorites = await prisma.userFavorite.findMany({
    where: { userId: user.id },
    select: { bookId: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ favorites });
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

  const { bookId } = body as { bookId?: string };
  if (!bookId) return NextResponse.json({ error: "bookId gerekli." }, { status: 400 });

  const book = await prisma.book.findUnique({ where: { id: bookId }, select: { id: true } });
  if (!book) return NextResponse.json({ error: "BOOK_NOT_FOUND" }, { status: 404 });

  const favorite = await prisma.userFavorite.upsert({
    where: { userId_bookId: { userId: user.id, bookId } },
    create: { userId: user.id, bookId },
    update: {},
  });

  return NextResponse.json({ favorite });
}
