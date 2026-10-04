export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

import { requireUser } from "@/lib/auth-guard";
import { getPlayUrl } from "@/lib/s3";

export async function GET(req: NextRequest) {
  const auth = await requireUser({ roles: ["COMPANY_ADMIN", "EMPLOYEE"] });
  if (!auth.ok) return auth.response;
  const { user } = auth;
  const packageId = user.company!.packageId!;

  const key = req.nextUrl.searchParams.get("key");
  if (!key) return NextResponse.json({ error: "key gerekli." }, { status: 400 });

  const chapter = await prisma.chapter.findFirst({ where: { s3Key: key } });
  if (!chapter) return NextResponse.json({ error: "Bulunamadı." }, { status: 404 });

  const inPackage = await prisma.packageBook.findUnique({
    where: { packageId_bookId: { packageId, bookId: chapter.bookId } },
  });

  if (!inPackage) return NextResponse.json({ error: "Bu kitap paketinizde değil." }, { status: 403 });

  const url = await getPlayUrl(key);
  return NextResponse.json({ url }, { headers: { "Cache-Control": "private, no-store" } });
}
