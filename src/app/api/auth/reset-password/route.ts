export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  resetPasswordSchema,
  hashToken,
  hashPassword,
  isCommonPassword,
} from "@/lib/password";

function getIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = resetPasswordSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Geçersiz istek.";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const { token, password } = parsed.data;
    const ip = getIp(req);

    const tokenHash = hashToken(token);
    const record = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: { select: { id: true, email: true, name: true, company: { select: { name: true } } } } },
    });

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "Bu bağlantı geçersiz veya süresi dolmuş." },
        { status: 400 },
      );
    }

    if (isCommonPassword(password, record.user.company?.name)) {
      return NextResponse.json(
        { error: "Bu şifre çok yaygın. Lütfen daha güvenli bir şifre seçin." },
        { status: 400 },
      );
    }

    const passwordHash = await hashPassword(password);
    const now = new Date();

    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        data: { password: passwordHash, passwordChangedAt: now },
      }),
      prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: now },
      }),
      prisma.passwordAuditLog.create({
        data: { userId: record.userId, event: "RESET_COMPLETE", ipAddress: ip },
      }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[reset-password]", err);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
}
