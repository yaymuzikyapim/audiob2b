export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }

  const books = await prisma.book.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      category: { select: { name: true } },
      _count: { select: { chapters: true, packages: true } },
    },
  });

  return NextResponse.json(books);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }

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
