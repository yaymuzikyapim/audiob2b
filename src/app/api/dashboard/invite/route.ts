export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-guard";
import { getBaseUrl } from "@/lib/base-url";
import { sendEmail } from "@/lib/mailer";
import { inviteEmailHtml, inviteEmailText } from "@/lib/emails/invite";

export async function POST(req: NextRequest) {
  const auth = await requireUser({ roles: ["COMPANY_ADMIN"] });
  if (!auth.ok) return auth.response;
  const { user } = auth;

  const { email, role } = await req.json();
  if (!email) return NextResponse.json({ error: "E-posta zorunlu." }, { status: 400 });
  if (!["EMPLOYEE", "COMPANY_ADMIN"].includes(role)) {
    return NextResponse.json({ error: "Geçersiz rol." }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "Bu e-posta adresine davet gönderilemiyor. Destek için satis@audiob2b.com.tr ile iletişime geçin." },
      { status: 409 }
    );
  }

  const EXPIRES_DAYS = 7;
  const expiresAt = new Date(Date.now() + EXPIRES_DAYS * 24 * 60 * 60 * 1000);

  let invite: { token: string };
  let companyName: string;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Şirket satırını kilitle — eşzamanlı davetlerin kota aşmasını engelle (TOCTOU)
      await tx.$queryRaw`SELECT id FROM "Company" WHERE id = ${user.companyId!} FOR UPDATE`;

      const [activeUsers, pendingInvites, company] = await Promise.all([
        tx.user.count({ where: { companyId: user.companyId!, isActive: true } }),
        tx.inviteToken.count({
          where: { companyId: user.companyId!, usedAt: null, expiresAt: { gt: new Date() } },
        }),
        tx.company.findUnique({ where: { id: user.companyId! }, select: { name: true, maxSeats: true } }),
      ]);

      if (!company) throw Object.assign(new Error("Şirket bulunamadı."), { code: "NOT_FOUND" });

      if (activeUsers + pendingInvites >= company.maxSeats) {
        throw Object.assign(
          new Error("Lisans kotası dolu. Yöneticinizle iletişime geçin."),
          { code: "SEATS_FULL" }
        );
      }

      const existingInvite = await tx.inviteToken.findFirst({
        where: { email, companyId: user.companyId!, usedAt: null, expiresAt: { gt: new Date() } },
      });
      if (existingInvite) {
        throw Object.assign(new Error("Bu adrese zaten aktif bir davet gönderilmiş."), { code: "DUPE_INVITE" });
      }

      const created = await tx.inviteToken.create({
        data: { email, companyId: user.companyId!, role: role as "EMPLOYEE" | "COMPANY_ADMIN", expiresAt },
      });

      return { invite: created, companyName: company.name };
    });

    invite = result.invite;
    companyName = result.companyName;
  } catch (e: any) {
    if (e?.code === "NOT_FOUND") return NextResponse.json({ error: "Şirket bulunamadı." }, { status: 404 });
    if (e?.code === "SEATS_FULL") return NextResponse.json({ error: e.message }, { status: 400 });
    if (e?.code === "DUPE_INVITE") return NextResponse.json({ error: e.message }, { status: 409 });
    console.error("[Invite] Transaction hatası:", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }

  // E-posta commit SONRASI gönderilir
  const inviteUrl = `${getBaseUrl()}/invite/${invite.token}`;

  try {
    await sendEmail({
      to: email,
      subject: `${companyName} sizi AudioB2B'ye davet etti`,
      html: inviteEmailHtml({ companyName, inviteUrl, role, expiresInDays: EXPIRES_DAYS }),
      text: inviteEmailText({ companyName, inviteUrl, role, expiresInDays: EXPIRES_DAYS }),
    });
  } catch (err) {
    console.error("[Invite] E-posta gönderilemedi:", err);
    if (process.env.NODE_ENV !== "production") {
      return NextResponse.json({ ok: true, inviteUrl, emailError: "E-posta gönderilemedi (dev mod)" });
    }
    return NextResponse.json(
      { error: "Davet oluşturuldu fakat e-posta gönderilemedi. Lütfen tekrar deneyin." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
