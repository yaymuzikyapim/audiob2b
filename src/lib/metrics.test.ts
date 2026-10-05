/**
 * Birim testleri: npx tsx src/lib/metrics.test.ts
 */

import {
  countActiveListeners,
  sumListenedSec,
  countCompletedBooks,
  weeklyTrend,
  topBooks,
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

// ── Test verisi ────────────────────────────────────────────────────────────────
const JAN1 = new Date("2026-01-01T10:00:00Z");
const JAN2 = new Date("2026-01-02T10:00:00Z");
const JAN8 = new Date("2026-01-08T10:00:00Z");
const FEB1 = new Date("2026-02-01T10:00:00Z");

const rows: MetricRow[] = [
  // Kullanıcı A: kitap1, kitap2 dinledi
  { userId: "u1", bookId: "b1", listenedSec: 3600, completedPct: 100, playedAt: JAN1 },
  { userId: "u1", bookId: "b2", listenedSec: 1800, completedPct: 50, playedAt: JAN2 },
  // Kullanıcı B: kitap1 tamamlandı
  { userId: "u2", bookId: "b1", listenedSec: 3600, completedPct: 95, playedAt: JAN1 },
  // Kullanıcı C: Ocak 8 (farklı hafta)
  { userId: "u3", bookId: "b3", listenedSec: 900, completedPct: 30, playedAt: JAN8 },
  // Şubat (aralık dışı)
  { userId: "u4", bookId: "b1", listenedSec: 7200, completedPct: 100, playedAt: FEB1 },
];

const JAN_FROM = new Date("2026-01-01T00:00:00Z");
const JAN_TO = new Date("2026-01-31T23:59:59Z");

// ── countActiveListeners ───────────────────────────────────────────────────────
console.log("\ncountActiveListeners:");
assert("Ocak'ta 3 aktif dinleyici", countActiveListeners(rows, JAN_FROM, JAN_TO) === 3, countActiveListeners(rows, JAN_FROM, JAN_TO));
assert("Şubat dışı sayılmaz", countActiveListeners(rows, FEB1, FEB1) === 1, countActiveListeners(rows, FEB1, FEB1));
assert("Boş aralık → 0", countActiveListeners([], JAN_FROM, JAN_TO) === 0);

// ── sumListenedSec ─────────────────────────────────────────────────────────────
console.log("\nsumListenedSec:");
const janSum = sumListenedSec(rows, JAN_FROM, JAN_TO);
assert("Ocak toplamı = 9900s", janSum === 9900, janSum);
assert("Şubat toplamı = 7200s", sumListenedSec(rows, FEB1, new Date("2026-02-28T23:59:59Z")) === 7200);

// ── countCompletedBooks ────────────────────────────────────────────────────────
console.log("\ncountCompletedBooks:");
const chMap = new Map<string, number>([["b1", 5], ["b2", 10], ["b3", 3]]);
const janCompleted = countCompletedBooks(rows, JAN_FROM, JAN_TO, chMap);
// u1/b1(100%) + u2/b1(95%) = 2 tamamlama
assert("Ocak'ta 2 tamamlanan kullanıcı+kitap", janCompleted === 2, janCompleted);
assert("u1/b2 tamamlanmamış (50%)", countCompletedBooks(
  [{ userId: "u1", bookId: "b2", listenedSec: 100, completedPct: 50, playedAt: JAN1 }],
  JAN_FROM, JAN_TO, chMap
) === 0);

// ── weeklyTrend ────────────────────────────────────────────────────────────────
console.log("\nweeklyTrend:");
// JAN1 = 2026-01-01 Perşembe → hafta başı: 2025-12-29 Pazartesi
// JAN8 = 2026-01-08 Perşembe → hafta başı: 2026-01-05 Pazartesi
const now = new Date("2026-01-14T00:00:00Z"); // Çarşamba
const trend = weeklyTrend(rows, 4, now);
assert("4 hafta döndürür", trend.length === 4, trend.length);
assert("Hepsi weekStart string", trend.every(t => /^\d{4}-\d{2}-\d{2}$/.test(t.weekStart)));
// En son iki hafta kontrol
const lastWeeks = trend.slice(-2);
const totalSec = lastWeeks.reduce((s, w) => s + w.listenedSec, 0);
assert("Son 2 hafta listenedSec > 0", totalSec > 0, totalSec);

// ── topBooks ──────────────────────────────────────────────────────────────────
console.log("\ntopBooks:");
const top = topBooks(rows, JAN_FROM, JAN_TO, 3);
assert("limit 3'e uyuyor", top.length <= 3, top.length);
assert("b1 birinci sırada (7200s)", top[0]?.bookId === "b1", top[0]?.bookId);
assert("b1'de 2 dinleyici", top[0]?.listenerCount === 2, top[0]?.listenerCount);

// ── Sonuç ──────────────────────────────────────────────────────────────────────
console.log(`\n${passed + failed} testten ${passed} geçti, ${failed} başarısız.`);
if (failed > 0) process.exit(1);
