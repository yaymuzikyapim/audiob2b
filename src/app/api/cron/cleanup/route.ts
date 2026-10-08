export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cleanupRateLimits } from "@/lib/rate-limit";

/**
 * Vercel Cron Job: günlük saat 03:00 UTC.
 * vercel.json'da tanımlanmış; CRON_SECRET ile korunur.
 */
export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || secret !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }

  // RateLimit: 2 saatten eski pencereler
  const rateLimitDeleted = await cleanupRateLimits();

  // DemoRequest: 2 yıldan eski kayıtlar
  const demoRequestsDeleted = await prisma.demoRequest.deleteMany({
    where: { createdAt: { lt: new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000) } },
  });

  // PasswordAuditLog: 1 yıldan eski ipAddress/userAgent temizle (satırı silme, sadece kişisel veri)
  const auditAnonymized = await prisma.passwordAuditLog.updateMany({
    where: {
      createdAt: { lt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) },
      OR: [{ ipAddress: { not: null } }, { userAgent: { not: null } }],
    },
    data: { ipAddress: null, userAgent: null },
  });

  // PasswordResetToken: süresi dolmuş ve kullanılmış tokenler
  const tokensDeleted = await prisma.passwordResetToken.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: new Date() } },
        { usedAt: { not: null } },
      ],
    },
  });

  return NextResponse.json({
    ok: true,
    rateLimitDeleted,
    auditAnonymized: auditAnonymized.count,
    tokensDeleted: tokensDeleted.count,
    demoRequestsDeleted: demoRequestsDeleted.count,
  });
}
