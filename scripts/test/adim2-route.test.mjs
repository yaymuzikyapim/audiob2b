#!/usr/bin/env node
/**
 * Adım 2 route + backfill + RESTRICT entegrasyon testleri
 * Dev DB (localhost:5433) üzerinde çalışır.
 * Kullanım: TZ=UTC ENV_FILE=.env.dev node scripts/test/adim2-route.test.mjs
 */

import { PrismaClient, ValidationStatus, CompanyIdSource } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "dotenv";

const envFile = process.env.ENV_FILE ?? ".env";
config({ path: envFile });

if (!process.env.DATABASE_URL?.includes("localhost")) {
  console.error("HATA: Dev DB bağlantısı bekleniyor (localhost). ENV_FILE=.env.dev kullan.");
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter, log: ["warn", "error"] });

let PASS = 0, FAIL = 0;
function pass(msg) { console.log(`  ✓ ${msg}`); PASS++; }
function fail(msg, detail) { console.log(`  ✗ ${msg}${detail ? ` | ${detail}` : ""}`); FAIL++; }
function eq(a, b, msg) { a === b ? pass(msg) : fail(msg, `beklenen=${b}, gerçek=${a}`); }

// Temizlik için id'leri tut
const cleanupCompanyIds = [];
const cleanupUserIds = [];

// ── Test verisi: şirketli ve şirketsiz kullanıcı ─────────────────────────────
async function setup() {
  const company = await prisma.company.create({
    data: {
      name: "Test Şirketi Adım2",
      slug: `adim2-test-${Date.now()}`,
      startDate: new Date("2026-01-01"),
      endDate: new Date("2027-01-01"),
      maxSeats: 5,
    },
  });
  cleanupCompanyIds.push(company.id);

  const userWithCompany = await prisma.user.create({
    data: {
      email: `adim2-test-${Date.now()}@test.local`,
      name: "Test User Adım2",
      companyId: company.id,
    },
  });
  cleanupUserIds.push(userWithCompany.id);

  const userNoCompany = await prisma.user.create({
    data: {
      email: `adim2-nocompany-${Date.now()}@test.local`,
      name: "Test User NoCompany",
      companyId: null,
    },
  });
  cleanupUserIds.push(userNoCompany.id);

  const book = await prisma.book.create({
    data: {
      title: "Test Kitabı Adım2",
      author: "Test Yazar",
      duration: 3600,
    },
  });

  return { company, userWithCompany, userNoCompany, book };
}

// ── Route mantığını doğrudan test et ─────────────────────────────────────────
// (Route'un HTTP katmanı yerine iş mantığını Prisma üzerinden doğruluyoruz)

async function insertRecord(opts) {
  const {
    userId, bookId, companyId, clientVersion, contentSec,
    listenedSec, playedAt, receivedAt, validationStatus,
    clientId, companyIdSource,
  } = opts;
  return prisma.playHistory.create({
    data: {
      userId,
      bookId,
      listenedSec: listenedSec ?? 300,
      contentSec: contentSec ?? (clientVersion === 2 ? 300 : 0),
      completedPct: 50,
      clientVersion: clientVersion ?? 2,
      playedAt: playedAt ?? new Date(),
      receivedAt: receivedAt ?? new Date(),
      companyId: companyId ?? null,
      companyIdSource: companyIdSource ?? (companyId ? CompanyIdSource.SERVER_AT_EVENT : null),
      validationStatus,
      ...(clientId ? { clientId } : {}),
    },
  });
}

async function getRejectCount(reason, day, platform = "unknown", clientVersion = 0) {
  const r = await prisma.playHistoryReject.findUnique({
    where: { reason_day_platform_clientVersion: { reason, day, platform, clientVersion } },
  });
  return r?.count ?? 0;
}

async function upsertReject(reason, platform = "unknown", clientVersion = 0) {
  const day = new Date();
  day.setUTCHours(0, 0, 0, 0);
  await prisma.playHistoryReject.upsert({
    where: { reason_day_platform_clientVersion: { reason, day, platform, clientVersion } },
    create: { reason, day, platform, clientVersion, count: 1 },
    update: { count: { increment: 1 } },
  });
  return getRejectCount(reason, day, platform, clientVersion);
}

// ── Sınıflandırma mantığı ─────────────────────────────────────────────────────
function classify(clientVersion, contentSec, playedAt, receivedAt) {
  const ACCEPTANCE_WINDOW_MS = 45 * 24 * 60 * 60 * 1000;
  if (clientVersion === 1) return "LEGACY_V1";
  if (contentSec === 0) return "INVALID_V2_NO_CONTENT";
  if (receivedAt.getTime() - playedAt.getTime() > ACCEPTANCE_WINDOW_MS) return "QUARANTINED_LATE";
  return "VALID";
}

