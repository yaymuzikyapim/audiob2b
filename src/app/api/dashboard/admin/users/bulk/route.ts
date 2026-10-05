import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// POST: toplu işlem — { action: "activate" | "deactivate", userIds: string[] }
export async function POST(req: Request) {
  const auth = await requireUser({ roles: ["COMPANY_ADMIN"] });
  if (!auth.ok) return auth.response;
  const { user } = auth;
  const companyId = user.companyId!;

  const { action, userIds } = (await req.json()) as { action: string; userIds: string[] };

  if (!["activate", "deactivate"].includes(action)) {
    return NextResponse.json({ error: "Geçersiz işlem." }, { status: 400 });
  }
  if (!Array.isArray(userIds) || userIds.length === 0) {
    return NextResponse.json({ error: "Kullanıcı seçilmedi." }, { status: 400 });
  }

  const targetIds = userIds.filter((id) => id !== user.id); // Kendini hariç tut
  const selfExcluded = targetIds.length < userIds.length;

  if (action === "deactivate") {
    // Son yönetici kontrolü: tüm admins sayısı - pasife alınacak admin sayısı ≥ 1
    const adminCount = await prisma.user.count({
      where: { companyId, role: "COMPANY_ADMIN", isActive: true },
    });
    const toDeactivateAdmins = await prisma.user.count({
      where: { id: { in: targetIds }, companyId, role: "COMPANY_ADMIN" },
    });
    if (adminCount - toDeactivateAdmins < 1) {
      return NextResponse.json(
        { error: "İşlem şirketi yöneticisiz bırakacak." },
        { status: 409 }
      );
    }
  }

  await prisma.user.updateMany({
    where: { id: { in: targetIds }, companyId },
    data: { isActive: action === "activate" },
  });

  return NextResponse.json({ ok: true, updated: targetIds.length, selfExcluded });
}
