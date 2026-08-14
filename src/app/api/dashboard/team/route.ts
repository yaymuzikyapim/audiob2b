export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "COMPANY_ADMIN" || !session.companyId) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }

  const [users, company, pendingInvites] = await Promise.all([
    prisma.user.findMany({
      where: { companyId: session.companyId, role: { not: "SUPER_ADMIN" } },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, email: true, role: true, isActive: true, lastLoginAt: true, createdAt: true },
    }),
    prisma.company.findUnique({
      where: { id: session.companyId },
      select: { maxSeats: true, name: true, _count: { select: { users: true } } },
    }),
    prisma.inviteToken.findMany({
      where: { companyId: session.companyId, usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
      select: { id: true, email: true, role: true, createdAt: true, expiresAt: true },
    }),
  ]);

  return NextResponse.json({ users, company, pendingInvites });
}
