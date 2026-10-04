export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-guard";

export async function GET() {
  const auth = await requireUser({ roles: ["SUPER_ADMIN"] });
  if (!auth.ok) return auth.response;

  const companies = await prisma.company.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      package: { select: { name: true } },
      _count: { select: { users: true } },
    },
  });

  return NextResponse.json(companies);
}

export async function POST(req: NextRequest) {
  const auth = await requireUser({ roles: ["SUPER_ADMIN"] });
  if (!auth.ok) return auth.response;

  const body = await req.json();
  const { name, slug, licenseType, maxSeats, packageId, startDate, endDate, notes } = body;

  if (!name || !slug || !startDate || !endDate) {
    return NextResponse.json({ error: "Zorunlu alanlar eksik." }, { status: 400 });
  }

  const existing = await prisma.company.findUnique({ where: { slug } });
  if (existing) {
    return NextResponse.json({ error: "Bu slug zaten kullanılıyor." }, { status: 409 });
  }

  const company = await prisma.company.create({
    data: {
      name,
      slug,
      licenseType: licenseType || "PER_SEAT",
      maxSeats: maxSeats ? parseInt(maxSeats) : 10,
      packageId: packageId || null,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      notes: notes || null,
    },
  });

  return NextResponse.json(company, { status: 201 });
}
