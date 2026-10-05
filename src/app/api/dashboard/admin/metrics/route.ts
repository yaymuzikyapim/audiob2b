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
    return { from: new Date(now.getFullYear(), q * 3, 1), to };
  }
  if (period === "year") {
    return { from: new Date(now.getFullYear(), 0, 1), to };
  }
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
  const trendFrom = new Date(now.getTime() - 12 * 7 * 86400000);

  const [companyUsers, company, invitesSentCount, firstV2] = await Promise.all([
    prisma.user.findMany({
      where: { companyId, isActive: true },
      select: { id: true },
    }),
    prisma.company.findUnique({
      where: { id: companyId },
      select: { name: true, brandColor: true, maxSeats: true, logoUrl: true, endDate: true },
    }),
    // Toplam gönderilmiş davet sayısı
    prisma.inviteToken.count({ where: { companyId } }),
    prisma.playHistory.findFirst({
      where: { user: { companyId }, clientVersion: 2 },
      orderBy: { playedAt: "asc" },
      select: { playedAt: true },
    }),
  ]);

  const userIds = companyUsers.map((u) => u.id);
  // Huni: "Davet kabul edildi" = şirketteki aktif kullanıcı sayısı (davetsiz eklenenler dahil)
  const invitesAccepted = userIds.length;

  const [rawHistory, rawHistoryAll] = await Promise.all([
    prisma.playHistory.findMany({
      where: { userId: { in: userIds }, clientVersion: 2, playedAt: { gte: from, lte: to } },
      select: { userId: true, bookId: true, chapterId: true, listenedSec: true, completedPct: true, playedAt: true },
    }),
    prisma.playHistory.findMany({
      where: { userId: { in: userIds }, clientVersion: 2, playedAt: { gte: trendFrom, lte: now } },
      select: { userId: true, bookId: true, chapterId: true, listenedSec: true, completedPct: true, playedAt: true },
    }),
  ]);

  const toRow = (r: typeof rawHistory[0]): MetricRow => ({
    userId: r.userId,
    bookId: r.bookId,
    chapterId: r.chapterId,
    listenedSec: r.listenedSec,
    completedPct: r.completedPct,
    playedAt: r.playedAt,
  });

  const rows = rawHistory.map(toRow);
  const trendRows = rawHistoryAll.map(toRow);

  // Chapter listesi: dönemdeki kitapların bölüm sayıları
  const bookIds = [...new Set(rows.filter(r => r.chapterId).map(r => r.bookId))];
  const chapters = bookIds.length > 0
    ? await prisma.chapter.findMany({ where: { bookId: { in: bookIds } }, select: { bookId: true, id: true } })
    : [];
  const chaptersByBook = new Map<string, Set<string>>();
  for (const ch of chapters) {
    if (!chaptersByBook.has(ch.bookId)) chaptersByBook.set(ch.bookId, new Set());
    chaptersByBook.get(ch.bookId)!.add(ch.id);
  }

  // Top 5 kitap
  const top5Raw = topBooks(rows, from, to, 5);
  const top5BookIds = top5Raw.map(b => b.bookId);
  const bookTitles = top5BookIds.length > 0
    ? await prisma.book.findMany({ where: { id: { in: top5BookIds } }, select: { id: true, title: true, author: true, coverUrl: true } })
    : [];
  const bookMap = new Map(bookTitles.map(b => [b.id, b]));
  const maxListenedSec = Math.max(1, ...top5Raw.map(b => b.listenedSec));
  const top5 = top5Raw.map(b => ({
    ...b,
    title: bookMap.get(b.bookId)?.title ?? "—",
    author: bookMap.get(b.bookId)?.author ?? "",
    coverUrl: bookMap.get(b.bookId)?.coverUrl ?? null,
    pct: Math.round((b.listenedSec / maxListenedSec) * 100),
  }));

  const trend = weeklyTrend(trendRows, 12, now);
  const funnel = funnelMetrics(
    company?.maxSeats ?? 0,
    invitesSentCount,
    invitesAccepted,
    trendRows,
    new Date(0),
    now
  );

  return NextResponse.json({
    period,
    from: from.toISOString(),
    to: to.toISOString(),
    company: company ? { ...company, endDate: company.endDate.toISOString() } : null,
    activeListeners: countActiveListeners(rows, from, to),
    totalListenedSec: sumListenedSec(rows, from, to),
    completedBooks: countCompletedBooks(rows, from, to, chaptersByBook),
    totalSeats: company?.maxSeats ?? 0,
    occupiedSeats: userIds.length,
    pendingInvites: Math.max(0, invitesSentCount - invitesAccepted),
    firstV2Date: firstV2?.playedAt?.toISOString() ?? null,
    trend,
    funnel,
    topBooks: top5,
  });
}
