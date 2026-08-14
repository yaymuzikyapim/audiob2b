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
  const book = await prisma.book.findUnique({
    where: { id },
    include: {
      category: true,
      chapters: { orderBy: { order: "asc" } },
      packages: { include: { package: { select: { id: true, name: true } } } },
    },
  });

  if (!book) return NextResponse.json({ error: "Bulunamadı." }, { status: 404 });
  return NextResponse.json(book);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();

  const book = await prisma.book.update({
    where: { id },
    data: {
      ...(body.title && { title: body.title }),
      ...(body.author && { author: body.author }),
      ...(body.narrator !== undefined && { narrator: body.narrator }),
      ...(body.duration !== undefined && { duration: parseInt(body.duration) }),
      ...(body.coverUrl !== undefined && { coverUrl: body.coverUrl }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.isbn !== undefined && { isbn: body.isbn }),
      ...(body.categoryId !== undefined && { categoryId: body.categoryId || null }),
      ...(body.isActive !== undefined && { isActive: body.isActive }),
    },
  });

  return NextResponse.json(book);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }

  const { id } = await params;
  await prisma.book.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
