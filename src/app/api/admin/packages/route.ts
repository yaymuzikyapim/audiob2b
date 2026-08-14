export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }

  const packages = await prisma.package.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { books: true, companies: true } },
    },
  });

  return NextResponse.json(packages);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }

  const { name, description } = await req.json();
  if (!name) return NextResponse.json({ error: "Paket adı zorunlu." }, { status: 400 });

  const pkg = await prisma.package.create({ data: { name, description: description || null } });
  return NextResponse.json(pkg, { status: 201 });
}
