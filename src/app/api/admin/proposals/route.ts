export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-guard";
import { randomBytes } from "crypto";

export async function GET(req: NextRequest) {
  const auth = await requireUser({ roles: ["SUPER_ADMIN"] });
  if (!auth.ok) return auth.response;

  const links = await prisma.proposalLink.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      visitors: {
        orderBy: { firstSeenAt: "asc" },
        select: { visitorId: true, firstSeenAt: true, lastSeenAt: true, views: true },
      },
    },
  });

  const result = links.map((l) => ({
    id: l.id,
    token: l.token,
    label: l.label,
    slug: l.slug,
    expiresAt: l.expiresAt,
    createdAt: l.createdAt,
    totalViews: l.visitors.reduce((s, v) => s + v.views, 0),
    uniqueBrowsers: l.visitors.length,
    firstSeenAt: l.visitors[0]?.firstSeenAt ?? null,
    lastSeenAt: l.visitors.length > 0
      ? l.visitors.reduce((m, v) => (v.lastSeenAt > m ? v.lastSeenAt : m), l.visitors[0].lastSeenAt)
      : null,
    visitors: l.visitors,
  }));

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const auth = await requireUser({ roles: ["SUPER_ADMIN"] });
  if (!auth.ok) return auth.response;

  const { label, slug, daysValid } = await req.json();

  if (!label?.trim() || !slug?.trim() || !daysValid) {
    return NextResponse.json({ error: "label, slug ve daysValid gerekli." }, { status: 400 });
  }

  const token = randomBytes(16).toString("hex");
  const expiresAt = new Date(Date.now() + Number(daysValid) * 86_400_000);

  const link = await prisma.proposalLink.create({
    data: { token, label: label.trim(), slug: slug.trim(), expiresAt },
  });

  return NextResponse.json(link, { status: 201 });
}
