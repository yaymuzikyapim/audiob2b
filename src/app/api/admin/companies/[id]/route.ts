export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }

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
  const session = await getSession();
  if (!session || session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();

  try {
    const company = await prisma.company.update({
      where: { id },
      data: {
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
      },
    });
    return NextResponse.json(company);
  } catch (err) {
    console.error("[PATCH /companies/:id]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }

  const { id } = await params;
  await prisma.company.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
