export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { sendEmail } from "@/lib/mailer";
import { inviteEmailHtml } from "@/lib/emails/invite";
import { randomBytes } from "crypto";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }

  const { id: companyId } = await params;
  const { email, role = "EMPLOYEE" } = await req.json();

  if (!email) return NextResponse.json({ error: "E-posta zorunlu." }, { status: 400 });

  try {
    const company = await prisma.company.findUnique({ where: { id: companyId }, select: { name: true } });
    if (!company) return NextResponse.json({ error: "Şirket bulunamadı." }, { status: 404 });

    const existing = await prisma.user.findFirst({ where: { email, companyId } });
    if (existing) return NextResponse.json({ error: "Bu e-posta zaten kayıtlı." }, { status: 400 });

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await prisma.inviteToken.create({ data: { token, email, role, companyId, expiresAt } });

    const inviteUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/invite/${token}`;

    try {
      await sendEmail({
        to: email,
        subject: `${company.name} sizi AudioB2B'ye davet ediyor`,
        html: inviteEmailHtml({ companyName: company.name, inviteUrl, role, expiresInDays: 7 }),
      });
      return NextResponse.json({ ok: true });
    } catch {
      return NextResponse.json({ ok: true, warning: "E-posta gönderilemedi.", inviteUrl });
    }
  } catch (err) {
    console.error("Davet hatası:", err);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
}
