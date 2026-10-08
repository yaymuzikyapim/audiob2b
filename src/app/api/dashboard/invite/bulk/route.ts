export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-guard";
import { sendEmail } from "@/lib/mailer";
import { inviteEmailHtml } from "@/lib/emails/invite";

type InviteResult = { email: string; status: "ok" | "skipped" | "error"; reason?: string };

export async function POST(req: NextRequest) {
  const auth = await requireUser({ roles: ["COMPANY_ADMIN"] });
  if (!auth.ok) return auth.response;
  const { user } = auth;

  const { invites } = (await req.json()) as { invites: { email: string; role: string }[] };
  if (!Array.isArray(invites) || invites.length === 0) {
    return NextResponse.json({ error: "Davet listesi boş." }, { status: 400 });
  }

  const EXPIRES_DAYS = 7;
  const expiresAt = new Date(Date.now() + EXPIRES_DAYS * 86400000);

  // Format doğrulama (transaction dışında)
  const skippedResults: InviteResult[] = [];
  const validInvites: { email: string; role: "EMPLOYEE" | "COMPANY_ADMIN" }[] = [];

  for (const { email, role } of invites) {
    if (!email || !email.includes("@")) {
      skippedResults.push({ email, status: "skipped", reason: "Geçersiz e-posta" });
      continue;
    }
    if (!["EMPLOYEE", "COMPANY_ADMIN"].includes(role)) {
      skippedResults.push({ email, status: "skipped", reason: "Geçersiz rol" });
      continue;
    }
    validInvites.push({ email, role: role as "EMPLOYEE" | "COMPANY_ADMIN" });
  }

  if (validInvites.length === 0) {
    return NextResponse.json({ results: skippedResults });
  }

  // Kayıtlı e-postaları önceden filtrele (transaction dışında — okuma güvenli)
  const existingUsers = await prisma.user.findMany({
    where: { email: { in: validInvites.map((i) => i.email) } },
    select: { email: true },
  });
  const registeredEmails = new Set(existingUsers.map((u) => u.email));

  const toInvite = validInvites.filter((i) => !registeredEmails.has(i.email));
  for (const { email } of validInvites.filter((i) => registeredEmails.has(i.email))) {
    skippedResults.push({ email, status: "skipped", reason: "Davet gönderilemedi" });
  }

  if (toInvite.length === 0) {
    return NextResponse.json({ results: skippedResults });
  }

  // Token'ları önceden üret — createMany geri dönüş değeri vermez
  const tokensData = toInvite.map((inv) => ({
    ...inv,
    token: randomBytes(32).toString("hex"),
    companyId: user.companyId!,
    expiresAt,
  }));

  let companyName: string;
  let createdEmails: string[];
  const dupResults: InviteResult[] = [];

  try {
    const txResult = await prisma.$transaction(async (tx) => {
      // Şirket satırını kilitle — eşzamanlı toplu davetlerin kota aşmasını engelle (TOCTOU)
      await tx.$queryRaw`SELECT id FROM "Company" WHERE id = ${user.companyId!} FOR UPDATE`;

      const [activeUsers, pendingInvites, company] = await Promise.all([
        tx.user.count({ where: { companyId: user.companyId!, isActive: true } }),
        tx.inviteToken.count({
          where: { companyId: user.companyId!, usedAt: null, expiresAt: { gt: new Date() } },
        }),
        tx.company.findUnique({ where: { id: user.companyId! }, select: { name: true, maxSeats: true } }),
      ]);

      if (!company) throw Object.assign(new Error("Şirket bulunamadı."), { code: "NOT_FOUND" });

      const occupied = activeUsers + pendingInvites;
      const remaining = company.maxSeats - occupied;
      if (toInvite.length > remaining) {
        throw Object.assign(
          new Error(`Yalnızca ${remaining} koltuk boş, ${toInvite.length} davet gönderilemiyor.`),
          { code: "SEATS_FULL" }
        );
      }

      // Bekleyen davetleri kontrol et (transaction içinde)
      const existingInvites = await tx.inviteToken.findMany({
        where: {
          email: { in: toInvite.map((i) => i.email) },
          companyId: user.companyId!,
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
        select: { email: true },
      });
      const dupeSet = new Set(existingInvites.map((i) => i.email));
      const finalTokens = tokensData.filter((t) => !dupeSet.has(t.email));
      const dupEmails = tokensData.filter((t) => dupeSet.has(t.email)).map((t) => t.email);

      if (finalTokens.length > 0) {
        await tx.inviteToken.createMany({ data: finalTokens });
      }

      return { companyName: company.name, dupEmails, createdEmails: finalTokens.map((t) => t.email) };
    });

    companyName = txResult.companyName;
    createdEmails = txResult.createdEmails;
    for (const email of txResult.dupEmails) {
      dupResults.push({ email, status: "skipped", reason: "Aktif davet mevcut" });
    }
  } catch (e: any) {
    if (e?.code === "NOT_FOUND") return NextResponse.json({ error: "Şirket bulunamadı." }, { status: 404 });
    if (e?.code === "SEATS_FULL") return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[BulkInvite] Transaction hatası:", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }

  // E-postalar commit SONRASI gönderilir
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const emailResults: InviteResult[] = [];

  for (const { email, role, token } of tokensData.filter((t) => createdEmails.includes(t.email))) {
    const inviteUrl = `${baseUrl}/invite/${token}`;
    try {
      await sendEmail({
        to: email,
        subject: `${companyName} sizi AudioB2B'ye davet etti`,
        html: inviteEmailHtml({ companyName, inviteUrl, role, expiresInDays: EXPIRES_DAYS }),
      });
      emailResults.push({ email, status: "ok" });
    } catch {
      emailResults.push({ email, status: "error", reason: "E-posta gönderilemedi" });
    }
  }

  return NextResponse.json({ results: [...skippedResults, ...dupResults, ...emailResults] });
}
