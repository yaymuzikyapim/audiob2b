/**
 * Müşteri Admin Paneli metrik fonksiyonları
 * Tüm sorgular yalnızca clientVersion=2 kayıtlarını kullanır.
 * Birim test: npx tsx src/lib/metrics.test.ts
 */

export interface MetricRow {
  userId: string;
  bookId: string;
  chapterId: string | null;
  listenedSec: number;
  completedPct: number; // bölüm bazlı (chapterId varsa), aksi hâlde kitap bazlı
  playedAt: Date;
}

// ── Aktif dinleyici ────────────────────────────────────────────────────────────
export function countActiveListeners(rows: MetricRow[], from: Date, to: Date): number {
  const seen = new Set<string>();
  for (const r of rows) {
    if (r.playedAt >= from && r.playedAt <= to) seen.add(r.userId);
  }
  return seen.size;
}

// ── Toplam dinleme süresi ──────────────────────────────────────────────────────
export function sumListenedSec(rows: MetricRow[], from: Date, to: Date): number {
  let total = 0;
  for (const r of rows) {
    if (r.playedAt >= from && r.playedAt <= to) total += r.listenedSec;
  }
  return total;
}

// ── Tamamlanan kitap sayısı ────────────────────────────────────────────────────
// Bir (kullanıcı, kitap) tamamlanmış sayılır ancak o kitabın TÜM bölümleri için,
// kullanıcının o bölümdeki kayıtları arasında max(completedPct) ≥ 90 ise.
// chaptersByBook: bookId → Set<chapterId>
// chapterId'siz (null) kayıtlar göz ardı edilir; yalnızca v2 + chapterId'li kayıtlar geçerli.
export function countCompletedBooks(
  rows: MetricRow[],
  from: Date,
  to: Date,
  chaptersByBook: Map<string, Set<string>>
): number {
  // userBook → chapterId → max completedPct
  const state = new Map<string, Map<string, number>>();

  for (const r of rows) {
    if (!r.chapterId) continue;
    if (r.playedAt < from || r.playedAt > to) continue;
    const key = `${r.userId}::${r.bookId}`;
    if (!state.has(key)) state.set(key, new Map());
    const chMap = state.get(key)!;
    const prev = chMap.get(r.chapterId) ?? 0;
    if (r.completedPct > prev) chMap.set(r.chapterId, r.completedPct);
  }

  let count = 0;
  for (const [key, chMap] of state) {
    const bookId = key.split("::")[1];
    const chapters = chaptersByBook.get(bookId);
    if (!chapters || chapters.size === 0) continue;
    // Her bölümün max(completedPct) ≥ 90 olmalı
    const allDone = [...chapters].every((ch) => (chMap.get(ch) ?? 0) >= 90);
    if (allDone) count++;
  }
  return count;
}

// ── Haftalık trend ─────────────────────────────────────────────────────────────
export function weeklyTrend(
  rows: MetricRow[],
  weeks: number,
  now: Date
): Array<{ weekStart: string; listenedSec: number; activeUsers: number }> {
  const MS = 7 * 24 * 60 * 60 * 1000;
  const day = now.getUTCDay();
  const daysToMonday = day === 0 ? 6 : day - 1;
  const thisMonday = new Date(now.getTime() - daysToMonday * 86400000);
  thisMonday.setUTCHours(0, 0, 0, 0);

  const result: Array<{ weekStart: string; listenedSec: number; activeUsers: number }> = [];

  for (let i = weeks - 1; i >= 0; i--) {
    const from = new Date(thisMonday.getTime() - i * MS);
    const to = new Date(from.getTime() + MS);
    const weekStart = from.toISOString().slice(0, 10);

    let listenedSec = 0;
    const users = new Set<string>();
    for (const r of rows) {
      if (r.playedAt >= from && r.playedAt < to) {
        listenedSec += r.listenedSec;
        users.add(r.userId);
      }
    }
    result.push({ weekStart, listenedSec, activeUsers: users.size });
  }
  return result;
}

// ── En çok dinlenen kitaplar ───────────────────────────────────────────────────
export function topBooks(
  rows: MetricRow[],
  from: Date,
  to: Date,
  limit = 5
): Array<{ bookId: string; listenedSec: number; listenerCount: number }> {
  const bookMap = new Map<string, { listenedSec: number; listeners: Set<string> }>();
  for (const r of rows) {
    if (r.playedAt < from || r.playedAt > to) continue;
    const entry = bookMap.get(r.bookId) ?? { listenedSec: 0, listeners: new Set() };
    entry.listenedSec += r.listenedSec;
    entry.listeners.add(r.userId);
    bookMap.set(r.bookId, entry);
  }
  return [...bookMap.entries()]
    .map(([bookId, v]) => ({ bookId, listenedSec: v.listenedSec, listenerCount: v.listeners.size }))
    .sort((a, b) => b.listenedSec - a.listenedSec)
    .slice(0, limit);
}

// ── Huni metrikleri ───────────────────────────────────────────────────────────
// invitesAccepted: şirketteki toplam kullanıcı sayısı (davetsiz eklenenler dahil)
// invitesSent: gönderilen davet sayısı; en az kabul sayısı kadar olmalı (huni artmasın)
export function funnelMetrics(
  totalSeats: number,
  invitesSentRaw: number,
  invitesAccepted: number, // = şirketteki kullanıcı sayısı
  rows: MetricRow[],
  from: Date,
  to: Date
): {
  seats: number;
  invitesSent: number;
  invitesAccepted: number;
  hasPlayedEver: number;
  activeInPeriod: number;
  neverPlayed: number;
} {
  // Huni hiçbir adımda bir öncekinden büyük olamaz
  const invitesSent = Math.max(invitesSentRaw, invitesAccepted);
  const activeInPeriod = countActiveListeners(rows, from, to);
  const everPlayedUsers = new Set(rows.map((r) => r.userId));
  const hasPlayedEver = Math.min(everPlayedUsers.size, invitesAccepted);
  const neverPlayed = Math.max(0, invitesAccepted - hasPlayedEver);
  return { seats: totalSeats, invitesSent, invitesAccepted, hasPlayedEver, activeInPeriod, neverPlayed };
}
