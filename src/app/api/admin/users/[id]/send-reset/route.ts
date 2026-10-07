export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-guard";
import { generateResetToken } from "@/lib/password";
import { sendPasswordResetEmail } from "@/lib/emails/reset-password";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // SUPER_ADMIN veya COMPANY_ADMIN kendi şirketindeki kullanıcıya link gönderebilir
  const auth = await requireUser({ roles: ["SUPER_ADMIN", "COMPANY_ADMIN"] });
  if (!auth.ok) return auth.response;

  const { id } = await params;

  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, name: true, isActive: true, companyId: true },
  });

  if (!target || !target.isActive) {
    return NextResponse.json({ error: "Kullanıcı bulunamadı." }, { status: 404 });
  }

  // COMPANY_ADMIN yalnızca kendi şirketindeki kullanıcıya link gönderebilir
  if (
    auth.user.role === "COMPANY_ADMIN" &&
    target.companyId !== auth.user.companyId
  ) {
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
    console.error("[admin/send-reset] e-posta gönderilemedi:", mailErr);
    return NextResponse.json({ error: "E-posta gönderilemedi." }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
