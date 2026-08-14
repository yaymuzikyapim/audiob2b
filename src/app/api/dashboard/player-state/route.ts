export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role === "SUPER_ADMIN") {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }

  const bookId = req.nextUrl.searchParams.get("bookId");
  if (!bookId) return NextResponse.json({ error: "bookId zorunlu." }, { status: 400 });

  const state = await prisma.playerState.findUnique({
    where: { userId_bookId: { userId: session.id, bookId } },
  });

  return NextResponse.json({ state: state ?? null });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role === "SUPER_ADMIN") {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }

  const { bookId, chapterId, positionSec } = await req.json();
  if (!bookId || positionSec === undefined) {
    return NextResponse.json({ error: "bookId ve positionSec zorunlu." }, { status: 400 });
  }

  const state = await prisma.playerState.upsert({
    where: { userId_bookId: { userId: session.id, bookId } },
    update: { chapterId: chapterId ?? null, positionSec },
    create: { userId: session.id, bookId, chapterId: chapterId ?? null, positionSec },
  });

  return NextResponse.json(state);
}
