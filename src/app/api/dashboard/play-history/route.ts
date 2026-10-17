export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-guard";
import { ValidationStatus, CompanyIdSource } from "@prisma/client";

// K6: kabul penceresi — kabul penceresi > K19 lease süresi (30 gün) olmalı
const ACCEPTANCE_WINDOW_DAYS = 45;
const ACCEPTANCE_WINDOW_MS = ACCEPTANCE_WINDOW_DAYS * 24 * 60 * 60 * 1000;

const SHORT_STRING_MAX = 128;

function shortString(v: unknown): string | undefined {
  if (typeof v !== "string" || v.length === 0) return undefined;
  return v.slice(0, SHORT_STRING_MAX);
}

async function incrementReject(
  reason: string,
  platform: string,
  clientVersion: number
): Promise<void> {
  const day = new Date();
  day.setUTCHours(0, 0, 0, 0);
  try {
    await prisma.playHistoryReject.upsert({
      where: { reason_day_platform_clientVersion: { reason, day, platform, clientVersion } },
      create: { reason, day, platform, clientVersion, count: 1 },
      update: { count: { increment: 1 } },
    });
  } catch {
    // sayaç hatası isteği bozmaz
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireUser({ roles: ["COMPANY_ADMIN", "EMPLOYEE"] });
  if (!auth.ok) return auth.response;
  const { user } = auth;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    await incrementReject("INVALID_FORMAT", "unknown", 0);
    return NextResponse.json({ ok: true });
  }

  const {
    bookId, chapterId, listenedSec, contentSec, completedPct,
    listenedAt, v, clientId,
    platform: rawPlatform, appVersion, buildNumber, runtimeVersion, updateId,
  } = body as Record<string, unknown>;

  const clientVersion = v === 2 ? 2 : 1;
  const platform = shortString(rawPlatform) ?? "unknown";

  // Temel format doğrulama
  if (!bookId || typeof bookId !== "string") {
    await incrementReject("INVALID_FORMAT", platform, clientVersion);
    return NextResponse.json({ ok: true });
  }
  if (typeof listenedSec !== "number" || listenedSec < 5) {
    return NextResponse.json({ ok: true });
  }
  if (listenedSec > 3600) {
    await incrementReject("DURATION_EXCEEDED", platform, clientVersion);
    return NextResponse.json({ ok: true });
  }

  const receivedAt = new Date();

  // playedAt: istemci listenedAt'i geçerliyse kullan; yoksa receivedAt
  let playedAt: Date = receivedAt;
  if (listenedAt != null) {
    const t = new Date(listenedAt as string).getTime();
    if (isNaN(t)) {
      await incrementReject("INVALID_FORMAT", platform, clientVersion);
      return NextResponse.json({ ok: true });
    }
    // Gelecek toleransı: en fazla 5 dk ileri
    if (t > receivedAt.getTime() + 5 * 60_000) {
      await incrementReject("FUTURE_TIMESTAMP", platform, clientVersion);
      return NextResponse.json({ ok: true });
    }
    playedAt = new Date(t);
  }

  // Sınıflandırma (K8): v1 → LEGACY_V1; v2∧contentSec=0 → INVALID_V2_NO_CONTENT;
  // kabul penceresi dışı → QUARANTINED_LATE; aksi → VALID
  let validationStatus: ValidationStatus;
  if (clientVersion === 1) {
    validationStatus = ValidationStatus.LEGACY_V1;
  } else if ((contentSec as number ?? 0) === 0) {
    validationStatus = ValidationStatus.INVALID_V2_NO_CONTENT;
  } else if (receivedAt.getTime() - playedAt.getTime() > ACCEPTANCE_WINDOW_MS) {
    validationStatus = ValidationStatus.QUARANTINED_LATE;
  } else {
    validationStatus = ValidationStatus.VALID;
  }

  // companyId: kullanıcının o anki şirketi (K4); şirketsizse NULL
  const companyId = user.companyId ?? null;
  const companyIdSource = companyId ? CompanyIdSource.SERVER_AT_EVENT : null;

  const data = {
    userId: user.id,
    bookId,
    ...(chapterId && typeof chapterId === "string" ? { chapterId } : {}),
    listenedSec: Math.floor(listenedSec),
    contentSec: Math.floor((contentSec as number | undefined) ?? 0),
    completedPct: Math.min(100, Math.max(0, (completedPct as number | undefined) ?? 0)),
    clientVersion,
    playedAt,
    receivedAt,
    companyId,
    ...(companyIdSource ? { companyIdSource } : {}),
    validationStatus,
    ...(shortString(appVersion) ? { appVersion: shortString(appVersion) } : {}),
    ...(shortString(buildNumber) ? { buildNumber: shortString(buildNumber) } : {}),
    ...(shortString(runtimeVersion) ? { runtimeVersion: shortString(runtimeVersion) } : {}),
    ...(shortString(updateId) ? { updateId: shortString(updateId) } : {}),
    platform: platform !== "unknown" ? platform : undefined,
  };

  if (clientId && typeof clientId === "string" && clientId.length > 0) {
    // clientId çakışması: mevcut farklı içerik → sayaç, dokunma
    const existing = await prisma.playHistory.findUnique({ where: { clientId } });
    if (existing) {
      if (existing.bookId !== bookId || existing.userId !== user.id) {
        await incrementReject("CLIENT_ID_CONFLICT", platform, clientVersion);
      }
      // aynı içerik → idempotent, sessiz
      return NextResponse.json({ ok: true });
    }
    await prisma.playHistory.create({ data: { ...data, clientId } });
  } else {
    await prisma.playHistory.create({ data });
  }

  return NextResponse.json({ ok: true });
}
