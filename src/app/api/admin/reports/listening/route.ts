export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }

  const year = parseInt(req.nextUrl.searchParams.get("year") || String(new Date().getFullYear()));
  const month = parseInt(req.nextUrl.searchParams.get("month") || String(new Date().getMonth() + 1));

  const from = new Date(year, month - 1, 1);
  const to = new Date(year, month, 1);

  // Kitap bazlı
  const byBook = await prisma.playHistory.groupBy({
    by: ["bookId"],
    where: { playedAt: { gte: from, lt: to } },
    _sum: { listenedSec: true },
    _count: { userId: true },
  });

  const bookIds = byBook.map((r) => r.bookId);
  const books = await prisma.book.findMany({
    where: { id: { in: bookIds } },
    select: { id: true, title: true, author: true },
  });
  const bookMap = Object.fromEntries(books.map((b) => [b.id, b]));

  const bookReport = byBook
    .map((r) => ({
      bookId: r.bookId,
      title: bookMap[r.bookId]?.title ?? "—",
      author: bookMap[r.bookId]?.author ?? "—",
      listenedSec: r._sum.listenedSec ?? 0,
      userCount: r._count.userId,
    }))
    .sort((a, b) => b.listenedSec - a.listenedSec);

  // Şirket bazlı (user → company üzerinden)
  const byUser = await prisma.playHistory.groupBy({
    by: ["userId"],
    where: { playedAt: { gte: from, lt: to } },
    _sum: { listenedSec: true },
  });

  const userIds = byUser.map((r) => r.userId);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, companyId: true },
  });

  const companyListenMap: Record<string, number> = {};
  for (const u of users) {
    if (!u.companyId) continue;
    const sec = byUser.find((r) => r.userId === u.id)?._sum.listenedSec ?? 0;
    companyListenMap[u.companyId] = (companyListenMap[u.companyId] ?? 0) + sec;
  }

  const companyIds = Object.keys(companyListenMap);
  const companies = await prisma.company.findMany({
    where: { id: { in: companyIds } },
    select: { id: true, name: true },
  });

  // Her şirketin en çok dinlediği kitap
  const topBookByCompany: Record<string, string> = {};
  for (const companyId of companyIds) {
    const companyUserIds = users.filter((u) => u.companyId === companyId).map((u) => u.id);
    const top = await prisma.playHistory.groupBy({
      by: ["bookId"],
      where: { userId: { in: companyUserIds }, playedAt: { gte: from, lt: to } },
      _sum: { listenedSec: true },
      orderBy: { _sum: { listenedSec: "desc" } },
      take: 1,
    });
    if (top[0]) {
      const b = bookMap[top[0].bookId];
      topBookByCompany[companyId] = b?.title ?? top[0].bookId;
    }
  }

  const companyReport = companies
    .map((c) => ({
      companyId: c.id,
      name: c.name,
      listenedSec: companyListenMap[c.id] ?? 0,
      topBook: topBookByCompany[c.id] ?? "—",
    }))
    .sort((a, b) => b.listenedSec - a.listenedSec);

  return NextResponse.json({ bookReport, companyReport, year, month });
}
