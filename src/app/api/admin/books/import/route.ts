export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
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

  // Mevcut kategorileri çek
  const categories = await prisma.category.findMany();
  const categoryMap = new Map(categories.map((c) => [c.name.toLowerCase().trim(), c.id]));

  const results = { created: 0, skipped: 0, errors: [] as string[] };

  for (const row of rows) {
    if (!row.title?.trim() || !row.author?.trim()) {
      results.skipped++;
      continue;
    }

    // ISBN ile mükerrer kontrolü
    if (row.isbn?.trim()) {
      const existing = await prisma.book.findFirst({ where: { isbn: row.isbn.trim() } });
      if (existing) {
        results.skipped++;
        continue;
      }
    }

    // Kategori eşleştir (case-insensitive)
    let categoryId: string | null = null;
    if (row.category?.trim()) {
      const key = row.category.trim().toLowerCase();
      categoryId = categoryMap.get(key) ?? null;

      // Yoksa yeni kategori oluştur
      if (!categoryId) {
        const newCat = await prisma.category.create({ data: { name: row.category.trim() } });
        categoryId = newCat.id;
        categoryMap.set(key, newCat.id);
      }
    }

    // Süre: dakika → saniye
    let duration = 0;
    if (row.duration_minutes?.trim()) {
      const mins = parseFloat(row.duration_minutes.trim());
      if (!isNaN(mins)) duration = Math.round(mins * 60);
    }

    try {
      await prisma.book.create({
        data: {
          title: row.title.trim(),
          author: row.author.trim(),
          narrator: row.narrator?.trim() || null,
          duration,
          description: row.description?.trim() || null,
          isbn: row.isbn?.trim() || null,
          categoryId,
          publishedAt: row.publish_date?.trim() ? new Date(row.publish_date.trim()) : null,
        },
      });
      results.created++;
    } catch {
      results.errors.push(row.title);
    }
  }

  return NextResponse.json(results);
}
