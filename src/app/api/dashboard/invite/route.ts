export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { sendEmail } from "@/lib/mailer";
import { inviteEmailHtml } from "@/lib/emails/invite";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "COMPANY_ADMIN" || !session.companyId) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }

  const { email, role } = await req.json();
  if (!email) return NextResponse.json({ error: "E-posta zorunlu." }, { status: 400 });
  if (!["EMPLOYEE", "COMPANY_ADMIN"].includes(role)) {
    return NextResponse.json({ error: "Geçersiz rol." }, { status: 400 });
  }

  const company = await prisma.company.findUnique({
    where: { id: session.companyId },
    select: { name: true, maxSeats: true, _count: { select: { users: true } } },
  });

  if (!company) return NextResponse.json({ error: "Şirket bulunamadı." }, { status: 404 });

  if (company._count.users >= company.maxSeats) {
    return NextResponse.json({ error: "Lisans kotası dolu. Yöneticinizle iletişime geçin." }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Bu e-posta zaten kayıtlı." }, { status: 409 });
  }

  const existingInvite = await prisma.inviteToken.findFirst({
    where: { email, companyId: session.companyId, usedAt: null, expiresAt: { gt: new Date() } },
  });
  if (existingInvite) {
    return NextResponse.json({ error: "Bu adrese zaten aktif bir davet gönderilmiş." }, { status: 409 });
  }

  const EXPIRES_DAYS = 7;
  const expiresAt = new Date(Date.now() + EXPIRES_DAYS * 24 * 60 * 60 * 1000);

  const invite = await prisma.inviteToken.create({
    data: {
      email,
      companyId: session.companyId,
      role: role as "EMPLOYEE" | "COMPANY_ADMIN",
      expiresAt,
    },
  });

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const inviteUrl = `${baseUrl}/invite/${invite.token}`;

  try {
    await sendEmail({
      to: email,
      subject: `${company.name} sizi AudioB2B'ye davet etti`,
      html: inviteEmailHtml({
        companyName: company.name,
        inviteUrl,
        role,
        expiresInDays: EXPIRES_DAYS,
      }),
    });
  } catch (err) {
    console.error("[Invite] E-posta gönderilemedi:", err);
    // E-posta hata verse de davet oluşturuldu, dev ortamında URL döndür
    if (process.env.NODE_ENV !== "production") {
      return NextResponse.json({ ok: true, inviteUrl, emailError: "E-posta gönderilemedi (dev mod)" });
    }
    return NextResponse.json({ error: "Davet oluşturuldu fakat e-posta gönderilemedi. Lütfen tekrar deneyin." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
