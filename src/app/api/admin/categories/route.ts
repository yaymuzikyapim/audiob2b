export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-guard";

// GET: tüm kategorileri listele
export async function GET() {
  const auth = await requireUser({ roles: ["SUPER_ADMIN"] });
  if (!auth.ok) return auth.response;

  const categories = await prisma.category.findMany({
    include: { _count: { select: { books: true } } },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(
    categories.map((c) => ({ id: c.id, name: c.name, slug: c.slug, bookCount: c._count.books }))
  );
}
