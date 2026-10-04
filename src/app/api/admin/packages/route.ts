export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-guard";

export async function GET() {
  const auth = await requireUser({ roles: ["SUPER_ADMIN"] });
  if (!auth.ok) return auth.response;

  const packages = await prisma.package.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { books: true, companies: true } },
    },
  });

  return NextResponse.json(packages);
}

export async function POST(req: NextRequest) {
  const auth = await requireUser({ roles: ["SUPER_ADMIN"] });
  if (!auth.ok) return auth.response;

  const { name, description } = await req.json();
  if (!name) return NextResponse.json({ error: "Paket adı zorunlu." }, { status: 400 });

  const pkg = await prisma.package.create({ data: { name, description: description || null } });
  return NextResponse.json(pkg, { status: 201 });
}
