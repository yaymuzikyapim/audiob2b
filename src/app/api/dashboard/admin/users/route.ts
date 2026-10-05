import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

export async function GET(req: Request) {
  const auth = await requireUser({ roles: ["COMPANY_ADMIN"] });
  if (!auth.ok) return auth.response;
  const { user } = auth;
  const companyId = user.companyId!;

  const url = new URL(req.url);
  const tab = url.searchParams.get("tab") ?? "all"; // all | active | inactive | pending | never
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"));
  const q = url.searchParams.get("q")?.trim() ?? "";
  const rol = url.searchParams.get("rol") ?? ""; // EMPLOYEE | COMPANY_ADMIN
  const lastPlayed = url.searchParams.get("lastPlayed") ?? "any"; // any | recent7 | stale30 | never
  const skip = (page - 1) * PAGE_SIZE;
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);

  // Davet bekleniyor sekmesi
  if (tab === "pending") {
    const where = {
      companyId,
      usedAt: null,
      expiresAt: { gt: now },
    };
    const [total, items] = await Promise.all([
      prisma.inviteToken.count({ where }),
      prisma.inviteToken.findMany({
        where,
        skip,
        take: PAGE_SIZE,
        orderBy: { createdAt: "desc" },
        select: { id: true, email: true, role: true, expiresAt: true, createdAt: true },
      }),
    ]);
    return NextResponse.json({ tab, total, page, pageSize: PAGE_SIZE, items, type: "invite" });
  }

  // ID filtresi: "never" tab veya lastPlayed filtresi için önceden hesaplanır
  let idNotIn: string[] | undefined;
  let idIn: string[] | undefined;

  if (tab === "never") {
    // Aktif kullanıcılar arasında hiç v2 PlayHistory olmayanlar
    const withHistory = await prisma.playHistory.findMany({
      where: { user: { companyId }, clientVersion: 2 },
      distinct: ["userId"],
      select: { userId: true },
    });
    idNotIn = withHistory.map((h) => h.userId);
  } else if (lastPlayed === "recent7") {
    const recent = await prisma.playHistory.findMany({
      where: { user: { companyId }, clientVersion: 2, playedAt: { gte: sevenDaysAgo } },
      distinct: ["userId"],
      select: { userId: true },
    });
    idIn = recent.map((h) => h.userId);
  } else if (lastPlayed === "stale30") {
    const recent30 = await prisma.playHistory.findMany({
      where: { user: { companyId }, clientVersion: 2, playedAt: { gte: thirtyDaysAgo } },
      distinct: ["userId"],
      select: { userId: true },
    });
    idNotIn = recent30.map((h) => h.userId);
  } else if (lastPlayed === "never") {
    const withHistory = await prisma.playHistory.findMany({
      where: { user: { companyId }, clientVersion: 2 },
      distinct: ["userId"],
      select: { userId: true },
    });
    idNotIn = withHistory.map((h) => h.userId);
  }

  // Where koşulu
  const baseWhere: Prisma.UserWhereInput = { companyId };
  if (tab === "active" || tab === "never") baseWhere.isActive = true;
  if (tab === "inactive") baseWhere.isActive = false;
  if (rol === "EMPLOYEE") baseWhere.role = "EMPLOYEE";
  if (rol === "COMPANY_ADMIN") baseWhere.role = "COMPANY_ADMIN";
  if (idIn !== undefined) baseWhere.id = { in: idIn };
  else if (idNotIn !== undefined) baseWhere.id = { notIn: idNotIn };

  const andConditions: Prisma.UserWhereInput[] = [baseWhere];
  if (q) {
    andConditions.push({
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
      ],
    });
  }

  const finalWhere: Prisma.UserWhereInput = andConditions.length > 1 ? { AND: andConditions } : baseWhere;

  const [total, items] = await Promise.all([
    prisma.user.count({ where: finalWhere }),
    prisma.user.findMany({
      where: finalWhere,
      skip,
      take: PAGE_SIZE,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    }),
  ]);

  // Per-user: lastPlayedAt + listenedSec30d
  const itemIds = items.map((u) => u.id);
  const [lastPlayedGroups, listened30dGroups] = await Promise.all([
    itemIds.length > 0
      ? prisma.playHistory.groupBy({
          by: ["userId"],
          where: { userId: { in: itemIds }, clientVersion: 2 },
          _max: { playedAt: true },
        })
      : Promise.resolve([]),
    itemIds.length > 0
      ? prisma.playHistory.groupBy({
          by: ["userId"],
          where: { userId: { in: itemIds }, clientVersion: 2, playedAt: { gte: thirtyDaysAgo } },
          _sum: { listenedSec: true },
        })
      : Promise.resolve([]),
  ]);

  const lastPlayedMap = new Map(lastPlayedGroups.map((g) => [g.userId, g._max.playedAt]));
  const listened30dMap = new Map(listened30dGroups.map((g) => [g.userId, g._sum.listenedSec ?? 0]));

  const enrichedItems = items.map((u) => ({
    ...u,
    lastPlayedAt: lastPlayedMap.get(u.id)?.toISOString() ?? null,
    listenedSec30d: listened30dMap.get(u.id) ?? 0,
  }));

  return NextResponse.json({ tab, total, page, pageSize: PAGE_SIZE, items: enrichedItems, type: "user" });
}
