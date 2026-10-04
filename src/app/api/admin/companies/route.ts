export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-guard";

const CompanyCreateSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  licenseType: z.enum(["PER_SEAT"]).optional(),
  maxSeats: z.coerce.number().int().positive().optional(),
  packageId: z.string().optional().nullable(),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  notes: z.string().optional().nullable(),
});

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

  const raw = await req.json();
  const parsed = CompanyCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Geçersiz veri." }, { status: 400 });
  }
  const { name, slug, licenseType, maxSeats, packageId, startDate, endDate, notes } = parsed.data;

  const existing = await prisma.company.findUnique({ where: { slug } });
  if (existing) {
    return NextResponse.json({ error: "Bu slug zaten kullanılıyor." }, { status: 409 });
  }

  const company = await prisma.company.create({
    data: {
      name,
      slug,
      licenseType: licenseType || "PER_SEAT",
      maxSeats: maxSeats ?? 10,
      packageId: packageId || null,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      notes: notes || null,
    },
  });

  return NextResponse.json(company, { status: 201 });
}
