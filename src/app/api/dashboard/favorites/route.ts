export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  const favorites = await prisma.userFavorite.findMany({
    where: { userId: session.id },
    select: { bookId: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ favorites });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  const { bookId } = await req.json();
  if (!bookId) return NextResponse.json({ error: "bookId gerekli." }, { status: 400 });

  const favorite = await prisma.userFavorite.upsert({
    where: { userId_bookId: { userId: session.id, bookId } },
    create: { userId: session.id, bookId },
    update: {},
  });

  return NextResponse.json({ favorite });
}
