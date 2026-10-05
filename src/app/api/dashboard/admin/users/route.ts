import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

export async function GET(req: Request) {
  const auth = await requireUser({ roles: ["COMPANY_ADMIN"] });
  if (!auth.ok) return auth.response;
  const { user } = auth;
  const companyId = user.companyId!;

  const url = new URL(req.url);
  const tab = url.searchParams.get("tab") ?? "all"; // all | active | inactive | pending | admins
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"));
  const skip = (page - 1) * PAGE_SIZE;

  // Davet bekleniyor sekmesi
  if (tab === "pending") {
    const where = {
      companyId,
      usedAt: null,
      expiresAt: { gt: new Date() },
    };
    const [total, items] = await Promise.all([
      prisma.inviteToken.count({ where }),
      prisma.inviteToken.findMany({
        where,
        skip,
        take: PAGE_SIZE,
        orderBy: { createdAt: "desc" },
        select: { id: true, email: true, role: true, expiresAt: true, createdAt: true },
      }),
    ]);
    return NextResponse.json({ tab, total, page, pageSize: PAGE_SIZE, items, type: "invite" });
  }

  // Kullanıcı sekmeleri
  type WhereType = {
    companyId: string;
    isActive?: boolean;
    role?: "COMPANY_ADMIN";
  };

  const where: WhereType = { companyId };
  if (tab === "active") where.isActive = true;
  if (tab === "inactive") where.isActive = false;
  if (tab === "admins") where.role = "COMPANY_ADMIN";

  const [total, items] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      skip,
      take: PAGE_SIZE,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
      },
    }),
  ]);

  return NextResponse.json({ tab, total, page, pageSize: PAGE_SIZE, items, type: "user" });
}

