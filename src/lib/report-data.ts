import { prisma } from "@/lib/prisma";
import { countActiveListeners, sumListenedSec, countCompletedBooks, type MetricRow } from "@/lib/metrics";

export type ReportSummary = { totalListenedSec: number; activeListeners: number; distinctBooks: number; completedBooks: number };
export type DailyChartPoint = { date: string; listeners: number; weekend: boolean };
export type BookRow = { bookId: string; title: string; author: string; totalDurationSec: number; listeners: number; listenedSec: number; completedCount: number; completedPct: number; avgProgress: number };
export type UserRow = { userId: string; name: string | null; email: string; listenedSec: number; distinctBooks: number; lastPlayedAt: string; avgProgress: number };
export type CompanyInfo = { name: string; brandColor: string | null; maxSeats: number; endDate: string };
export type ReportData = {
  period: string; from: string; to: string;
  company: CompanyInfo | null;
  summary: ReportSummary;
  dailyChart: DailyChartPoint[];
  books: BookRow[];
  users: UserRow[];
  firstChapterDate: string | null;
  firstV2Date: string | null;
};

export function parsePeriod(period: string, customFrom: string | null, customTo: string | null, now = new Date()): { from: Date; to: Date } {
  if (period === "custom" && customFrom && customTo) {
    return { from: new Date(customFrom + "T00:00:00Z"), to: new Date(customTo + "T23:59:59Z") };
  }
  if (period === "quarter") {
    const q = Math.floor(now.getUTCMonth() / 3);
    return { from: new Date(Date.UTC(now.getUTCFullYear(), q * 3, 1)), to: now };
  }
  if (period === "year") {
    return { from: new Date(Date.UTC(now.getUTCFullYear(), 0, 1)), to: now };
  }
  return { from: new Date(now.getTime() - 30 * 86400000), to: now };
}

