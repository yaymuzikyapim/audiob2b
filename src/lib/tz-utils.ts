// Europe/Istanbul = UTC+3, kalıcı (2016'dan beri DST yok)
export const TZ_OFFSET_MS = 3 * 3600 * 1000;

/** UTC içinde Istanbul gece yarısını döner.
 *  istanbulMidnightUTC(2026, 9, 1) → 2026-09-30T21:00:00.000Z */
export function istanbulMidnightUTC(year: number, month0: number, day: number): Date {
  return new Date(Date.UTC(year, month0, day) - TZ_OFFSET_MS);
}

/** playedAt gibi UTC tarih-saatlerini Istanbul YYYY-MM-DD'ye çevirir. */
export function toIstanbulDate(d: Date): string {
  return new Date(d.getTime() + TZ_OFFSET_MS).toISOString().slice(0, 10);
}

/** Şu anki Istanbul yılı ve ayı (0-indexed). */
export function nowIstanbul(now: Date): { year: number; month0: number } {
  const ist = new Date(now.getTime() + TZ_OFFSET_MS);
  return { year: ist.getUTCFullYear(), month0: ist.getUTCMonth() };
}

export function parsePeriod(
  period: string,
  customFrom: string | null,
  customTo: string | null,
  now = new Date(),
): { from: Date; to: Date } {
  if (period === "custom" && customFrom && customTo) {
    const [fy, fm, fd] = customFrom.split("-").map(Number);
    const [ty, tm, td] = customTo.split("-").map(Number);
    return {
      from: istanbulMidnightUTC(fy, fm - 1, fd),
      to: new Date(istanbulMidnightUTC(ty, tm - 1, td + 1).getTime() - 1),
    };
  }
  const { year, month0 } = nowIstanbul(now);
  if (period === "quarter") {
    const q = Math.floor(month0 / 3);
    return { from: istanbulMidnightUTC(year, q * 3, 1), to: now };
  }
  if (period === "year") {
    return { from: istanbulMidnightUTC(year, 0, 1), to: now };
  }
  // 30d: göreceli, gece yarısı sınırı yok
  return { from: new Date(now.getTime() - 30 * 86400000), to: now };
}
