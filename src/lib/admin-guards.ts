import { NextResponse } from "next/server";
import { prisma } from "./prisma";

// Son COMPANY_ADMIN koruması.
// action: "deactivate" | "demote" — işlem türü için hata mesajını özelleştirir.
export async function guardLastAdmin(
  companyId: string,
  targetUserId: string,
  action: "deactivate" | "demote"
): Promise<NextResponse | null> {
  const adminCount = await prisma.user.count({
    where: { companyId, role: "COMPANY_ADMIN", isActive: true },
  });
  if (adminCount <= 1) {
    const msg =
      action === "demote"
        ? "Son şirket yöneticisinin rolü değiştirilemez."
        : "Son şirket yöneticisi pasife alınamaz.";
    return NextResponse.json({ error: msg }, { status: 409 });
  }
  return null;
}
