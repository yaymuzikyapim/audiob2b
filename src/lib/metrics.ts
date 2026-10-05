/**
 * Müşteri Admin Paneli metrik fonksiyonları
 * Tüm sorgular yalnızca clientVersion=2 kayıtlarını kullanır.
 * Birim test: npx tsx src/lib/metrics.test.ts
 */

export interface MetricRow {
  userId: string;
  bookId: string;
  listenedSec: number;
  completedPct: number;
  playedAt: Date;
}

// ── Aktif dinleyici ────────────────────────────────────────────────────────────
// Belirtilen tarih aralığında en az 1 v2 kaydı olan kullanıcı sayısı
export function countActiveListeners(rows: MetricRow[], from: Date, to: Date): number {
  const seen = new Set<string>();
  for (const r of rows) {
    if (r.playedAt >= from && r.playedAt <= to) seen.add(r.userId);
  }
  return seen.size;
}

// ── Toplam dinleme süresi ──────────────────────────────────────────────────────
// SUM(listenedSec) — saniye cinsinden
export function sumListenedSec(rows: MetricRow[], from: Date, to: Date): number {
  let total = 0;
  for (const r of rows) {
    if (r.playedAt >= from && r.playedAt <= to) total += r.listenedSec;
  }
  return total;
}

// ── Tamamlanan kitap sayısı ────────────────────────────────────────────────────
// Bir kullanıcı+kitap çifti için PlayHistory kayıtları arasında max(completedPct) ≥ 90
// olan her benzersiz userId+bookId kombinasyonu "tamamlandı" sayılır.
// Not: clientVersion=2 ile gelen completedPct o kitapta ulaşılan kümülatif
// tamamlanma yüzdesini temsil eder; ≥ 90 = tüm kitap büyük ölçüde dinlendi.
export function countCompletedBooks(rows: MetricRow[], from: Date, to: Date): number {
  const completed = new Set<string>();
  for (const r of rows) {
    if (r.playedAt < from || r.playedAt > to) continue;
    if (r.completedPct >= 90) {
      completed.add(`${r.userId}::${r.bookId}`);
    }
  }
  return completed.size;
}

// ── Haftalık trend ─────────────────────────────────────────────────────────────
// Son N haftayı Pazartesi başlangıçlı döndürür
export function weeklyTrend(
  rows: MetricRow[],
  weeks: number,
  now: Date
): Array<{ weekStart: string; listenedSec: number; activeUsers: number }> {
  const MS = 7 * 24 * 60 * 60 * 1000;
  const day = now.getUTCDay(); // 0=Pazar
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
export function funnelMetrics(
  totalSeats: number,
  invitesSent: number,
  invitesAccepted: number,
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
  const activeInPeriod = countActiveListeners(rows, from, to);
  // Hiç dinlememiş = davet kabul etmiş ama hiç v2 kaydı yok
  const everPlayedUsers = new Set(rows.map((r) => r.userId));
  const hasPlayedEver = everPlayedUsers.size;
  const neverPlayed = Math.max(0, invitesAccepted - hasPlayedEver);
  return { seats: totalSeats, invitesSent, invitesAccepted, hasPlayedEver, activeInPeriod, neverPlayed };
}
