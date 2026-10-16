export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-guard";
import { koltukKapisiIleOlustur } from "@/lib/seats";

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

  // Aktif kullanıcı oluşturmak koltuk harcar; kota dolu/aşılmışsa oluşturulmaz.
  try {
    const user = await koltukKapisiIleOlustur(id, (tx) =>
      tx.user.create({
        data: {
          name,
          email,
          password: hashed,
          role: role === "COMPANY_ADMIN" ? "COMPANY_ADMIN" : "EMPLOYEE",
          companyId: id,
          isActive: true,
        },
      })
    );
    return NextResponse.json({ ok: true, userId: user.id });
  } catch (e: unknown) {
    const code = (e as { code?: string } | null)?.code;
    if (code === "SEATS_FULL" && e instanceof Error) return NextResponse.json({ error: e.message }, { status: 400 });
    if (code === "NOT_FOUND") return NextResponse.json({ error: "Şirket bulunamadı." }, { status: 404 });
    throw e;
  }
}