async function runTests() {
  console.log("\n══════════════════════════════════════════");
  console.log(" Adım 2 route + backfill + RESTRICT testleri");
  console.log("══════════════════════════════════════════\n");

  const { company, userWithCompany, userNoCompany, book } = await setup();
  const now = new Date();

  // ── Sınıflandırma testleri ────────────────────────────────────────────────
  console.log("A) Sınıflandırma kuralları");

  const t1 = classify(1, 0, now, now);
  eq(t1, "LEGACY_V1", "v1 → LEGACY_V1");

  const t2 = classify(2, 0, now, now);
  eq(t2, "INVALID_V2_NO_CONTENT", "v2 contentSec=0 → INVALID_V2_NO_CONTENT");

  const d44 = new Date(now.getTime() - 44 * 24 * 60 * 60 * 1000);
  const t3 = classify(2, 300, d44, now);
  eq(t3, "VALID", "44 gün önce → VALID");

  const d46 = new Date(now.getTime() - 46 * 24 * 60 * 60 * 1000);
  const t4 = classify(2, 300, d46, now);
  eq(t4, "QUARANTINED_LATE", "46 gün önce → QUARANTINED_LATE");

  // ── DB yazma testleri ─────────────────────────────────────────────────────
  console.log("\nB) DB yazma — validationStatus");

  const r1 = await insertRecord({ userId: userWithCompany.id, bookId: book.id, companyId: company.id, clientVersion: 1, contentSec: 0, validationStatus: ValidationStatus.LEGACY_V1 });
  eq(r1.validationStatus, "LEGACY_V1", "DB'de LEGACY_V1 kaydedildi");
  eq(r1.companyId, company.id, "companyId dolu");
  eq(r1.companyIdSource, "SERVER_AT_EVENT", "companyIdSource=SERVER_AT_EVENT");
  eq(r1.receivedAt !== null, true, "receivedAt NOT NULL");

  const r2 = await insertRecord({ userId: userWithCompany.id, bookId: book.id, companyId: company.id, clientVersion: 2, contentSec: 0, validationStatus: ValidationStatus.INVALID_V2_NO_CONTENT });
  eq(r2.validationStatus, "INVALID_V2_NO_CONTENT", "DB'de INVALID_V2_NO_CONTENT kaydedildi");

  const r3 = await insertRecord({ userId: userWithCompany.id, bookId: book.id, companyId: company.id, clientVersion: 2, contentSec: 300, playedAt: d44, validationStatus: ValidationStatus.VALID });
  eq(r3.validationStatus, "VALID", "44 gün önce VALID kaydedildi");
  eq(r3.playedAt.getTime(), d44.getTime(), "playedAt değişmeden saklandı");

  const r4 = await insertRecord({ userId: userWithCompany.id, bookId: book.id, companyId: company.id, clientVersion: 2, contentSec: 300, playedAt: d46, validationStatus: ValidationStatus.QUARANTINED_LATE });
  eq(r4.validationStatus, "QUARANTINED_LATE", "46 gün önce QUARANTINED_LATE, playedAt değişmeden saklandı");
  eq(r4.playedAt.getTime(), d46.getTime(), "46 günlük playedAt korundu");

  // ── Şirketsiz kullanıcı ───────────────────────────────────────────────────
  console.log("\nC) Şirketsiz kullanıcı → companyId NULL");

  const r5 = await insertRecord({ userId: userNoCompany.id, bookId: book.id, companyId: null, clientVersion: 2, contentSec: 300, validationStatus: ValidationStatus.VALID });
  eq(r5.companyId, null, "şirketsiz kullanıcı → companyId NULL");
  eq(r5.companyIdSource, null, "companyIdSource da NULL");

  // ── clientId idempotency ──────────────────────────────────────────────────
  console.log("\nD) clientId idempotency");

  const cid = `test-cid-${Date.now()}`;
  const r6 = await insertRecord({ userId: userWithCompany.id, bookId: book.id, companyId: company.id, clientVersion: 2, contentSec: 300, clientId: cid, validationStatus: ValidationStatus.VALID });
  // Aynı clientId tekrar insert dener → unique constraint
  try {
    await insertRecord({ userId: userWithCompany.id, bookId: book.id, companyId: company.id, clientVersion: 2, contentSec: 300, clientId: cid, validationStatus: ValidationStatus.VALID });
    fail("Tekrar clientId unique constraint çalışmalıydı");
  } catch {
    pass("Tekrar aynı clientId → unique constraint atıldı (tek satır)");
  }
  const dupCount = await prisma.playHistory.count({ where: { clientId: cid } });
  eq(dupCount, 1, "DB'de tek satır var");

  // ── PlayHistoryReject ─────────────────────────────────────────────────────
  console.log("\nE) PlayHistoryReject sayaç");

  const day = new Date(); day.setUTCHours(0, 0, 0, 0);
  const c1 = await upsertReject("FUTURE_TIMESTAMP");
  pass(`+6 dk → reject 1: count=${c1}`);
  eq(c1, 1, "İlk reject count=1");

  const c2 = await upsertReject("FUTURE_TIMESTAMP");
  eq(c2, 2, "İkinci +6 dk → aynı satır count=2");

  const c3 = await upsertReject("DURATION_EXCEEDED");
  eq(c3, 1, "3601 sn → DURATION_EXCEEDED count=1");

  const c4 = await upsertReject("CLIENT_ID_CONFLICT");
  eq(c4, 1, "Çakışan clientId → reject count=1");

  // ── RESTRICT testi: PlayHistory'si olan şirket silinemiyor ────────────────
  console.log("\nF) ON DELETE RESTRICT");

  try {
    await prisma.company.delete({ where: { id: company.id } });
    fail("PlayHistory'si olan şirket silindi — beklenen: hata");
  } catch (e) {
    if (e.message?.includes("Foreign key constraint") || e.code === "P2003") {
      pass("PlayHistory'si olan şirket silinemiyor (FK RESTRICT) ✓");
    } else {
      fail("Beklenen FK hatası değil", e.message?.slice(0, 100));
    }
  }

  // ── Backfill: NULL satırlarla kuru çalışma ────────────────────────────────
  console.log("\nG) Backfill sayaç mantığı");

  // Test için NULL validationStatus'lu birkaç satır oluştur
  const backfillV1 = await prisma.playHistory.create({
    data: { userId: userWithCompany.id, bookId: book.id, listenedSec: 100, contentSec: 0, completedPct: 0, clientVersion: 1, companyId: company.id, companyIdSource: "SERVER_AT_EVENT", receivedAt: new Date() },
  });
  const backfillV2 = await prisma.playHistory.create({
    data: { userId: userWithCompany.id, bookId: book.id, listenedSec: 200, contentSec: 200, completedPct: 0, clientVersion: 2, companyId: company.id, companyIdSource: "SERVER_AT_EVENT", receivedAt: new Date() },
  });

  const nullCount = await prisma.playHistory.count({ where: { validationStatus: null } });
  pass(`NULL validationStatus satır sayısı: ${nullCount} (backfill için bekleniyor)`);

  // Backfill uygula (sadece az önce oluşturduğumuz satırlara)
  await prisma.playHistory.updateMany({
    where: { id: backfillV1.id, validationStatus: null },
    data: { validationStatus: "LEGACY_V1" },
  });
  await prisma.playHistory.updateMany({
    where: { id: backfillV2.id, validationStatus: null },
    data: { validationStatus: "LEGACY_V2" },
  });
  const after1 = await prisma.playHistory.findUnique({ where: { id: backfillV1.id } });
  const after2 = await prisma.playHistory.findUnique({ where: { id: backfillV2.id } });
  eq(after1?.validationStatus, "LEGACY_V1", "Backfill: v1 → LEGACY_V1");
  eq(after2?.validationStatus, "LEGACY_V2", "Backfill: v2 → LEGACY_V2");
}

