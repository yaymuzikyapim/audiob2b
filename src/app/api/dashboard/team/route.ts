export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-guard";

export async function GET() {
  const auth = await requireUser({ roles: ["COMPANY_ADMIN"] });
  if (!auth.ok) return auth.response;
  const { user } = auth;

  const [users, company, pendingInvites] = await Promise.all([
    prisma.user.findMany({
      where: { companyId: user.companyId!, role: { not: "SUPER_ADMIN" } },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, email: true, role: true, isActive: true, lastLoginAt: true, createdAt: true },
    }),
    prisma.company.findUnique({
      where: { id: user.companyId! },
      select: { maxSeats: true, name: true, _count: { select: { users: true } } },
    }),
    prisma.inviteToken.findMany({
      where: { companyId: user.companyId!, usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
      select: { id: true, email: true, role: true, createdAt: true, expiresAt: true },
    }),
  ]);

  return NextResponse.json({ users, company, pendingInvites });
}
