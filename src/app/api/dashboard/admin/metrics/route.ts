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
import { parsePeriod } from "@/lib/tz-utils";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireUser({ roles: ["COMPANY_ADMIN"] });
  if (!auth.ok) return auth.response;
  const { user } = auth;

  const companyId = user.companyId!;
  const url = new URL(req.url);
  const period = url.searchParams.get("period") ?? "30d";
  const now = new Date();
  const { from, to } = parsePeriod(period, null, null, now);
  const trendFrom = new Date(now.getTime() - 12 * 7 * 86400000);

  const [companyUsers, company, invitesSentCount, firstV2, firstChapter] = await Promise.all([
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
    // Kitap tamamlama için chapterId içeren ilk v2 kaydın tarihi
    prisma.playHistory.findFirst({
      where: { user: { companyId }, clientVersion: 2, chapterId: { not: null } },
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

  // Önceki dönem (delta hesabı için)
  const periodMs = to.getTime() - from.getTime();
  const prevFrom = new Date(from.getTime() - periodMs);
  const prevTo = from;

  const rawHistoryPrev = await prisma.playHistory.findMany({
    where: { userId: { in: userIds }, clientVersion: 2, playedAt: { gte: prevFrom, lte: prevTo } },
    select: { userId: true, bookId: true, chapterId: true, listenedSec: true, completedPct: true, playedAt: true },
  });
  const prevRows = rawHistoryPrev.map(toRow);

  const prevBookIds = [...new Set(prevRows.filter(r => r.chapterId).map(r => r.bookId))];
  let prevChaptersByBook = chaptersByBook; // aynı kitap seti için yeniden kullan
  if (prevBookIds.some(id => !chaptersByBook.has(id))) {
    const prevChapters = await prisma.chapter.findMany({
      where: { bookId: { in: prevBookIds } }, select: { bookId: true, id: true }
    });
    prevChaptersByBook = new Map(chaptersByBook);
    for (const ch of prevChapters) {
      if (!prevChaptersByBook.has(ch.bookId)) prevChaptersByBook.set(ch.bookId, new Set());
      prevChaptersByBook.get(ch.bookId)!.add(ch.id);
    }
  }

  const prevActiveListeners = countActiveListeners(prevRows, prevFrom, prevTo);
  const prevTotalListenedSec = sumListenedSec(prevRows, prevFrom, prevTo);
  const prevCompletedBooks = countCompletedBooks(prevRows, prevFrom, prevTo, prevChaptersByBook);

  const curActiveListeners = countActiveListeners(rows, from, to);
  const curTotalListenedSec = sumListenedSec(rows, from, to);
  const curCompletedBooks = countCompletedBooks(rows, from, to, chaptersByBook);

  return NextResponse.json({
    period,
    from: from.toISOString(),
    to: to.toISOString(),
    company: company ? { ...company, endDate: company.endDate.toISOString() } : null,
    activeListeners: curActiveListeners,
    totalListenedSec: curTotalListenedSec,
    completedBooks: curCompletedBooks,
    totalSeats: company?.maxSeats ?? 0,
    occupiedSeats: userIds.length,
    pendingInvites: Math.max(0, invitesSentCount - invitesAccepted),
    firstV2Date: firstV2?.playedAt?.toISOString() ?? null,
    firstChapterDate: firstChapter?.playedAt?.toISOString() ?? null,
    trend,
    funnel,
    topBooks: top5,
    prev: {
      activeListeners: prevActiveListeners,
      totalListenedSec: prevTotalListenedSec,
      completedBooks: prevCompletedBooks,
    },
  });
}
