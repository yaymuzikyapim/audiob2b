export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-guard";

const BookCreateSchema = z.object({
  title: z.string().min(1),
  author: z.string().min(1),
  narrator: z.string().optional(),
  duration: z.coerce.number().int().positive(),
  coverUrl: z.string().url().optional().nullable(),
  description: z.string().optional().nullable(),
  isbn: z.string().optional().nullable(),
  categoryId: z.string().optional().nullable(),
  publishedAt: z.string().optional().nullable(),
});

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

  const raw = await req.json();
  const parsed = BookCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Geçersiz veri." }, { status: 400 });
  }
  const { title, author, narrator, duration, coverUrl, description, isbn, categoryId, publishedAt } = parsed.data;

  const book = await prisma.book.create({
    data: {
      title,
      author,
      narrator: narrator || null,
      duration,
      coverUrl: coverUrl || null,
      description: description || null,
      isbn: isbn || null,
      categoryId: categoryId || null,
      publishedAt: publishedAt ? new Date(publishedAt) : null,
    },
  });

  return NextResponse.json(book, { status: 201 });
}