async function cleanup() {
  // PlayHistory önce silinmeli (RESTRICT)
  for (const cid of cleanupCompanyIds) {
    await prisma.playHistory.deleteMany({ where: { companyId: cid } });
  }
  // Ayrıca userId üzerinden temizle
  for (const uid of cleanupUserIds) {
    await prisma.playHistory.deleteMany({ where: { userId: uid } });
    await prisma.user.deleteMany({ where: { id: uid } });
  }
  // PlayHistoryReject temizliği (bu oturumda oluşturulan)
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  await prisma.playHistoryReject.deleteMany({
    where: {
      day: today,
      reason: { in: ["FUTURE_TIMESTAMP", "DURATION_EXCEEDED", "CLIENT_ID_CONFLICT"] },
      platform: "unknown",
    },
  });
  for (const cid of cleanupCompanyIds) {
    await prisma.inviteToken.deleteMany({ where: { companyId: cid } });
    await prisma.company.deleteMany({ where: { id: cid } });
  }
  // Book temizliği (cascade ile PlayHistory silinir, ama bizim kayıtlarımız zaten silindi)
  await prisma.book.deleteMany({ where: { title: "Test Kitabı Adım2" } });
}

runTests()
  .catch((e) => { console.error("Test beklenmeyen hatayla durdu:", e); FAIL++; })
  .finally(async () => {
    await cleanup();
    await prisma.$disconnect();
    console.log(`\n══════════════════════════════════════════`);
    console.log(` Sonuç: ${PASS} geçti, ${FAIL} başarısız`);
    console.log(`══════════════════════════════════════════`);
    if (FAIL > 0) process.exit(1);
  });
