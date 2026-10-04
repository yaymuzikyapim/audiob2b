export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-guard";

export async function GET() {
  const auth = await requireUser({ roles: ["COMPANY_ADMIN", "EMPLOYEE"] });
  if (!auth.ok) return auth.response;
  const { user } = auth;

  const favorites = await prisma.userFavorite.findMany({
    where: { userId: user.id },
    select: { bookId: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ favorites });
}

export async function POST(req: NextRequest) {
  const auth = await requireUser({ roles: ["COMPANY_ADMIN", "EMPLOYEE"] });
  if (!auth.ok) return auth.response;
  const { user } = auth;

  const { bookId } = await req.json();
  if (!bookId) return NextResponse.json({ error: "bookId gerekli." }, { status: 400 });

  const favorite = await prisma.userFavorite.upsert({
    where: { userId_bookId: { userId: user.id, bookId } },
    create: { userId: user.id, bookId },
    update: {},
  });

  return NextResponse.json({ favorite });
}
