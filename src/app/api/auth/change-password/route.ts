export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-guard";
import {
  changePasswordSchema,
  hashPassword,
  verifyPassword,
  isCommonPassword,
} from "@/lib/password";
import { sendPasswordChangedEmail } from "@/lib/emails/password-changed";

function getIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const parsed = changePasswordSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Geçersiz istek.";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const { currentPassword, newPassword } = parsed.data;
    const ip = getIp(req);

    const user = await prisma.user.findUnique({
      where: { id: auth.user.id },
      select: { id: true, email: true, name: true, password: true, company: { select: { name: true } } },
    });

    if (!user?.password) {
      return NextResponse.json({ error: "Bu hesabın şifresi yok." }, { status: 400 });
    }

    const valid = await verifyPassword(currentPassword, user.password);
    if (!valid) {
      return NextResponse.json({ error: "Mevcut şifre hatalı." }, { status: 400 });
    }

    if (isCommonPassword(newPassword, user.company?.name)) {
      return NextResponse.json(
        { error: "Bu şifre çok yaygın. Lütfen daha güvenli bir şifre seçin." },
        { status: 400 },
      );
    }

    const passwordHash = await hashPassword(newPassword);
    const now = new Date();

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { password: passwordHash, passwordChangedAt: now },
      }),
      prisma.passwordAuditLog.create({
        data: { userId: user.id, event: "CHANGE", ipAddress: ip },
      }),
    ]);

    // Bildirim e-postası — hata fırlatsa bile yanıt başarılı
    sendPasswordChangedEmail({ to: user.email, name: user.name, ipAddress: ip }).catch(
      (e) => console.error("[change-password] e-posta gönderilemedi:", e),
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[change-password]", err);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
}
