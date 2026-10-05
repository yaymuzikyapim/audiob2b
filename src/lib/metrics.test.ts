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

const JAN1 = new Date("2026-01-01T10:00:00Z");
const JAN2 = new Date("2026-01-02T10:00:00Z");
const JAN8 = new Date("2026-01-08T10:00:00Z");
const FEB1 = new Date("2026-02-01T10:00:00Z");

const rows: MetricRow[] = [
  { userId: "u1", bookId: "b1", listenedSec: 3600, completedPct: 100, playedAt: JAN1 },
  { userId: "u1", bookId: "b2", listenedSec: 1800, completedPct: 50, playedAt: JAN2 },
  { userId: "u2", bookId: "b1", listenedSec: 3600, completedPct: 95, playedAt: JAN1 },
  { userId: "u3", bookId: "b3", listenedSec: 900, completedPct: 30, playedAt: JAN8 },
  { userId: "u4", bookId: "b1", listenedSec: 7200, completedPct: 100, playedAt: FEB1 },
];

const JAN_FROM = new Date("2026-01-01T00:00:00Z");
const JAN_TO = new Date("2026-01-31T23:59:59Z");

// ── countActiveListeners ───────────────────────────────────────────────────────
console.log("\ncountActiveListeners:");
assert("Ocak'ta 3 aktif dinleyici", countActiveListeners(rows, JAN_FROM, JAN_TO) === 3, countActiveListeners(rows, JAN_FROM, JAN_TO));
assert("Şubat dışı sayılmaz", countActiveListeners(rows, FEB1, FEB1) === 1);
assert("Boş aralık → 0", countActiveListeners([], JAN_FROM, JAN_TO) === 0);

// ── sumListenedSec ─────────────────────────────────────────────────────────────
console.log("\nsumListenedSec:");
const janSum = sumListenedSec(rows, JAN_FROM, JAN_TO);
assert("Ocak toplamı = 9900s", janSum === 9900, janSum);
assert("Şubat toplamı = 7200s", sumListenedSec(rows, FEB1, new Date("2026-02-28T23:59:59Z")) === 7200);

// ── countCompletedBooks ────────────────────────────────────────────────────────
console.log("\ncountCompletedBooks:");
const janCompleted = countCompletedBooks(rows, JAN_FROM, JAN_TO);
// u1/b1(100%) + u2/b1(95%) = 2 benzersiz userId+bookId tamamlaması
assert("Ocak'ta 2 tamamlanan", janCompleted === 2, janCompleted);
assert("u1/b2 tamamlanmamış (50%)", countCompletedBooks(
  [{ userId: "u1", bookId: "b2", listenedSec: 100, completedPct: 50, playedAt: JAN1 }],
  JAN_FROM, JAN_TO
) === 0);
// max(completedPct) testi: iki kayıt, ikisi de < 90 ama toplam > 90 — hâlâ 0 olmalı
assert("İki oturum, her biri < 90 → tamamlanmadı", countCompletedBooks(
  [
    { userId: "u5", bookId: "b4", listenedSec: 1000, completedPct: 60, playedAt: JAN1 },
    { userId: "u5", bookId: "b4", listenedSec: 1000, completedPct: 40, playedAt: JAN2 },
  ],
  JAN_FROM, JAN_TO
) === 0);
// Aynı kitap ikinci oturumda 90'a ulaştı → 1 olmalı
assert("Sonraki oturumda ≥90 → tamamlandı", countCompletedBooks(
  [
    { userId: "u5", bookId: "b4", listenedSec: 1000, completedPct: 60, playedAt: JAN1 },
    { userId: "u5", bookId: "b4", listenedSec: 1000, completedPct: 92, playedAt: JAN2 },
  ],
  JAN_FROM, JAN_TO
) === 1);

// ── weeklyTrend ────────────────────────────────────────────────────────────────
console.log("\nweeklyTrend:");
const now = new Date("2026-01-14T00:00:00Z");
const trend = weeklyTrend(rows, 12, now);
assert("12 hafta döndürür", trend.length === 12, trend.length);
assert("Hepsi YYYY-MM-DD formatında", trend.every(t => /^\d{4}-\d{2}-\d{2}$/.test(t.weekStart)));
assert("Artan weekStart sırası", trend.every((t, i) => i === 0 || t.weekStart > trend[i - 1].weekStart));

// ── topBooks ──────────────────────────────────────────────────────────────────
console.log("\ntopBooks:");
const top = topBooks(rows, JAN_FROM, JAN_TO, 3);
assert("limit 3'e uyuyor", top.length <= 3, top.length);
assert("b1 birinci sırada (7200s)", top[0]?.bookId === "b1", top[0]?.bookId);
assert("b1'de 2 dinleyici", top[0]?.listenerCount === 2, top[0]?.listenerCount);

// ── funnelMetrics ─────────────────────────────────────────────────────────────
console.log("\nfunnelMetrics:");
const f = funnelMetrics(10, 8, 6, rows, JAN_FROM, JAN_TO);
assert("seats = 10", f.seats === 10);
assert("invitesSent = 8", f.invitesSent === 8);
assert("invitesAccepted = 6", f.invitesAccepted === 6);
assert("activeInPeriod = 3", f.activeInPeriod === 3, f.activeInPeriod);
// neverPlayed = accepted - hasPlayedEver (all 4 users in rows, but only 3 in JAN scope)
// hasPlayedEver = distinct userIds in ALL rows = 4
assert("neverPlayed = max(0, 6-4) = 2", f.neverPlayed === 2, f.neverPlayed);

// ── Sonuç ──────────────────────────────────────────────────────────────────────
console.log(`\n${passed + failed} testten ${passed} geçti, ${failed} başarısız.`);
if (failed > 0) process.exit(1);
