export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getActiveAccess } from "@/lib/access";
import { getPlayUrl } from "@/lib/s3";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role === "SUPER_ADMIN") {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }

  // user.isActive + company.isActive + endDate — tek sorgu, companyId token'dan değil DB'den
  const access = await getActiveAccess(session.id);
  if (!access.ok) return access.response;
  const { packageId } = access.data;

  const key = req.nextUrl.searchParams.get("key");
  if (!key) return NextResponse.json({ error: "key gerekli." }, { status: 400 });

  const chapter = await prisma.chapter.findFirst({ where: { s3Key: key } });
  if (!chapter) return NextResponse.json({ error: "Bulunamadı." }, { status: 404 });

  const inPackage = await prisma.packageBook.findUnique({
    where: { packageId_bookId: { packageId, bookId: chapter.bookId } },
  });

  if (!inPackage) return NextResponse.json({ error: "Bu kitap paketinizde değil." }, { status: 403 });

  const url = await getPlayUrl(key);
  return NextResponse.json({ url });
}
