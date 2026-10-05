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

export async function GET(req: Request) {
  const auth = await requireUser({ roles: ["COMPANY_ADMIN"] });
  if (!auth.ok) return auth.response;
  const { user } = auth;

  const companyId = user.companyId!;
  const url = new URL(req.url);
  const period = url.searchParams.get("period") ?? "30d";

  const now = new Date();
  let from: Date;
  if (period === "7d") {
    from = new Date(now.getTime() - 7 * 86400000);
  } else if (period === "90d") {
    from = new Date(now.getTime() - 90 * 86400000);
  } else {
    from = new Date(now.getTime() - 30 * 86400000);
  }

  // Şirketteki tüm kullanıcılar
  const companyUsers = await prisma.user.findMany({
    where: { companyId, isActive: true },
    select: { id: true },
  });
  const userIds = companyUsers.map((u) => u.id);

  const [company, rawHistory, topBooksData] = await Promise.all([
    prisma.company.findUnique({
      where: { id: companyId },
      select: { name: true, brandColor: true, maxSeats: true, logoUrl: true },
    }),
    prisma.playHistory.findMany({
      where: {
        userId: { in: userIds },
        clientVersion: 2,
        playedAt: { gte: from, lte: now },
      },
      select: {
        userId: true,
        bookId: true,
        listenedSec: true,
        completedPct: true,
        playedAt: true,
      },
    }),
    // Top books için başlık bilgisi
    prisma.playHistory.findMany({
      where: { userId: { in: userIds }, clientVersion: 2, playedAt: { gte: from, lte: now } },
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

  const chaptersByBook = new Map<string, number>(); // topBooks için basit geçiş

  const top5BookIds = topBooks(rows, from, now, 5).map((b) => b.bookId);
  const bookTitles = await prisma.book.findMany({
    where: { id: { in: top5BookIds } },
    select: { id: true, title: true, author: true, coverUrl: true },
  });
  const bookMap = new Map(bookTitles.map((b) => [b.id, b]));

  const top5 = topBooks(rows, from, now, 5).map((b) => ({
    ...b,
    title: bookMap.get(b.bookId)?.title ?? "—",
    author: bookMap.get(b.bookId)?.author ?? "",
    coverUrl: bookMap.get(b.bookId)?.coverUrl ?? null,
  }));

  const trend = weeklyTrend(rows, 8, now);
  const funnel = funnelMetrics(company?.maxSeats ?? 0, rows, from, now, chaptersByBook);

  return NextResponse.json({
    period,
    company,
    activeListeners: countActiveListeners(rows, from, now),
    totalListenedSec: sumListenedSec(rows, from, now),
    completedBooks: countCompletedBooks(rows, from, now, chaptersByBook),
    totalSeats: company?.maxSeats ?? 0,
    occupiedSeats: userIds.length,
    trend,
    funnel,
    topBooks: top5,
  });
}
