export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getPlayUrl } from "@/lib/s3";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role === "SUPER_ADMIN" || !session.companyId) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }

  const key = req.nextUrl.searchParams.get("key");
  if (!key) return NextResponse.json({ error: "key gerekli." }, { status: 400 });

  // key'in gerçekten şirketin paketindeki bir kitaba ait olduğunu doğrula
  const chapter = await prisma.chapter.findFirst({ where: { s3Key: key } });
  if (!chapter) return NextResponse.json({ error: "Bulunamadı." }, { status: 404 });

  const company = await prisma.company.findUnique({
    where: { id: session.companyId },
    select: { packageId: true, isActive: true },
  });

  if (!company?.isActive || !company.packageId) {
    return NextResponse.json({ error: "Erişim yok." }, { status: 403 });
  }

  const inPackage = await prisma.packageBook.findUnique({
    where: { packageId_bookId: { packageId: company.packageId, bookId: chapter.bookId } },
  });

  if (!inPackage) return NextResponse.json({ error: "Bu kitap paketinizde değil." }, { status: 403 });

  const url = await getPlayUrl(key);
  return NextResponse.json({ url });
}
