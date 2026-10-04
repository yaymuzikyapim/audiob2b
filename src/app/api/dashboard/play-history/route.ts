export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

import { requireUser } from "@/lib/auth-guard";

export async function POST(req: NextRequest) {
  const auth = await requireUser({ roles: ["COMPANY_ADMIN", "EMPLOYEE"] });
  if (!auth.ok) return auth.response;
  const { user } = auth;

  const { bookId, listenedSec, contentSec, completedPct, listenedAt, v, clientId } = await req.json();
  if (!bookId || !listenedSec || listenedSec < 5) {
    return NextResponse.json({ ok: true });
  }
  // 2 dk'da bir gönderildiği için tek çağrıda 1 saati aşanlar güvensiz — sessizce reddet
  if (listenedSec > 3600) {
    return NextResponse.json({ ok: true });
  }

  // İstemci zaman damgası: son 7 gün içinde ve en fazla 5 dk ileride ise playedAt olarak kullan
  let playedAt: Date | undefined;
  if (listenedAt) {
    const t = new Date(listenedAt).getTime();
    const now = Date.now();
    if (!isNaN(t) && t <= now + 5 * 60_000 && t >= now - 7 * 86_400_000) {
      playedAt = new Date(t);
    }
  }

  const data = {
    userId: user.id,
    bookId,
    listenedSec: Math.floor(listenedSec),
    contentSec: Math.floor(contentSec ?? 0),
    completedPct: Math.min(100, Math.max(0, completedPct ?? 0)),
    clientVersion: v === 2 ? 2 : 1,
    ...(playedAt && { playedAt }),
  };

  if (clientId && typeof clientId === "string" && clientId.length > 0) {
    await prisma.playHistory.upsert({
      where: { clientId },
      create: { ...data, clientId },
      update: {},  // zaten varsa dokunma
    });
  } else {
    await prisma.playHistory.create({ data });
  }

  return NextResponse.json({ ok: true });
}
