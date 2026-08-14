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

  const { invites } = await req.json() as { invites: { email: string; role: string }[] };
  if (!Array.isArray(invites) || invites.length === 0) {
    return NextResponse.json({ error: "Davet listesi boş." }, { status: 400 });
  }

  const company = await prisma.company.findUnique({
    where: { id: session.companyId },
    select: { name: true, maxSeats: true, _count: { select: { users: true } } },
  });
  if (!company) return NextResponse.json({ error: "Şirket bulunamadı." }, { status: 404 });

  const remaining = company.maxSeats - company._count.users;
  if (invites.length > remaining) {
    return NextResponse.json({ error: `Yalnızca ${remaining} koltuk boş, ${invites.length} davet gönderilemiyor.` }, { status: 400 });
  }

  const EXPIRES_DAYS = 7;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

  const results: { email: string; status: "ok" | "skipped" | "error"; reason?: string }[] = [];

  for (const { email, role } of invites) {
    if (!email || !email.includes("@")) {
      results.push({ email, status: "skipped", reason: "Geçersiz e-posta" });
      continue;
    }
    if (!["EMPLOYEE", "COMPANY_ADMIN"].includes(role)) {
      results.push({ email, status: "skipped", reason: "Geçersiz rol" });
      continue;
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      results.push({ email, status: "skipped", reason: "Zaten kayıtlı" });
      continue;
    }

    const existingInvite = await prisma.inviteToken.findFirst({
      where: { email, companyId: session.companyId, usedAt: null, expiresAt: { gt: new Date() } },
    });
    if (existingInvite) {
      results.push({ email, status: "skipped", reason: "Aktif davet mevcut" });
      continue;
    }

    try {
      const invite = await prisma.inviteToken.create({
        data: { email, companyId: session.companyId, role: role as "EMPLOYEE" | "COMPANY_ADMIN", expiresAt: new Date(Date.now() + EXPIRES_DAYS * 86400000) },
      });
      const inviteUrl = `${baseUrl}/invite/${invite.token}`;
      await sendEmail({
        to: email,
        subject: `${company.name} sizi AudioB2B'ye davet etti`,
        html: inviteEmailHtml({ companyName: company.name, inviteUrl, role, expiresInDays: EXPIRES_DAYS }),
      });
      results.push({ email, status: "ok" });
    } catch {
      results.push({ email, status: "error", reason: "E-posta gönderilemedi" });
    }
  }

  return NextResponse.json({ results });
}
