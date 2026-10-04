export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-guard";

export async function GET(req: NextRequest) {
  const auth = await requireUser({ roles: ["SUPER_ADMIN"] });
  if (!auth.ok) return auth.response;

  const includeDemo = req.nextUrl.searchParams.get("includeDemo") === "true";
  const demoFilter = includeDemo ? {} : { isDemo: false };

  const [companies, books, booksSilent, packages, users] = await Promise.all([
    prisma.company.count({ where: demoFilter }),
    prisma.book.count(),
    prisma.book.count({ where: { chapters: { none: {} } } }),
    prisma.package.count(),
    prisma.user.count({ where: { role: { not: "SUPER_ADMIN" }, company: demoFilter } }),
  ]);

  const activeCompanies = await prisma.company.count({ where: { isActive: true, ...demoFilter } });
  const recentCompanies = await prisma.company.findMany({
    where: demoFilter,
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { id: true, name: true, createdAt: true, isActive: true, maxSeats: true },
  });

  return NextResponse.json({ companies, books, booksSilent, packages, users, activeCompanies, recentCompanies });
}
