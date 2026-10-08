const LOCALE = "tr-TR";
const TZ = "Europe/Istanbul";

function fmt(d: Date | string | null | undefined, opts: Intl.DateTimeFormatOptions): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat(LOCALE, { ...opts, timeZone: TZ }).format(new Date(d));
}

/** "9 Eki 2026" */
export function fmtDate(d: Date | string | null | undefined): string {
  return fmt(d, { day: "numeric", month: "short", year: "numeric" });
}

/** "9 Eki 2026 00:58" */
export function fmtDateTime(d: Date | string | null | undefined): string {
  return fmt(d, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** "9 Ekim 2026" */
export function fmtLongDate(d: Date | string | null | undefined): string {
  return fmt(d, { day: "numeric", month: "long", year: "numeric" });
}

/** "9 Eki 00:58"  (yılsız, zaman damgası yerine kısa referans) */
export function fmtDayMonth(d: Date | string | null | undefined): string {
  return fmt(d, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** "09.10.2026 00:58"  (GG.AA.YYYY SS:DD — tekil sütun alanları için) */
export function fmtShortDateTime(d: Date | string | null | undefined): string {
  return fmt(d, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
