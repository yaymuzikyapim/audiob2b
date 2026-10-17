#!/usr/bin/env node
/**
 * Adım 2 Backfill — validationStatus doldurmak için tek seferlik script.
 *
 * Yalnızca validationStatus IS NULL satırları günceller.
 * İki aşama:
 *   1. SYNTHETIC: planın §6 kanıt listesindeki 18 id
 *   2. LEGACY_V1 / LEGACY_V2: clientVersion'a göre kalan NULL satırlar
 *
 * Çalıştırma:
 *   ENV_FILE=.env.prod DRY_RUN=1 node scripts/ops/2026-10-17-adim2-backfill.mjs
 *   ENV_FILE=.env.prod node scripts/ops/2026-10-17-adim2-backfill.mjs
 *
 * Prod koruması: ENV_FILE=.env.prod olmadan çalışmaz.
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "dotenv";

// ── Prod koruması ─────────────────────────────────────────────────────────────
const envFile = process.env.ENV_FILE;
if (!envFile || !envFile.includes("prod")) {
  console.error("HATA: ENV_FILE=.env.prod verilmedi. Prod koruması aktif.");
  process.exit(1);
}
config({ path: envFile });

const DRY_RUN = process.env.DRY_RUN === "1";
if (DRY_RUN) console.log("── DRY RUN modu (veritabanı değişmez) ──");

// ── Kanıt listesi (plan §6, 2026-10-17) ──────────────────────────────────────
const SYNTHETIC_IDS = [
  "cmibnq56l98rah7m0h37m5i5g",
  "cm2divbe2yj8j2zs79mdx6rc1",
  "cmlta5wqr3gxbxglorpkf8ncn",
  "cmbec7o07hhl00lydaknvstsl",
  "cmve9paxh2lskfr4ob93fg2xb",
  "cmwaq6hf0kd2g0r9twimv8g0r",
  "cm9v2u0nxvuv07gzi0nrojenb",
  "cmph65sds0qc1cp5eh1zs67fy",
  "cmo21kky3bhavhsea9it4ru3h",
  "cmdss86y9jzfvfrzxh2k5oxmz",
  "cmx4yrlob5xo9rx4vy7wn2lp0",
  "cm4u3z8y5e8mratfpdy2vchnm",
  "cm52gj657cn6ou2razbn9aos2",
  "cma3vm7z4ulfolkzu0whf294t",
  "cma6e3qc19zimdn4kouu8qg4l",
  "cmdwd84idejdvxmlzqi1v21n3",
  "cmf62jwlli1cofaymhup6soqc",
  "cmnmxg6b8zq78nxcur8cj5lys",
];

// ── Beklenen sayılar (canlıdan 2026-10-17'de doğrulandı) ─────────────────────
const EXPECTED = { synthetic: 18, legacyV1: 137, legacyV2: 70, total: 225 };

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter, log: ["warn", "error"] });

async function main() {
  // Null satır sayıları
  const nullTotal = await prisma.playHistory.count({
    where: { validationStatus: null },
  });
  const nullV1 = await prisma.playHistory.count({
    where: { validationStatus: null, clientVersion: 1 },
  });
  const nullV2 = await prisma.playHistory.count({
    where: { validationStatus: null, clientVersion: 2 },
  });

  console.log(`\nMevcut NULL satırlar: toplam=${nullTotal}, v1=${nullV1}, v2=${nullV2}`);

  // Heuristic ile çapraz kontrol
  const heuristicCount = await prisma.playHistory.count({
    where: {
      clientId: null,
      chapterId: null,
      listenedSec: { in: [500, 600, 700, 800, 900, 1000] },
    },
  });
  // Kanıt listesindeki ID'lerden kaç tanesi heuristic'le örtüşüyor
  const kanıtVeHeuristic = await prisma.playHistory.count({
    where: {
      id: { in: SYNTHETIC_IDS },
      clientId: null,
      chapterId: null,
    },
  });

  console.log(`Heuristic (null clientId+chapterId, 100'e bölünen): ${heuristicCount}`);
  console.log(`Kanıt listesi × heuristic kesişimi: ${kanıtVeHeuristic}`);

  if (heuristicCount !== SYNTHETIC_IDS.length || kanıtVeHeuristic !== SYNTHETIC_IDS.length) {
    console.error(
      `HATA: Kanıt listesi ile heuristic eşleşmiyor! ` +
      `Heuristic=${heuristicCount}, Kanıt=${SYNTHETIC_IDS.length}, ` +
      `Kesişim=${kanıtVeHeuristic}. ROLLBACK.`
    );
    process.exit(1);
  }

  // Beklenen sayı kontrolü
  const expectedNullSynthetic = SYNTHETIC_IDS.length; // 18
  const expectedNullV1 = EXPECTED.legacyV1;           // 137
  const expectedNullV2 = EXPECTED.legacyV2;            // 70 (88 - 18 synthetic)
  const expectedNullTotal = EXPECTED.total;             // 225

  if (nullTotal !== expectedNullTotal) {
    console.error(
      `HATA: Toplam NULL satır beklenti uyuşmuyor! ` +
      `Beklenen=${expectedNullTotal}, Gerçek=${nullTotal}. ROLLBACK.`
    );
    process.exit(1);
  }
  if (nullV1 !== expectedNullV1) {
    console.error(
      `HATA: v1 NULL satır uyuşmuyor! Beklenen=${expectedNullV1}, Gerçek=${nullV1}. ROLLBACK.`
    );
    process.exit(1);
  }
  if (nullV2 !== expectedNullV1 + expectedNullV2 - expectedNullV1) {
    // v2 null = legacyV2 (70) + synthetic (18) = 88
    if (nullV2 !== 88) {
      console.error(
        `HATA: v2 NULL satır uyuşmuyor! Beklenen=88, Gerçek=${nullV2}. ROLLBACK.`
      );
      process.exit(1);
    }
  }

  console.log("\nSayı kontrolü geçti. Backfill sırası:");
  console.log(`  1. SYNTHETIC: ${SYNTHETIC_IDS.length} satır`);
  console.log(`  2. LEGACY_V1: ${expectedNullV1} satır (v1, kanıt listesinde değil)`);
  console.log(`  3. LEGACY_V2: ${expectedNullV2} satır (v2, kanıt listesinde değil)`);

  if (DRY_RUN) {
    console.log("\n[DRY RUN] Veritabanı değişmedi. DRY_RUN=1 kaldırılırsa uygulanır.");
    return;
  }

  // Aşama 1: SYNTHETIC
  const r1 = await prisma.playHistory.updateMany({
    where: { id: { in: SYNTHETIC_IDS }, validationStatus: null },
    data: { validationStatus: "SYNTHETIC" },
  });
  console.log(`\nAşama 1 — SYNTHETIC: ${r1.count} satır güncellendi`);

  if (r1.count !== expectedNullSynthetic) {
    console.error(`HATA: Beklenen ${expectedNullSynthetic}, güncellenen ${r1.count}. Devam etmiyor.`);
    process.exit(1);
  }

  // Aşama 2: LEGACY_V1
  const r2 = await prisma.playHistory.updateMany({
    where: { validationStatus: null, clientVersion: 1 },
    data: { validationStatus: "LEGACY_V1" },
  });
  console.log(`Aşama 2 — LEGACY_V1: ${r2.count} satır güncellendi`);

  if (r2.count !== expectedNullV1) {
    console.error(`HATA: Beklenen ${expectedNullV1}, güncellenen ${r2.count}.`);
    process.exit(1);
  }

  // Aşama 3: LEGACY_V2
  const r3 = await prisma.playHistory.updateMany({
    where: { validationStatus: null, clientVersion: 2 },
    data: { validationStatus: "LEGACY_V2" },
  });
  console.log(`Aşama 3 — LEGACY_V2: ${r3.count} satır güncellendi`);

  if (r3.count !== expectedNullV2) {
    console.error(`HATA: Beklenen ${expectedNullV2}, güncellenen ${r3.count}.`);
    process.exit(1);
  }

  // Son kontrol: NULL satır kalmadı mı?
  const remainingNull = await prisma.playHistory.count({ where: { validationStatus: null } });
  if (remainingNull !== 0) {
    console.error(`HATA: Backfill sonrası ${remainingNull} NULL satır kaldı!`);
    process.exit(1);
  }

  console.log(`\n✓ Backfill tamamlandı. Toplam güncellenen: ${r1.count + r2.count + r3.count}`);
}

main()
  .catch((e) => { console.error("HATA:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
