export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  const { bookId, listenedSec, completedPct } = await req.json();
  if (!bookId || !listenedSec || listenedSec < 5) {
    return NextResponse.json({ ok: true });
  }

  await prisma.playHistory.create({
    data: {
      userId: session.id,
      bookId,
      listenedSec: Math.floor(listenedSec),
      completedPct: Math.min(100, Math.max(0, completedPct ?? 0)),
    },
  });

  return NextResponse.json({ ok: true });
}
