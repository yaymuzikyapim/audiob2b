export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-guard";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser({ roles: ["SUPER_ADMIN"] });
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const company = await prisma.company.findUnique({
    where: { id },
    include: {
      package: true,
      users: { orderBy: { createdAt: "desc" }, select: { id: true, name: true, email: true, role: true, isActive: true, lastLoginAt: true } },
      inviteTokens: { orderBy: { createdAt: "desc" }, take: 10 },
    },
  });

  if (!company) return NextResponse.json({ error: "Bulunamadı." }, { status: 404 });
  return NextResponse.json(company);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser({ roles: ["SUPER_ADMIN"] });
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await req.json();

  const updateData = {
    ...(body.name && { name: body.name }),
    ...(body.licenseType && { licenseType: body.licenseType }),
    ...(body.maxSeats !== undefined && { maxSeats: parseInt(body.maxSeats) }),
    ...(body.packageId !== undefined && { packageId: body.packageId || null }),
    ...(body.startDate && { startDate: new Date(body.startDate) }),
    ...(body.endDate && { endDate: new Date(body.endDate) }),
    ...(body.notes !== undefined && { notes: body.notes }),
    ...(body.isActive !== undefined && { isActive: body.isActive }),
    ...(body.logoUrl !== undefined && { logoUrl: body.logoUrl }),
    ...(body.brandColor !== undefined && { brandColor: body.brandColor }),
  };

  try {
    // Devre dışı bırakma: bekleyen davetleri atomik olarak geçersiz kıl
    if (body.isActive === false) {
      const company = await prisma.$transaction(async (tx) => {
        await tx.inviteToken.updateMany({
          where: { companyId: id, usedAt: null },
          data: { expiresAt: new Date() },
        });
        return tx.company.update({ where: { id }, data: updateData });
      });
      return NextResponse.json(company);
    }

    const company = await prisma.company.update({ where: { id }, data: updateData });
    return NextResponse.json(company);
  } catch (err) {
    console.error("[PATCH /companies/:id]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
