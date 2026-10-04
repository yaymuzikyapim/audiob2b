export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-guard";

export async function GET(req: NextRequest) {
  const auth = await requireUser({ roles: ["SUPER_ADMIN"] });
  if (!auth.ok) return auth.response;

  const q = new URL(req.url).searchParams.get("q");

  const books = await prisma.book.findMany({
    where: q ? { title: { contains: q, mode: "insensitive" } } : undefined,
    orderBy: { createdAt: "desc" },
    take: q ? 10 : undefined,
    include: {
      category: { select: { name: true } },
      _count: { select: { chapters: true, packages: true } },
    },
  });

  return NextResponse.json(books);
}

export async function POST(req: NextRequest) {
  const auth = await requireUser({ roles: ["SUPER_ADMIN"] });
  if (!auth.ok) return auth.response;

  const body = await req.json();
  const { title, author, narrator, duration, coverUrl, description, isbn, categoryId, publishedAt } = body;

  if (!title || !author || !duration) {
    return NextResponse.json({ error: "Zorunlu alanlar: title, author, duration." }, { status: 400 });
  }

  const book = await prisma.book.create({
    data: {
      title,
      author,
      narrator: narrator || null,
      duration: parseInt(duration),
      coverUrl: coverUrl || null,
      description: description || null,
      isbn: isbn || null,
      categoryId: categoryId || null,
      publishedAt: publishedAt ? new Date(publishedAt) : null,
    },
  });

  return NextResponse.json(book, { status: 201 });
}
