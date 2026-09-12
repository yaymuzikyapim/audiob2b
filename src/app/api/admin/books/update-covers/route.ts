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

  let updated = 0;
  let skipped = 0;

  for (const { isbn, coverUrl } of covers) {
    if (!isbn || !coverUrl) { skipped++; continue; }
    const result = await prisma.book.updateMany({
      where: { isbn },
      data: { coverUrl },
    });
    updated += result.count;
    if (result.count === 0) skipped++;
  }

  return NextResponse.json({ updated, skipped });
}
