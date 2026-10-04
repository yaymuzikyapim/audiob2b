export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-guard";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser({ roles: ["SUPER_ADMIN"] });
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const { password } = await req.json();

  if (!password || password.length < 6) {
    return NextResponse.json({ error: "Şifre en az 6 karakter olmalı." }, { status: 400 });
  }

  const hash = await bcrypt.hash(password, 10);
  await prisma.user.update({ where: { id }, data: { password: hash } });

  return NextResponse.json({ ok: true });
}
