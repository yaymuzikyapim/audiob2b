export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-guard";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser({ roles: ["SUPER_ADMIN"] });
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const { name, email, password, role } = await req.json();

  if (!name || !email || !password) {
    return NextResponse.json({ error: "Ad, e-posta ve şifre zorunlu." }, { status: 400 });
  }

  const company = await prisma.company.findUnique({ where: { id } });
  if (!company) return NextResponse.json({ error: "Şirket bulunamadı." }, { status: 404 });

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return NextResponse.json({ error: "Bu e-posta zaten kayıtlı." }, { status: 409 });

  const hashed = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      password: hashed,
      role: role === "COMPANY_ADMIN" ? "COMPANY_ADMIN" : "EMPLOYEE",
      companyId: id,
      isActive: true,
    },
  });

  return NextResponse.json({ ok: true, userId: user.id });
}
