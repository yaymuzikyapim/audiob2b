export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-guard";
import { generateResetToken } from "@/lib/password";
import { sendPasswordResetEmail } from "@/lib/emails/reset-password";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const auth = await requireUser({ roles: ["COMPANY_ADMIN"] });
  if (!auth.ok) return auth.response;

  const { userId: id } = await params;

  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, name: true, isActive: true, companyId: true },
  });

  if (!target || !target.isActive) {
    return NextResponse.json({ error: "Kullanıcı bulunamadı." }, { status: 404 });
  }

  // Sadece aynı şirketteki kullanıcıya gönderebilir
  if (target.companyId !== auth.user.companyId) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }

  await prisma.passwordResetToken.deleteMany({ where: { userId: target.id } });

  const { raw, hash } = generateResetToken();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  await prisma.passwordResetToken.create({
    data: { userId: target.id, tokenHash: hash, expiresAt },
  });

  await prisma.passwordAuditLog.create({
    data: { userId: target.id, actorId: auth.user.id, event: "ADMIN_TRIGGER" },
  });

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "https://audiob2b.com.tr";
  const resetUrl = `${baseUrl}/reset-password?token=${raw}`;

  try {
    await sendPasswordResetEmail({ to: target.email, name: target.name, resetUrl });
  } catch (mailErr) {
    console.error("[dashboard/send-reset] e-posta gönderilemedi:", mailErr);
    return NextResponse.json({ error: "E-posta gönderilemedi." }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
