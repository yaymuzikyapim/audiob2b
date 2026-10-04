export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-guard";
import { deleteFile } from "@/lib/s3";

function extractOwnS3Key(url: string | null | undefined): string | null {
  if (!url) return null;
  const cfBase = process.env.CLOUDFRONT_URL?.replace(/\/$/, "");
  if (cfBase && url.startsWith(cfBase + "/")) return url.slice(cfBase.length + 1);
  const bucket = process.env.AWS_S3_BUCKET;
  if (bucket) {
    // https://bucket.s3[.region].amazonaws.com/key
    const m1 = url.match(new RegExp(`^https://${bucket}\\.s3[^/]*/(.+)$`));
    if (m1) return m1[1];
    // https://s3[.region].amazonaws.com/bucket/key
    const m2 = url.match(new RegExp(`^https://s3[^/]*/(?:[^/]+/)?${bucket}/(.+)$`));
    if (m2) return m2[1];
  }
  return null;
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser({ roles: ["SUPER_ADMIN"] });
  if (!auth.ok) return auth.response;

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
  const auth = await requireUser({ roles: ["SUPER_ADMIN"] });
  if (!auth.ok) return auth.response;

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
      ...(body.seriesId !== undefined && { seriesId: body.seriesId || null }),
      ...(body.seriesOrder !== undefined && { seriesOrder: body.seriesOrder === "" ? null : parseInt(body.seriesOrder) }),
      ...(body.isActive !== undefined && { isActive: body.isActive }),
    },
  });

  return NextResponse.json(book);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser({ roles: ["SUPER_ADMIN"] });
  if (!auth.ok) return auth.response;

  const { id } = await params;

  // Silmeden önce temizlenecek S3 key'lerini belirle
  const book = await prisma.book.findUnique({
    where: { id },
    select: { coverUrl: true, chapters: { select: { s3Key: true } } },
  });
  if (!book) return NextResponse.json({ error: "Bulunamadı." }, { status: 404 });

  // Başka chapter tarafından kullanılmayan chapter key'lerini bul
  const chapterKeys = [...new Set(book.chapters.map((c) => c.s3Key).filter(Boolean) as string[])];
  const keysToDelete: string[] = [];
  for (const key of chapterKeys) {
    const count = await prisma.chapter.count({ where: { s3Key: key } });
    if (count <= 1) keysToDelete.push(key);
  }

  const coverKey = extractOwnS3Key(book.coverUrl);

  // DB'den sil (chapter cascade)
  await prisma.book.delete({ where: { id } });

  // Best-effort S3 temizliği
  const s3Errors: string[] = [];
  for (const key of keysToDelete) {
    try { await deleteFile(key); } catch (e) { s3Errors.push(`chapter ${key}: ${e}`); }
  }
  if (coverKey) {
    try { await deleteFile(coverKey); } catch (e) { s3Errors.push(`cover ${coverKey}: ${e}`); }
  }
  if (s3Errors.length) console.error("[book-delete] S3 silme hataları:", s3Errors.join("; "));

  return NextResponse.json({ ok: true });
}
