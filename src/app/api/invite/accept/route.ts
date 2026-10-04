export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signSession, SESSION_COOKIE } from "@/lib/session";

export async function POST(req: NextRequest) {
  const { token, name, password } = await req.json();

  if (!token || !name || !password) {
    return NextResponse.json({ error: "Tüm alanlar zorunlu." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Şifre en az 8 karakter olmalı." }, { status: 400 });
  }

  const invite = await prisma.inviteToken.findUnique({
    where: { token },
    include: { company: { select: { id: true, isActive: true } } },
  });

  if (!invite || invite.usedAt || invite.expiresAt < new Date()) {
    return NextResponse.json({ error: "Bu davet linki geçersiz veya süresi dolmuş." }, { status: 400 });
  }

  if (!invite.company.isActive) {
    return NextResponse.json({ error: "Şirket hesabı aktif değil." }, { status: 400 });
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let newUser: any;

  try {
    newUser = await prisma.$transaction(async (tx) => {
      // Şirket satırını kilitle — eşzamanlı kabullerin kota aşmasını engelle (TOCTOU)
      await tx.$queryRaw`SELECT id FROM "Company" WHERE id = ${invite.companyId} FOR UPDATE`;

      const [activeUserCount, company] = await Promise.all([
        tx.user.count({ where: { companyId: invite.companyId, isActive: true } }),
        tx.company.findUnique({ where: { id: invite.companyId }, select: { maxSeats: true } }),
      ]);

      if (!company) throw Object.assign(new Error("Şirket bulunamadı."), { code: "NOT_FOUND" });
      if (activeUserCount >= company.maxSeats) {
        throw Object.assign(new Error("Şirket lisans kotası doldu."), { code: "SEATS_FULL" });
      }

      const existing = await tx.user.findUnique({ where: { email: invite.email } });
      if (existing) throw Object.assign(new Error("Bu e-posta zaten kayıtlı."), { code: "EMAIL_EXISTS" });

      const created = await tx.user.create({
        data: { email: invite.email, name, password: hashedPassword, role: invite.role, companyId: invite.companyId },
      });
      await tx.inviteToken.update({ where: { token }, data: { usedAt: new Date() } });
      return created;
    });
  } catch (e: any) {
    if (e?.code === "NOT_FOUND") return NextResponse.json({ error: "Şirket bulunamadı." }, { status: 400 });
    if (e?.code === "SEATS_FULL") return NextResponse.json({ error: "Şirket lisans kotası doldu." }, { status: 400 });
    if (e?.code === "EMAIL_EXISTS") return NextResponse.json({ error: "Bu e-posta zaten kayıtlı." }, { status: 409 });
    console.error("[Accept] Transaction hatası:", e);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }

  const user = newUser;
  const jwtToken = await signSession({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    companyId: user.companyId,
  });

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, jwtToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });

  return response;
}
