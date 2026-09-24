export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getActiveAccess } from "@/lib/access";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  const access = await getActiveAccess(session.id);
  if (!access.ok) return access.response;

  const { bookId, listenedSec, contentSec, completedPct, v } = await req.json();
  if (!bookId || !listenedSec || listenedSec < 5) {
    return NextResponse.json({ ok: true });
  }
  // 2 dk'da bir gönderildiği için tek çağrıda 1 saati aşanlar güvensiz — sessizce reddet
  if (listenedSec > 3600) {
    return NextResponse.json({ ok: true });
  }

  await prisma.playHistory.create({
    data: {
      userId: session.id,
      bookId,
      listenedSec: Math.floor(listenedSec),
      contentSec: Math.floor(contentSec ?? 0),
      completedPct: Math.min(100, Math.max(0, completedPct ?? 0)),
      clientVersion: v === 2 ? 2 : 1,
    },
  });

  return NextResponse.json({ ok: true });
}
