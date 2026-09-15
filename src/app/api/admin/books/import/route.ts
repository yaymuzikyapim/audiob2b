export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

function toSlug(name: string) {
  return name
    .toLowerCase()
    .replace(/ç/g, "c").replace(/ğ/g, "g").replace(/ı/g, "i")
    .replace(/ö/g, "o").replace(/ş/g, "s").replace(/ü/g, "u")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

interface BookRow {
  isbn?: string;
  title: string;
  author: string;
  narrator?: string;
  category?: string;
  duration_minutes?: string;
  publish_date?: string;
  description?: string;
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }

  const { rows }: { rows: BookRow[] } = await req.json();

  if (!rows || !Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: "Geçersiz veri." }, { status: 400 });
  }

  // 1. Mevcut ISBN'leri tek sorguda al
  const existingBooks = await prisma.book.findMany({
    where: { isbn: { not: null } },
    select: { isbn: true },
  });
  const existingIsbns = new Set(existingBooks.map((b) => b.isbn!));

  // 2. Kategorileri tek sorguda al, hem isim hem slug ile eşleştir
  const categories = await prisma.category.findMany();
  const categoryMap = new Map(categories.map((c) => [c.name.toLowerCase().trim(), c.id]));
  const categorySlugMap = new Map(categories.map((c) => [c.slug, c.id]));

  const uniqueNewCats = [
    ...new Set(
      rows
        .map((r) => r.category?.trim())
        .filter((n): n is string => !!n && !categoryMap.has(n.toLowerCase()) && !categorySlugMap.has(toSlug(n)))
    ),
  ];
  for (const name of uniqueNewCats) {
    const slug = toSlug(name);
    const cat = await prisma.category.upsert({
      where: { slug },
      create: { name, slug },
      update: {},
    });
    categoryMap.set(name.toLowerCase(), cat.id);
  }

  // 3. Geçersiz ve mükerrer satırları filtrele
  let skipped = 0;
  const toCreate = rows
    .filter((r) => {
      if (!r.title?.trim() || !r.author?.trim()) { skipped++; return false; }
      if (r.isbn?.trim() && existingIsbns.has(r.isbn.trim())) { skipped++; return false; }
      return true;
    })
    .map((r) => {
      const mins = parseFloat(r.duration_minutes?.trim() || "");
      return {
        title: r.title.trim(),
        author: r.author.trim(),
        narrator: r.narrator?.trim() || null,
        duration: isNaN(mins) ? 0 : Math.round(mins * 60),
        description: r.description?.trim() || null,
        isbn: r.isbn?.trim() || null,
        categoryId: r.category?.trim()
          ? (categoryMap.get(r.category.trim().toLowerCase()) ?? categorySlugMap.get(toSlug(r.category.trim())) ?? null)
          : null,
        publishedAt: r.publish_date?.trim() ? new Date(r.publish_date.trim()) : null,
      };
    });

  // 4. Toplu insert
  let result;
  try {
    result = await prisma.book.createMany({
      data: toCreate,
      skipDuplicates: true,
    });
  } catch (err) {
    console.error("createMany error:", err);
    return NextResponse.json(
      { error: String(err), created: 0, skipped, errors: [] },
      { status: 500 }
    );
  }

  return NextResponse.json({ created: result.count, skipped, errors: [] });
}
