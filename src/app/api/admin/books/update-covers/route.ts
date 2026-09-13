export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

// { covers: [{ isbn: string; coverUrl: string }] }
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }

  const { covers }: { covers: { isbn: string; coverUrl: string }[] } = await req.json();
  if (!covers || !Array.isArray(covers) || covers.length === 0) {
    return NextResponse.json({ error: "Geçersiz veri." }, { status: 400 });
  }

  const valid = covers.filter((c) => c.isbn && c.coverUrl);
  if (valid.length === 0) return NextResponse.json({ updated: 0, skipped: covers.length });

  // Tek SQL sorgusu: CASE WHEN isbn = ? THEN ? ... WHERE isbn IN (?)
  const cases = valid.map((_, i) => `WHEN isbn = $${i * 2 + 1} THEN $${i * 2 + 2}::text`).join(" ");
  const isbns = valid.map((_, i) => `$${i * 2 + 1}`).join(", ");
  const params: string[] = [];
  for (const { isbn, coverUrl } of valid) {
    params.push(isbn, coverUrl);
  }

  const result = await prisma.$executeRawUnsafe(
    `UPDATE "Book" SET "coverUrl" = CASE ${cases} END WHERE isbn IN (${isbns})`,
    ...params
  );

  return NextResponse.json({ updated: result, skipped: covers.length - valid.length });
}
