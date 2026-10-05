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
  const { isActive, role } = body as { isActive?: boolean; role?: string };

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

  if (!["EMPLOYEE", "COMPANY_ADMIN"].includes(role ?? "X") && role !== undefined) {
    return NextResponse.json({ error: "Geçersiz rol." }, { status: 400 });
  }

  const data: { isActive?: boolean; role?: "EMPLOYEE" | "COMPANY_ADMIN" } = {};
  if (isActive !== undefined) data.isActive = isActive;
  if (role !== undefined) data.role = role as "EMPLOYEE" | "COMPANY_ADMIN";

  const updated = await prisma.user.update({ where: { id: userId }, data, select: { id: true, isActive: true, role: true } });
  return NextResponse.json({ ok: true, user: updated });
}

// DELETE: kullanıcıyı sil (son yönetici ve kendini silme koruması)
export async function DELETE(_req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const auth = await requireUser({ roles: ["COMPANY_ADMIN"] });
  if (!auth.ok) return auth.response;
  const { user } = auth;
  const { userId } = await params;
  const companyId = user.companyId!;

  if (userId === user.id) {
    return NextResponse.json({ error: "Kendinizi silemezsiniz." }, { status: 409 });
  }

  const target = await prisma.user.findFirst({
    where: { id: userId, companyId },
    select: { id: true, role: true },
  });
  if (!target) return NextResponse.json({ error: "Kullanıcı bulunamadı." }, { status: 404 });

  if (target.role === "COMPANY_ADMIN") {
    const guard = await guardLastAdmin(companyId, userId, "deactivate");
    if (guard) return guard;
  }

  await prisma.user.delete({ where: { id: userId } });
  return NextResponse.json({ ok: true });
}
