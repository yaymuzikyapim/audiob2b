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

// ── Sonuç ──────────────────────────────────────────────────────────────────────
console.log(`\n${passed + failed} testten ${passed} geçti, ${failed} başarısız.`);
if (failed > 0) process.exit(1);
