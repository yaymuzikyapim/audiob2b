export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-guard";

export async function GET(req: NextRequest) {
  const auth = await requireUser({ roles: ["COMPANY_ADMIN", "EMPLOYEE"] });
  if (!auth.ok) return auth.response;
  const { user } = auth;

  const bookId = req.nextUrl.searchParams.get("bookId");
  if (!bookId) return NextResponse.json({ error: "bookId zorunlu." }, { status: 400 });

  const state = await prisma.playerState.findUnique({
    where: { userId_bookId: { userId: user.id, bookId } },
  });

  return NextResponse.json({ state: state ?? null });
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

  const { bookId, chapterId, positionSec } = body as {
    bookId?: string; chapterId?: string; positionSec?: number;
  };

  if (!bookId || positionSec === undefined) {
    return NextResponse.json({ error: "bookId ve positionSec zorunlu." }, { status: 400 });
  }

  // Kitap var mı?
  const book = await prisma.book.findUnique({ where: { id: bookId }, select: { id: true } });
  if (!book) return NextResponse.json({ error: "BOOK_NOT_FOUND" }, { status: 404 });

  // Bölüm gönderildiyse bu kitaba ait mi?
  if (chapterId) {
    const chapter = await prisma.chapter.findFirst({
      where: { id: chapterId, bookId },
      select: { id: true },
    });
    if (!chapter) return NextResponse.json({ error: "CHAPTER_NOT_FOUND" }, { status: 404 });
  }

  // clientSavedAt: mobil tarafından gönderilen gerçek dinleme zamanı (ms).
  const clientSavedAtMs: number = typeof body.clientSavedAt === "number"
    ? Math.min(body.clientSavedAt as number, Date.now())
    : Date.now();

  // clientSavedAt gönderildiyse: daha yeni bir kayıt varsa atla (çakışma koruması)
  if (typeof body.clientSavedAt === "number") {
    const existing = await prisma.playerState.findUnique({
      where: { userId_bookId: { userId: user.id, bookId } },
      select: { clientSavedAt: true, updatedAt: true },
    });
    if (existing) {
      const ref = existing.clientSavedAt?.getTime() ?? existing.updatedAt.getTime();
      if (ref > (body.clientSavedAt as number)) {
        return NextResponse.json({ skipped: true });
      }
    }
  }

  const clientSavedAt = new Date(clientSavedAtMs);
  try {
    const state = await prisma.playerState.upsert({
      where: { userId_bookId: { userId: user.id, bookId } },
      update: { chapterId: chapterId ?? null, positionSec, clientSavedAt },
      create: { userId: user.id, bookId, chapterId: chapterId ?? null, positionSec, clientSavedAt },
    });
    return NextResponse.json(state);
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code;
    if (code === "P2003") return NextResponse.json({ error: "BOOK_NOT_FOUND" }, { status: 404 });
    throw e;
  }
}
