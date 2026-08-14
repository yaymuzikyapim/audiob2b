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

  // Kota kontrolü
  const userCount = await prisma.user.count({ where: { companyId: invite.companyId } });
  const company = await prisma.company.findUnique({ where: { id: invite.companyId }, select: { maxSeats: true } });
  if (company && userCount >= company.maxSeats) {
    return NextResponse.json({ error: "Şirket lisans kotası doldu." }, { status: 400 });
  }

  // Mevcut kullanıcı kontrolü
  const existing = await prisma.user.findUnique({ where: { email: invite.email } });
  if (existing) {
    return NextResponse.json({ error: "Bu e-posta zaten kayıtlı." }, { status: 409 });
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  const [user] = await prisma.$transaction([
    prisma.user.create({
      data: {
        email: invite.email,
        name,
        password: hashedPassword,
        role: invite.role,
        companyId: invite.companyId,
      },
    }),
    prisma.inviteToken.update({
      where: { token },
      data: { usedAt: new Date() },
    }),
  ]);

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
