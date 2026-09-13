export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

// GET: tüm kategorileri listele
export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }

  const categories = await prisma.category.findMany({
    include: { _count: { select: { books: true } } },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(
    categories.map((c) => ({ id: c.id, name: c.name, slug: c.slug, bookCount: c._count.books }))
  );
}
