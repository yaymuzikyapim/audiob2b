export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-guard";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser({ roles: ["SUPER_ADMIN"] });
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const pkg = await prisma.package.findUnique({
    where: { id },
    include: {
      books: { include: { book: { select: { id: true, title: true, author: true, duration: true, coverUrl: true } } } },
      companies: { select: { id: true, name: true, isActive: true } },
    },
  });

  if (!pkg) return NextResponse.json({ error: "Bulunamadı." }, { status: 404 });
  return NextResponse.json(pkg);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser({ roles: ["SUPER_ADMIN"] });
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await req.json();

  const pkg = await prisma.package.update({
    where: { id },
    data: {
      ...(body.name && { name: body.name }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.isActive !== undefined && { isActive: body.isActive }),
    },
  });

  return NextResponse.json(pkg);
}

// Pakete kitap ekle/çıkar
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser({ roles: ["SUPER_ADMIN"] });
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const { bookIds } = await req.json(); // tüm bookId listesi gönderilir

  // Transaction'dan önce tüm bookId'lerin var olduğunu doğrula
  if (Array.isArray(bookIds) && bookIds.length > 0) {
    const found = await prisma.book.findMany({
      where: { id: { in: bookIds } },
      select: { id: true },
    });
    if (found.length !== bookIds.length) {
      const missing = (bookIds as string[]).filter((bid) => !found.some((b) => b.id === bid));
      return NextResponse.json({ error: `Geçersiz kitap: ${missing.join(", ")}` }, { status: 400 });
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.packageBook.deleteMany({ where: { packageId: id } });
    if (bookIds?.length) {
      await tx.packageBook.createMany({
        data: bookIds.map((bookId: string) => ({ packageId: id, bookId })),
      });
    }
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser({ roles: ["SUPER_ADMIN"] });
  if (!auth.ok) return auth.response;

  const { id } = await params;
  await prisma.package.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
