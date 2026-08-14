export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { chapterS3Key, getUploadUrl, deleteFile } from "@/lib/s3";

// Bölüm listesi + upload URL al
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }

  const { id: bookId } = await params;
  const { title, order, duration, ext = "mp3" } = await req.json();

  if (!title || order == null) {
    return NextResponse.json({ error: "title ve order zorunlu." }, { status: 400 });
  }

  // Önce bölümü DB'ye ekle (s3Key sonra doldurulacak)
  const chapter = await prisma.chapter.create({
    data: {
      bookId,
      title,
      order: parseInt(order),
      duration: parseInt(duration),
      s3Key: "", // yükleme sonrası güncellenecek
    },
  });

  const s3Key = chapterS3Key(bookId, chapter.id, ext);

  // S3Key'i güncelle
  await prisma.chapter.update({ where: { id: chapter.id }, data: { s3Key } });

  // Presigned upload URL üret
  const uploadUrl = await getUploadUrl(s3Key, ext === "m4a" ? "audio/mp4" : "audio/mpeg");

  return NextResponse.json({ chapter: { ...chapter, s3Key }, uploadUrl }, { status: 201 });
}

// Bölüm sil
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }

  const { id: bookId } = await params;
  const { chapterId } = await req.json();

  const chapter = await prisma.chapter.findUnique({ where: { id: chapterId } });
  if (!chapter || chapter.bookId !== bookId) {
    return NextResponse.json({ error: "Bulunamadı." }, { status: 404 });
  }

  if (chapter.s3Key) {
    try { await deleteFile(chapter.s3Key); } catch {}
  }

  await prisma.chapter.delete({ where: { id: chapterId } });
  return NextResponse.json({ ok: true });
}
