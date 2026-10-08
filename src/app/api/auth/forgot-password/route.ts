export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { forgotPasswordSchema, generateResetToken } from "@/lib/password";
import { getBaseUrl } from "@/lib/base-url";
import { RATE_LIMIT } from "@/lib/rate-limit";
import { sendPasswordResetEmail } from "@/lib/emails/reset-password";

function getIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = forgotPasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Geçerli bir e-posta girin." }, { status: 400 });
    }

    const { email } = parsed.data;
    const ip = getIp(req);

    // Hız sınırı — e-posta başına 5/saat, IP başına 10/saat
    const [byEmail, byIp] = await Promise.all([
      RATE_LIMIT.resetEmail(email),
      RATE_LIMIT.resetIp(ip),
    ]);
    if (!byEmail.allowed || !byIp.allowed) {
      // Timing saldırısını önlemek için 200 döner
      return NextResponse.json({ ok: true });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (user && user.isActive) {
      // Eski tokenleri geçersiz kıl (soft: yeni token eklenir, eskiler silinir)
      await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });

      const { raw, hash } = generateResetToken();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 saat

      await prisma.passwordResetToken.create({
        data: { userId: user.id, tokenHash: hash, expiresAt },
      });

      await prisma.passwordAuditLog.create({
        data: { userId: user.id, event: "RESET_REQUEST", ipAddress: ip },
      });

      const resetUrl = `${getBaseUrl()}/reset-password?token=${raw}`;

      await sendPasswordResetEmail({ to: email, name: user.name, resetUrl });
    }

    // Kullanıcı varlığından bağımsız olarak aynı yanıt — kullanıcı numaralandırmayı önler
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[forgot-password]", err);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
}
