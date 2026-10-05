import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { guardLastAdmin } from "@/lib/admin-guards";

export const dynamic = "force-dynamic";

// PATCH: isActive veya role güncelle
export async function PATCH(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const auth = await requireUser({ roles: ["COMPANY_ADMIN"] });
  if (!auth.ok) return auth.response;
  const { user } = auth;
  const { userId } = await params;
  const companyId = user.companyId!;

  const body = await req.json();
  const { isActive, role, action } = body as { isActive?: boolean; role?: string; action?: string };

  // Hedef kullanıcı bu şirkete ait mi?
  const target = await prisma.user.findFirst({
    where: { id: userId, companyId },
    select: { id: true, role: true, isActive: true },
  });
  if (!target) return NextResponse.json({ error: "Kullanıcı bulunamadı." }, { status: 404 });

  // Kendini pasife alamaz
  if (isActive === false && userId === user.id) {
    return NextResponse.json({ error: "Kendinizi pasife alamazsınız." }, { status: 409 });
  }

  // Son yönetici koruması — pasife alma
  if (isActive === false && target.role === "COMPANY_ADMIN") {
    const guard = await guardLastAdmin(companyId, userId, "deactivate");
    if (guard) return guard;
  }

  // Son yönetici koruması — rol düşürme
  if (role === "EMPLOYEE" && target.role === "COMPANY_ADMIN") {
    const guard = await guardLastAdmin(companyId, userId, "demote");
    if (guard) return guard;
  }

  // "leave" aksiyonu: şirketten çıkar (companyId=null, isActive=false; PlayHistory korunur)
  if (action === "leave") {
    if (userId === user.id) {
      return NextResponse.json({ error: "Kendinizi şirketten çıkaramazsınız." }, { status: 409 });
    }
    if (target.role === "COMPANY_ADMIN") {
      const guard = await guardLastAdmin(companyId, userId, "deactivate");
      if (guard) return guard;
    }
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { companyId: null, isActive: false },
      select: { id: true },
    });
    return NextResponse.json({ ok: true, user: updated });
  }

  if (!["EMPLOYEE", "COMPANY_ADMIN"].includes(role ?? "X") && role !== undefined) {
    return NextResponse.json({ error: "Geçersiz rol." }, { status: 400 });
  }

  const updateData: { isActive?: boolean; role?: "EMPLOYEE" | "COMPANY_ADMIN" } = {};
  if (isActive !== undefined) updateData.isActive = isActive;
  if (role !== undefined) updateData.role = role as "EMPLOYEE" | "COMPANY_ADMIN";

  const updated = await prisma.user.update({ where: { id: userId }, data: updateData, select: { id: true, isActive: true, role: true } });
  return NextResponse.json({ ok: true, user: updated });
}
