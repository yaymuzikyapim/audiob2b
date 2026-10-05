import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import {
  countActiveListeners,
  sumListenedSec,
  countCompletedBooks,
  weeklyTrend,
  topBooks,
  funnelMetrics,
  type MetricRow,
} from "@/lib/metrics";

export const dynamic = "force-dynamic";

function parsePeriod(period: string, now: Date): { from: Date; to: Date } {
  const to = now;
  if (period === "quarter") {
    const q = Math.floor(now.getMonth() / 3);
    const from = new Date(now.getFullYear(), q * 3, 1);
    return { from, to };
  }
  if (period === "year") {
    const from = new Date(now.getFullYear(), 0, 1);
    return { from, to };
  }
  // default: 30d
  return { from: new Date(now.getTime() - 30 * 86400000), to };
}

export async function GET(req: Request) {
  const auth = await requireUser({ roles: ["COMPANY_ADMIN"] });
  if (!auth.ok) return auth.response;
  const { user } = auth;

  const companyId = user.companyId!;
  const url = new URL(req.url);
  const period = url.searchParams.get("period") ?? "30d";
  const now = new Date();
  const { from, to } = parsePeriod(period, now);

  const [companyUsers, company, inviteStats, firstV2] = await Promise.all([
    prisma.user.findMany({
      where: { companyId, isActive: true },
      select: { id: true },
    }),
    prisma.company.findUnique({
      where: { id: companyId },
      select: { name: true, brandColor: true, maxSeats: true, logoUrl: true, endDate: true },
    }),
    // Davet istatistikleri
    prisma.inviteToken.groupBy({
      by: ["usedAt"],
      where: { companyId },
      _count: true,
    }),
    // İlk clientVersion=2 kaydının tarihi (dipnot için)
    prisma.playHistory.findFirst({
      where: {
        user: { companyId },
        clientVersion: 2,
      },
      orderBy: { playedAt: "asc" },
      select: { playedAt: true },
    }),
  ]);

  const userIds = companyUsers.map((u) => u.id);

  // Davet: gönderilen vs kabul edilen
  const invitesSent = inviteStats.reduce((s, g) => s + g._count, 0);
  const invitesAccepted = inviteStats
    .filter((g) => g.usedAt !== null)
    .reduce((s, g) => s + g._count, 0);
  const pendingInvites = invitesSent - invitesAccepted;

  // Trend için son 12 haftalık veri
  const trendFrom = new Date(now.getTime() - 12 * 7 * 86400000);

  const [rawHistory, rawHistoryAll, topBooksRaw] = await Promise.all([
    // Dönem içi kayıtlar (metrikler için)
    prisma.playHistory.findMany({
      where: {
        userId: { in: userIds },
        clientVersion: 2,
        playedAt: { gte: from, lte: to },
      },
      select: {
        userId: true,
        bookId: true,
        listenedSec: true,
        completedPct: true,
        playedAt: true,
      },
    }),
    // 12 haftalık trend verisi
    prisma.playHistory.findMany({
      where: {
        userId: { in: userIds },
        clientVersion: 2,
        playedAt: { gte: trendFrom, lte: now },
      },
      select: {
        userId: true,
        bookId: true,
        listenedSec: true,
        completedPct: true,
        playedAt: true,
      },
    }),
    // Top 5 kitap başlık bilgisi için distinct bookId listesi
    prisma.playHistory.findMany({
      where: { userId: { in: userIds }, clientVersion: 2, playedAt: { gte: from, lte: to } },
      select: { bookId: true },
      distinct: ["bookId"],
    }),
  ]);

  const rows: MetricRow[] = rawHistory.map((r) => ({
    userId: r.userId,
    bookId: r.bookId,
    listenedSec: r.listenedSec,
    completedPct: r.completedPct,
    playedAt: r.playedAt,
  }));

  const trendRows: MetricRow[] = rawHistoryAll.map((r) => ({
    userId: r.userId,
    bookId: r.bookId,
    listenedSec: r.listenedSec,
    completedPct: r.completedPct,
    playedAt: r.playedAt,
  }));

  const top5BookIds = topBooks(rows, from, to, 5).map((b) => b.bookId);
  const bookTitles = await prisma.book.findMany({
    where: { id: { in: top5BookIds } },
    select: { id: true, title: true, author: true, coverUrl: true },
  });
  const bookMap = new Map(bookTitles.map((b) => [b.id, b]));

  const maxListenedSec = Math.max(1, ...topBooks(rows, from, to, 5).map((b) => b.listenedSec));
  const top5 = topBooks(rows, from, to, 5).map((b) => ({
    ...b,
    title: bookMap.get(b.bookId)?.title ?? "—",
    author: bookMap.get(b.bookId)?.author ?? "",
    coverUrl: bookMap.get(b.bookId)?.coverUrl ?? null,
    pct: Math.round((b.listenedSec / maxListenedSec) * 100),
  }));

  const trend = weeklyTrend(trendRows, 12, now);
  const funnel = funnelMetrics(
    company?.maxSeats ?? 0,
    invitesSent,
    invitesAccepted,
    trendRows, // tüm geçmiş, "hiç dinlemedi" doğru hesaplansın
    new Date(0), // başlangıçtan beri
    now
  );

  return NextResponse.json({
    period,
    from: from.toISOString(),
    to: to.toISOString(),
    company: company
      ? { ...company, endDate: company.endDate.toISOString() }
      : null,
    activeListeners: countActiveListeners(rows, from, to),
    totalListenedSec: sumListenedSec(rows, from, to),
    completedBooks: countCompletedBooks(rows, from, to),
    totalSeats: company?.maxSeats ?? 0,
    occupiedSeats: userIds.length,
    pendingInvites,
    firstV2Date: firstV2?.playedAt?.toISOString() ?? null,
    trend,
    funnel,
    topBooks: top5,
  });
}
