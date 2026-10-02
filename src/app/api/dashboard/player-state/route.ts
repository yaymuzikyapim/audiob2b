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

  const body = await req.json();
  const { bookId, chapterId, positionSec } = body;
  // clientSavedAt: mobil tarafından gönderilen gerçek dinleme zamanı (ms).
  // Yoksa (eski mobil sürüm) şu anı kullan → clientSavedAt her zaman dolu.
  const clientSavedAtMs: number = typeof body.clientSavedAt === "number"
    ? Math.min(body.clientSavedAt, Date.now())
    : Date.now();

  if (!bookId || positionSec === undefined) {
    return NextResponse.json({ error: "bookId ve positionSec zorunlu." }, { status: 400 });
  }

  // clientSavedAt gönderildiyse: daha yeni bir kayıt varsa atla (çakışma koruması)
  if (typeof body.clientSavedAt === "number") {
    const existing = await prisma.playerState.findUnique({
      where: { userId_bookId: { userId: session.id, bookId } },
      select: { clientSavedAt: true, updatedAt: true },
    });
    if (existing) {
      const ref = existing.clientSavedAt?.getTime() ?? existing.updatedAt.getTime();
      if (ref > body.clientSavedAt) {
        return NextResponse.json({ skipped: true });
      }
    }
  }

  const clientSavedAt = new Date(clientSavedAtMs);
  const state = await prisma.playerState.upsert({
    where: { userId_bookId: { userId: session.id, bookId } },
    update: { chapterId: chapterId ?? null, positionSec, clientSavedAt },
    create: { userId: session.id, bookId, chapterId: chapterId ?? null, positionSec, clientSavedAt },
  });

  return NextResponse.json(state);
}
