/**
 * Birim testleri: npx tsx src/lib/metrics.test.ts
 */

import {
  countActiveListeners,
  sumListenedSec,
  countCompletedBooks,
  weeklyTrend,
  topBooks,
  funnelMetrics,
} from "./metrics";
import type { MetricRow } from "./metrics";
import { parsePeriod } from "./tz-utils";

let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean, got?: unknown) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}${got !== undefined ? ` (got: ${JSON.stringify(got)})` : ""}`);
    failed++;
  }
}

const D = (s: string) => new Date(s + "Z");
const JAN1 = D("2026-01-01T10:00:00");
const JAN2 = D("2026-01-02T10:00:00");
const JAN8 = D("2026-01-08T10:00:00");
const FEB1 = D("2026-02-01T10:00:00");
const JAN_FROM = D("2026-01-01T00:00:00");
const JAN_TO   = D("2026-01-31T23:59:59");

// ── countActiveListeners ───────────────────────────────────────────────────────
console.log("\ncountActiveListeners:");
const lisRows: MetricRow[] = [
  { userId: "u1", bookId: "b1", chapterId: "c1", listenedSec: 3600, completedPct: 100, playedAt: JAN1 },
  { userId: "u2", bookId: "b1", chapterId: "c1", listenedSec: 1800, completedPct: 50,  playedAt: JAN2 },
  { userId: "u3", bookId: "b2", chapterId: "c3", listenedSec: 900,  completedPct: 30,  playedAt: JAN8 },
  { userId: "u4", bookId: "b1", chapterId: "c1", listenedSec: 7200, completedPct: 100, playedAt: FEB1 },
];
assert("Ocak'ta 3 aktif dinleyici", countActiveListeners(lisRows, JAN_FROM, JAN_TO) === 3, countActiveListeners(lisRows, JAN_FROM, JAN_TO));
assert("Şubat'ta 1 aktif dinleyici", countActiveListeners(lisRows, FEB1, FEB1) === 1);
assert("Boş aralık → 0", countActiveListeners([], JAN_FROM, JAN_TO) === 0);

// ── sumListenedSec ─────────────────────────────────────────────────────────────
console.log("\nsumListenedSec:");
assert("Ocak toplamı = 6300s", sumListenedSec(lisRows, JAN_FROM, JAN_TO) === 6300, sumListenedSec(lisRows, JAN_FROM, JAN_TO));
assert("Şubat toplamı = 7200s", sumListenedSec(lisRows, FEB1, FEB1) === 7200);

// ── countCompletedBooks ────────────────────────────────────────────────────────
console.log("\ncountCompletedBooks:");

// 3 bölümlü kitap b1: c1, c2, c3
const ch3 = new Map<string, Set<string>>([["b1", new Set(["c1","c2","c3"])]]);

// (a) 3 bölümlü kitapta sadece 1. bölüm 100 → tamamlanmadı
const caseA: MetricRow[] = [
  { userId: "u1", bookId: "b1", chapterId: "c1", listenedSec: 100, completedPct: 100, playedAt: JAN1 },
];
assert("(a) Sadece 1 bölüm tam → tamamlanmadı", countCompletedBooks(caseA, JAN_FROM, JAN_TO, ch3) === 0, countCompletedBooks(caseA, JAN_FROM, JAN_TO, ch3));

// (b) 3 bölümün hepsi ≥ 90 → tamamlandı
const caseB: MetricRow[] = [
  { userId: "u1", bookId: "b1", chapterId: "c1", listenedSec: 100, completedPct: 100, playedAt: JAN1 },
  { userId: "u1", bookId: "b1", chapterId: "c2", listenedSec: 100, completedPct: 95,  playedAt: JAN1 },
  { userId: "u1", bookId: "b1", chapterId: "c3", listenedSec: 100, completedPct: 91,  playedAt: JAN2 },
];
assert("(b) 3 bölüm hepsi ≥ 90 → tamamlandı", countCompletedBooks(caseB, JAN_FROM, JAN_TO, ch3) === 1, countCompletedBooks(caseB, JAN_FROM, JAN_TO, ch3));

// (c) aynı bölümde iki kayıt 50 ve 95 → o bölüm tamam sayılır (max kullanılır)
const caseC: MetricRow[] = [
  { userId: "u1", bookId: "b1", chapterId: "c1", listenedSec: 100, completedPct: 50, playedAt: JAN1 },
  { userId: "u1", bookId: "b1", chapterId: "c1", listenedSec: 100, completedPct: 95, playedAt: JAN2 }, // max → 95
  { userId: "u1", bookId: "b1", chapterId: "c2", listenedSec: 100, completedPct: 92, playedAt: JAN1 },
  { userId: "u1", bookId: "b1", chapterId: "c3", listenedSec: 100, completedPct: 90, playedAt: JAN2 },
];
assert("(c) 2 kayıt 50+95 → max=95, bölüm tamam → kitap tamamlandı", countCompletedBooks(caseC, JAN_FROM, JAN_TO, ch3) === 1, countCompletedBooks(caseC, JAN_FROM, JAN_TO, ch3));

// chapterId=null kayıtlar göz ardı edilmeli
const caseNull: MetricRow[] = [
  { userId: "u1", bookId: "b1", chapterId: null, listenedSec: 100, completedPct: 100, playedAt: JAN1 },
];
assert("chapterId=null olan kayıtlar sayılmaz", countCompletedBooks(caseNull, JAN_FROM, JAN_TO, ch3) === 0);

// İki farklı kullanıcı, ikisi de tamamladı → 2
const case2users: MetricRow[] = [
  ...caseB,
  { userId: "u2", bookId: "b1", chapterId: "c1", listenedSec: 100, completedPct: 100, playedAt: JAN1 },
  { userId: "u2", bookId: "b1", chapterId: "c2", listenedSec: 100, completedPct: 90,  playedAt: JAN1 },
  { userId: "u2", bookId: "b1", chapterId: "c3", listenedSec: 100, completedPct: 93,  playedAt: JAN1 },
];
assert("İki kullanıcı aynı kitabı tamamladı → 2", countCompletedBooks(case2users, JAN_FROM, JAN_TO, ch3) === 2, countCompletedBooks(case2users, JAN_FROM, JAN_TO, ch3));

// ── weeklyTrend ────────────────────────────────────────────────────────────────
console.log("\nweeklyTrend:");
const now = D("2026-01-14T00:00:00");
const trend = weeklyTrend(lisRows, 12, now);
assert("12 hafta döndürür", trend.length === 12, trend.length);
assert("Hepsi YYYY-MM-DD formatında", trend.every(t => /^\d{4}-\d{2}-\d{2}$/.test(t.weekStart)));
assert("Artan sırada weekStart", trend.every((t, i) => i === 0 || t.weekStart > trend[i - 1].weekStart));

// İstanbul saat dilimi sınırı: UTC Pazar 22:00 = İstanbul Pazartesi 01:00
// → o haftanın içinde sayılmalı (process.env.TZ = UTC'de de aynı sonuç)
const NOW_IST = D("2026-10-07T15:00:00"); // İstanbul Çarşamba 18:00
// İstanbul Pazartesi gece yarısı = 2026-10-04T21:00:00Z; bu dakikadan sonraki kayıt o haftada
const sundayEvening: MetricRow = {
  userId: "u_tz", bookId: "b_tz", chapterId: "c_tz",
  listenedSec: 60, completedPct: 0,
  playedAt: D("2026-10-04T22:00:00"), // UTC Pazar 22:00 = İstanbul Pzt 01:00
};
const trendTZ = weeklyTrend([sundayEvening], 1, NOW_IST);
assert(
  "weeklyTrend: UTC Pazar 22:00 = İstanbul Pzt 01:00 → bu hafta sayılır",
  trendTZ[0].activeUsers === 1,
  `activeUsers=${trendTZ[0].activeUsers} weekStart=${trendTZ[0].weekStart}`,
);
assert(
  "weeklyTrend: weekStart İstanbul Pazartesi tarihi = 2026-10-05",
  trendTZ[0].weekStart === "2026-10-05",
  trendTZ[0].weekStart,
);

// ── topBooks ──────────────────────────────────────────────────────────────────
console.log("\ntopBooks:");
const top = topBooks(lisRows, JAN_FROM, JAN_TO, 3);
assert("Limit 3'e uyuyor", top.length <= 3, top.length);
assert("b1 birinci sırada", top[0]?.bookId === "b1", top[0]?.bookId);
assert("b1'de 2 dinleyici", top[0]?.listenerCount === 2, top[0]?.listenerCount);

// ── funnelMetrics ─────────────────────────────────────────────────────────────
console.log("\nfunnelMetrics:");
// Normal durum: invitesSent < invitesAccepted → invitesSent yükseltilir
const f1 = funnelMetrics(10, 5, 8, lisRows, JAN_FROM, JAN_TO);
assert("invitesSent = max(5,8) = 8 (huni artmaz)", f1.invitesSent === 8, f1.invitesSent);
assert("invitesAccepted = 8", f1.invitesAccepted === 8, f1.invitesAccepted);
assert("activeInPeriod = 3", f1.activeInPeriod === 3, f1.activeInPeriod);

// invitesSent > invitesAccepted → normal
const f2 = funnelMetrics(20, 15, 10, lisRows, JAN_FROM, JAN_TO);
assert("invitesSent = 15 (zaten büyük)", f2.invitesSent === 15, f2.invitesSent);

// Huni monoton azalma kontrolü
const f3 = funnelMetrics(20, 8, 6, lisRows, JAN_FROM, JAN_TO);
assert("Huni: seats ≥ invitesSent ≥ accepted ≥ played ≥ active",
  f3.seats >= f3.invitesSent &&
  f3.invitesSent >= f3.invitesAccepted &&
  f3.invitesAccepted >= f3.hasPlayedEver &&
  f3.hasPlayedEver >= f3.activeInPeriod,
  JSON.stringify(f3));

// ── parsePeriod (Istanbul saat dilimi) ────────────────────────────────────────
// Sunucu "now" olarak sabit bir UTC zamanı kullanılıyor:
//   2026-10-07T15:00:00Z  →  Istanbul 2026-10-07 18:00 (Q4, yılın 10. ayı)
console.log("\nparsePeriod:");

const NOW_UTC = new Date("2026-10-07T15:00:00.000Z");

// quarter: Q4 başlangıcı = 1 Eki 00:00 Istanbul = 30 Eyl 21:00 UTC
const q = parsePeriod("quarter", null, null, NOW_UTC);
assert(
  "quarter.from = 2026-09-30T21:00:00Z (Istanbul 1 Eki gece yarısı)",
  q.from.toISOString() === "2026-09-30T21:00:00.000Z",
  q.from.toISOString(),
);
assert("quarter.to = now", q.to === NOW_UTC);

// year: 1 Oca 00:00 Istanbul = 31 Ara 2025 21:00 UTC
const y = parsePeriod("year", null, null, NOW_UTC);
assert(
  "year.from = 2025-12-31T21:00:00Z (Istanbul 1 Oca gece yarısı)",
  y.from.toISOString() === "2025-12-31T21:00:00.000Z",
  y.from.toISOString(),
);
assert("year.to = now", y.to === NOW_UTC);

// 30d: göreceli, gece yarısı sınırı yok
const t30 = parsePeriod("30d", null, null, NOW_UTC);
assert(
  "30d.from = now - 30 gün",
  t30.from.getTime() === NOW_UTC.getTime() - 30 * 86400000,
  t30.from.toISOString(),
);

// custom: 2026-10-01 → 2026-10-07 Istanbul
const c = parsePeriod("custom", "2026-10-01", "2026-10-07", NOW_UTC);
assert(
  "custom.from = 2026-09-30T21:00:00Z",
  c.from.toISOString() === "2026-09-30T21:00:00.000Z",
  c.from.toISOString(),
);
// to = 7 Eki 23:59:59.999 Istanbul = 8 Eki 00:00 Istanbul - 1ms = 7 Eki 21:00:00 UTC - 1ms = 7 Eki 20:59:59.999 UTC
assert(
  "custom.to = 2026-10-07T20:59:59.999Z",
  c.to.toISOString() === "2026-10-07T20:59:59.999Z",
  c.to.toISOString(),
);

// ── Sonuç ──────────────────────────────────────────────────────────────────────
console.log(`\n${passed + failed} testten ${passed} geçti, ${failed} başarısız.`);
if (failed > 0) process.exit(1);