export async function computeReportData(companyId: string, from: Date, to: Date, period: string): Promise<ReportData> {
  const [companyUsers, company, firstChapter, firstV2] = await Promise.all([
    prisma.user.findMany({ where: { companyId, isActive: true }, select: { id: true } }),
    prisma.company.findUnique({ where: { id: companyId }, select: { name: true, brandColor: true, maxSeats: true, endDate: true } }),
    prisma.playHistory.findFirst({ where: { user: { companyId }, clientVersion: 2, chapterId: { not: null } }, orderBy: { playedAt: "asc" }, select: { playedAt: true } }),
    prisma.playHistory.findFirst({ where: { user: { companyId }, clientVersion: 2 }, orderBy: { playedAt: "asc" }, select: { playedAt: true } }),
  ]);

  const userIds = companyUsers.map(u => u.id);
  const rawHistory = await prisma.playHistory.findMany({
    where: { userId: { in: userIds }, clientVersion: 2, playedAt: { gte: from, lte: to } },
    select: { userId: true, bookId: true, chapterId: true, listenedSec: true, completedPct: true, playedAt: true },
  });
  const rows: MetricRow[] = rawHistory.map(r => ({ userId: r.userId, bookId: r.bookId, chapterId: r.chapterId, listenedSec: r.listenedSec, completedPct: r.completedPct, playedAt: r.playedAt }));

  // chaptersByBook
  const bookIds = [...new Set(rows.filter(r => r.chapterId).map(r => r.bookId))];
  const allChapters = bookIds.length > 0
    ? await prisma.chapter.findMany({ where: { bookId: { in: bookIds } }, select: { bookId: true, id: true, duration: true } })
    : [];
  const chaptersByBook = new Map<string, Set<string>>();
  const chapterDurationByBook = new Map<string, number>();
  for (const ch of allChapters) {
    if (!chaptersByBook.has(ch.bookId)) chaptersByBook.set(ch.bookId, new Set());
    chaptersByBook.get(ch.bookId)!.add(ch.id);
    chapterDurationByBook.set(ch.bookId, (chapterDurationByBook.get(ch.bookId) ?? 0) + ch.duration);
  }

  const activeListeners = countActiveListeners(rows, from, to);
  const totalListenedSec = sumListenedSec(rows, from, to);
  const completedBooks = countCompletedBooks(rows, from, to, chaptersByBook);
  const distinctBooks = new Set(rows.map(r => r.bookId)).size;

  // Daily chart
  const dailyActiveMap = new Map<string, Set<string>>();
  for (const r of rows) {
    const date = r.playedAt.toISOString().slice(0, 10);
    if (!dailyActiveMap.has(date)) dailyActiveMap.set(date, new Set());
    dailyActiveMap.get(date)!.add(r.userId);
  }
  const dailyChart: DailyChartPoint[] = [];
  const dayMs = 86400000;
  const dayCount = Math.min(Math.ceil((to.getTime() - from.getTime()) / dayMs) + 1, 366);
  for (let d = 0; d < dayCount; d++) {
    const dt = new Date(from.getTime() + d * dayMs);
    const dateStr = dt.toISOString().slice(0, 10);
    const dow = dt.getUTCDay();
    dailyChart.push({ date: dateStr, listeners: dailyActiveMap.get(dateStr)?.size ?? 0, weekend: dow === 0 || dow === 6 });
  }

  // Book breakdown
  // bookFallbackPct: max completedPct per (bookId, userId) for null-chapterId rows (fallback when no chapter data)
  const bookBasic = new Map<string, { listeners: Set<string>; listenedSec: number }>();
  const bookChapState = new Map<string, Map<string, Map<string, number>>>();
  const bookFallbackPct = new Map<string, Map<string, number>>(); // bookId → userId → maxPct
  for (const r of rows) {
    if (!bookBasic.has(r.bookId)) bookBasic.set(r.bookId, { listeners: new Set(), listenedSec: 0 });
    const b = bookBasic.get(r.bookId)!;
    b.listeners.add(r.userId);
    b.listenedSec += r.listenedSec;
    if (r.chapterId) {
      if (!bookChapState.has(r.bookId)) bookChapState.set(r.bookId, new Map());
      const bs = bookChapState.get(r.bookId)!;
      if (!bs.has(r.userId)) bs.set(r.userId, new Map());
      const us = bs.get(r.userId)!;
      if (r.completedPct > (us.get(r.chapterId) ?? 0)) us.set(r.chapterId, r.completedPct);
    } else {
      if (!bookFallbackPct.has(r.bookId)) bookFallbackPct.set(r.bookId, new Map());
      const bfp = bookFallbackPct.get(r.bookId)!;
      if (r.completedPct > (bfp.get(r.userId) ?? 0)) bfp.set(r.userId, r.completedPct);
    }
  }
  const allBookIds = [...bookBasic.keys()];
  const bookData = allBookIds.length > 0
    ? await prisma.book.findMany({ where: { id: { in: allBookIds } }, select: { id: true, title: true, author: true, duration: true } })
    : [];
  const bookDataMap = new Map(bookData.map(b => [b.id, b]));

  const books: BookRow[] = [...bookBasic.entries()]
    .map(([bookId, basic]) => {
      const listeners = basic.listeners.size;
      const bs = bookChapState.get(bookId);
      const chapters = chaptersByBook.get(bookId);
      let completedCount = 0; let totalProgress = 0; let usersWithChap = 0;
      if (bs && chapters && chapters.size > 0) {
        for (const [, us] of bs) {
          if ([...chapters].every(ch => (us.get(ch) ?? 0) >= 90)) completedCount++;
          const maxPcts = [...us.values()];
          if (maxPcts.length > 0) { totalProgress += maxPcts.reduce((a, b) => a + b, 0) / maxPcts.length; usersWithChap++; }
        }
      }
      // Fallback: use max completedPct when no chapter data exists for this book
      if (usersWithChap === 0) {
        const bfp = bookFallbackPct.get(bookId);
        if (bfp) { for (const pct of bfp.values()) { totalProgress += pct; usersWithChap++; } }
      }
      const meta = bookDataMap.get(bookId);
      return {
        bookId, title: meta?.title ?? "—", author: meta?.author ?? "",
        totalDurationSec: chapterDurationByBook.get(bookId) ?? meta?.duration ?? 0,
        listeners, listenedSec: basic.listenedSec,
        completedCount,
        completedPct: listeners > 0 ? Math.round(completedCount / listeners * 100) : 0,
        avgProgress: usersWithChap > 0 ? Math.round(totalProgress / usersWithChap) : 0,
      };
    })
    .sort((a, b) => b.listenedSec - a.listenedSec);

  // User breakdown
  // userFallbackPct: max completedPct per (userId, bookId) for null-chapterId rows
  const userBasic = new Map<string, { listenedSec: number; books: Set<string>; lastPlayedAt: Date }>();
  const userProgress = new Map<string, Map<string, Map<string, number>>>();
  const userFallbackPct = new Map<string, Map<string, number>>(); // userId → bookId → maxPct
  for (const r of rows) {
    if (!userBasic.has(r.userId)) userBasic.set(r.userId, { listenedSec: 0, books: new Set(), lastPlayedAt: r.playedAt });
    const u = userBasic.get(r.userId)!;
    u.listenedSec += r.listenedSec;
    u.books.add(r.bookId);
    if (r.playedAt > u.lastPlayedAt) u.lastPlayedAt = r.playedAt;
    if (r.chapterId) {
      if (!userProgress.has(r.userId)) userProgress.set(r.userId, new Map());
      const bm = userProgress.get(r.userId)!;
      if (!bm.has(r.bookId)) bm.set(r.bookId, new Map());
      const cm = bm.get(r.bookId)!;
      if (r.completedPct > (cm.get(r.chapterId) ?? 0)) cm.set(r.chapterId, r.completedPct);
    } else {
      if (!userFallbackPct.has(r.userId)) userFallbackPct.set(r.userId, new Map());
      const ufp = userFallbackPct.get(r.userId)!;
      if (r.completedPct > (ufp.get(r.bookId) ?? 0)) ufp.set(r.bookId, r.completedPct);
    }
  }
  const userDataArr = userBasic.size > 0
    ? await prisma.user.findMany({ where: { id: { in: [...userBasic.keys()] } }, select: { id: true, name: true, email: true } })
    : [];
  const userDataMap = new Map(userDataArr.map(u => [u.id, u]));

  const users: UserRow[] = [...userBasic.entries()]
    .map(([userId, basic]) => {
      const bm = userProgress.get(userId);
      let totalProgress = 0; let booksWithChap = 0;
      if (bm) { for (const [, cm] of bm) { const maxPcts = [...cm.values()]; if (maxPcts.length > 0) { totalProgress += maxPcts.reduce((a, b) => a + b, 0) / maxPcts.length; booksWithChap++; } } }
      // Fallback: use max completedPct per book when no chapter data
      if (booksWithChap === 0) {
        const ufp = userFallbackPct.get(userId);
        if (ufp) { for (const pct of ufp.values()) { totalProgress += pct; booksWithChap++; } }
      }
      const meta = userDataMap.get(userId);
      return { userId, name: meta?.name ?? null, email: meta?.email ?? "", listenedSec: basic.listenedSec, distinctBooks: basic.books.size, lastPlayedAt: basic.lastPlayedAt.toISOString(), avgProgress: booksWithChap > 0 ? Math.round(totalProgress / booksWithChap) : 0 };
    })
    .sort((a, b) => b.listenedSec - a.listenedSec);

  return {
    period, from: from.toISOString(), to: to.toISOString(),
    company: company ? { name: company.name, brandColor: company.brandColor, maxSeats: company.maxSeats, endDate: company.endDate.toISOString() } : null,
    summary: { totalListenedSec, activeListeners, distinctBooks, completedBooks },
    dailyChart, books, users,
    firstChapterDate: firstChapter?.playedAt?.toISOString() ?? null,
    firstV2Date: firstV2?.playedAt?.toISOString() ?? null,
  };
}
