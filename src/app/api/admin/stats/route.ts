export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }

  const [companies, books, packages, users] = await Promise.all([
    prisma.company.count(),
    prisma.book.count(),
    prisma.package.count(),
    prisma.user.count({ where: { role: { not: "SUPER_ADMIN" } } }),
  ]);

  const activeCompanies = await prisma.company.count({ where: { isActive: true } });
  const recentCompanies = await prisma.company.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { id: true, name: true, createdAt: true, isActive: true, maxSeats: true },
  });

  return NextResponse.json({ companies, books, packages, users, activeCompanies, recentCompanies });
}
