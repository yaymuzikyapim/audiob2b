export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-guard";

export async function GET() {
  const auth = await requireUser({ roles: ["SUPER_ADMIN"] });
  if (!auth.ok) return auth.response;

  const [companies, books, booksSilent, packages, users] = await Promise.all([
    prisma.company.count(),
    prisma.book.count(),
    // Sesi hiç yüklenmemiş kitaplar
    prisma.book.count({ where: { chapters: { none: {} } } }),
    prisma.package.count(),
    prisma.user.count({ where: { role: { not: "SUPER_ADMIN" } } }),
  ]);

  const activeCompanies = await prisma.company.count({ where: { isActive: true } });
  const recentCompanies = await prisma.company.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { id: true, name: true, createdAt: true, isActive: true, maxSeats: true },
  });

  return NextResponse.json({ companies, books, booksSilent, packages, users, activeCompanies, recentCompanies });
}
