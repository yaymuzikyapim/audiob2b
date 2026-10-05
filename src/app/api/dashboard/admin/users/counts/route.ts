import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireUser({ roles: ["COMPANY_ADMIN"] });
  if (!auth.ok) return auth.response;
  const { user } = auth;
  const companyId = user.companyId!;

  const [all, active, inactive, pending, admins] = await Promise.all([
    prisma.user.count({ where: { companyId } }),
    prisma.user.count({ where: { companyId, isActive: true } }),
    prisma.user.count({ where: { companyId, isActive: false } }),
    prisma.inviteToken.count({ where: { companyId, usedAt: null, expiresAt: { gt: new Date() } } }),
    prisma.user.count({ where: { companyId, role: "COMPANY_ADMIN" } }),
  ]);

  return NextResponse.json({ all, active, inactive, pending, admins });
}
