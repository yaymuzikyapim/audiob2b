export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  let visitorId: string;
  try {
    const body = await req.json();
    visitorId = typeof body.visitorId === "string" ? body.visitorId.slice(0, 64) : "";
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  if (!visitorId) return NextResponse.json({ ok: false }, { status: 400 });

  const link = await prisma.proposalLink.findUnique({
    where: { token },
    select: { id: true, expiresAt: true },
  });
  if (!link || link.expiresAt < new Date()) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  const now = new Date();
  await prisma.proposalLinkVisitor.upsert({
    where: { linkId_visitorId: { linkId: link.id, visitorId } },
    create: { linkId: link.id, visitorId, firstSeenAt: now, lastSeenAt: now, views: 1 },
    update: { lastSeenAt: now, views: { increment: 1 } },
  });

  return NextResponse.json({ ok: true });
}
