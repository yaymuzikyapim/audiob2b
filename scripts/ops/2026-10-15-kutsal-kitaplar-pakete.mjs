/**
 * 6 kutsal kitabı "Demo" paketine ekler (Adım — 15 Ekim 2026).
 *
 * Kitaplar: Kur'an-ı Kerim, Zebur, İncil, Tevrat, Kutsal Kitap,
 *           Süleyman Peygamber'in Özdeyişler Kitabı
 * Paket: Demo (cmtidmqn3000004jpk8q6lzze) — 4 şirket kullanıyor.
 *
 * Kullanım:
 *   ENV_FILE=.env.prod node scripts/ops/2026-10-15-kutsal-kitaplar-pakete.mjs           # kuru çalıştırma
 *   ALLOW_PROD=1 ENV_FILE=.env.prod node scripts/ops/... --apply    # canlıda uygula
 *
 * --apply, ALLOW_PROD=1 olmadan çalışmaz. Kuru çalıştırma hiçbir şey yazmaz.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import { assertNotProd, canliMi, refEtiketi } from "../lib/prod-guard.mjs";
import { pgSsl } from "../lib/pg-ssl.mjs";
import "../lib/pg-utc.mjs";

const UYGULA = process.argv.includes("--apply");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const envDosya = process.env.ENV_FILE ?? ".env";
const env = Object.fromEntries(
  fs.readFileSync(path.join(root, envDosya), "utf8").split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")]; })
);

const PAKET_ID   = "cmtidmqn3000004jpk8q6lzze"; // Demo
const KITAP_IDLER = [
  "bk_9786258477764", // Kur'an-ı Kerim
  "bk_9786258477931", // Zebur (Mezmurlar)
  "bk_9786258477887", // Kutsal Kitap (Tevrat, Zebur ve İncil)
  "bk_9786258477955", // Tevrat (Eski Antlaşma / Tanah)
  "bk_9786258477924", // Süleyman Peygamber'in Özdeyişler Kitabı
  "bk_9786258477856", // İncil
];
const BEKLENEN = 6;

// ── Hedef yazdırma ────────────────────────────────────────────────────────────
function hedefEtiketi(url) {
  const m = /@?(localhost|127\.0\.0\.1|\[::1\]):(\d+)\/([^?]+)/.exec(String(url ?? ""));
  if (m) return `${m[1]}:${m[2]}/${m[3]}`;
  return canliMi(url) ? `CANLI (${refEtiketi(url)})` : `bilinmeyen (${refEtiketi(url)})`;
}

console.log(`\nHEDEF  : ${hedefEtiketi(env.DATABASE_URL)}`);
console.log(`ENV    : ${envDosya}`);
console.log(`MOD    : ${UYGULA ? "UYGULA (--apply)" : "KURU ÇALIŞTIRMA (salt okuma)"}`);
console.log(`KİTAP  : ${KITAP_IDLER.length} adet`);
console.log(`PAKET  : ${PAKET_ID} (Demo)\n`);

if (UYGULA) {
  if (process.env.ALLOW_PROD !== "1") {
    console.error("⛔ --apply yalnızca ALLOW_PROD=1 ile çalışır.\n   ALLOW_PROD=1 ENV_FILE=.env.prod node scripts/ops/2026-10-15-kutsal-kitaplar-pakete.mjs --apply\n");
    process.exit(1);
  }
  assertNotProd(env.DATABASE_URL, "2026-10-15-kutsal-kitaplar-pakete");
} else if (canliMi(env.DATABASE_URL)) {
  console.log("NOT    : canlı veritabanına SALT OKUMA bağlanılıyor.\n");
}

const pool = new pg.Pool({ connectionString: env.DATABASE_URL, ssl: pgSsl(env.DATABASE_URL) });
const c = await pool.connect();

// ── AŞAMA A — salt okuma ──────────────────────────────────────────────────────
await c.query("BEGIN READ ONLY");
await c.query("SET LOCAL statement_timeout = '30s'");

// Kitap bilgileri
const { rows: kitaplar } = await c.query(`
  SELECT b.id, b.isbn, b.title, b."isActive",
    (SELECT COUNT(*)::int FROM "Chapter" x WHERE x."bookId" = b.id) AS bolum,
    EXISTS(SELECT 1 FROM "PackageBook" pb WHERE pb."bookId" = b.id AND pb."packageId" = $2) AS demo_da_var
  FROM "Book" b
  WHERE b.id = ANY($1::text[])
  ORDER BY b.id`, [KITAP_IDLER, PAKET_ID]);

// Paket durumu
const { rows: [paket] } = await c.query(`
  SELECT name, (SELECT COUNT(*)::int FROM "PackageBook" WHERE "packageId" = id) AS kitap_sayisi
  FROM "Package" WHERE id = $1`, [PAKET_ID]);

// Demo kullanan şirketler — kütüphane filtresiyle aynı mantık: isActive + en az 1 chapter
const { rows: sirket_sayilari } = await c.query(`
  SELECT co.name,
    (SELECT COUNT(DISTINCT pb."bookId")::int
     FROM "PackageBook" pb
     JOIN "Book" b ON b.id = pb."bookId"
     WHERE pb."packageId" = $1
       AND b."isActive" = true
       AND EXISTS (SELECT 1 FROM "Chapter" c WHERE c."bookId" = b.id)
    ) AS gorunen_kitap
  FROM "Company" co WHERE co."packageId" = $1 ORDER BY co.name`, [PAKET_ID]);

await c.query("ROLLBACK");

// Rapor
console.log("id                   isbn            bolum  demo_da_var  başlık");
console.log("─".repeat(95));
for (const k of kitaplar) {
  console.log(
    `${k.id.padEnd(20)} ${k.isbn}  ${String(k.bolum).padStart(5)}  ${String(k.demo_da_var).padEnd(11)}  ${k.title}`
  );
}
console.log(`\nDemo paketi şu an: ${paket?.name ?? "?"} — ${paket?.kitap_sayisi ?? "?"} kitap`);
console.log("\nDemo şirketleri — kütüphanede görünen (önce):");
for (const s of sirket_sayilari) {
  console.log(`  ${s.name.padEnd(22)} ${s.gorunen_kitap}`);
}

// Beklenti kontrolleri
const bulunanlar = new Set(kitaplar.map((k) => k.id));
const eksik = KITAP_IDLER.filter((id) => !bulunanlar.has(id));
const demoda = kitaplar.filter((k) => k.demo_da_var);
const pasif = kitaplar.filter((k) => !k.isActive);
const bolumsuz = kitaplar.filter((k) => k.bolum === 0);

const sapmalar = [];
if (eksik.length)   sapmalar.push(`Katalogda bulunamayan kitap (${eksik.length}): ${eksik.join(", ")}`);
if (demoda.length)  sapmalar.push(`Zaten Demo'da olan kitap (${demoda.length}): ${demoda.map((k) => k.id).join(", ")}`);
if (pasif.length)   sapmalar.push(`Pasif kitap (${pasif.length}): ${pasif.map((k) => k.id).join(", ")}`);
if (bolumsuz.length) sapmalar.push(`Bölümsüz kitap (${bolumsuz.length}): ${bolumsuz.map((k) => k.id).join(", ")}`);

if (sapmalar.length) {
  console.log("\n⛔ SAPMA VAR — hiçbir değişiklik yapılmayacak:");
  sapmalar.forEach((s) => console.log(`   • ${s}`));
  c.release(); await pool.end();
  process.exit(1);
}
console.log(`\n✓ Beklentiler karşılandı: ${kitaplar.length} kitap, hepsi aktif, hepsi bölümlü, hiçbiri Demo'da değil.`);

if (!UYGULA) {
  console.log("\nKURU ÇALIŞTIRMA — hiçbir değişiklik yapılmadı.");
  console.log(`Uygulamak için: ALLOW_PROD=1 ENV_FILE=.env.prod node ${path.relative(root, fileURLToPath(import.meta.url))} --apply\n`);
  c.release(); await pool.end();
  process.exit(0);
}

// ── AŞAMA B — tek transaction ─────────────────────────────────────────────────
const oncekiGorunen = sirket_sayilari.map((s) => ({ ...s })); // snapshot

try {
  await c.query("BEGIN");
  await c.query("SET LOCAL statement_timeout = '30s'");

  // Pre-check: hiçbiri Demo'da olmamalı (transaction içinde tekrar doğrula)
  const { rows: zatenVar } = await c.query(`
    SELECT "bookId" FROM "PackageBook"
    WHERE "packageId" = $1 AND "bookId" = ANY($2::text[])`, [PAKET_ID, KITAP_IDLER]);

  if (zatenVar.length > 0) {
    await c.query("ROLLBACK");
    console.error(`⛔ ROLLBACK — transaction içi pre-check başarısız: ${zatenVar.length} kitap zaten Demo'da.`);
    c.release(); await pool.end();
    process.exit(1);
  }

  // INSERT
  const { rowCount } = await c.query(`
    INSERT INTO "PackageBook" ("packageId", "bookId")
    SELECT $1, UNNEST($2::text[])`, [PAKET_ID, KITAP_IDLER]);

  console.log(`\nINSERT etkilenen satır: ${rowCount}`);

  if (rowCount !== BEKLENEN) {
    await c.query("ROLLBACK");
    console.error(`⛔ ROLLBACK — ${BEKLENEN} satır beklenirken ${rowCount} eklendi.`);
    c.release(); await pool.end();
    process.exit(1);
  }

  await c.query("COMMIT");
  console.log("✓ COMMIT");
} catch (e) {
  await c.query("ROLLBACK").catch(() => {});
  console.error("⛔ ROLLBACK —", e.message);
  c.release(); await pool.end();
  process.exit(1);
}

// ── Sonrası doğrulama ─────────────────────────────────────────────────────────
await c.query("BEGIN READ ONLY");

const { rows: [sonPaket] } = await c.query(`
  SELECT (SELECT COUNT(*)::int FROM "PackageBook" WHERE "packageId" = id) AS kitap_sayisi
  FROM "Package" WHERE id = $1`, [PAKET_ID]);

const { rows: sonSirket } = await c.query(`
  SELECT co.name,
    (SELECT COUNT(DISTINCT pb."bookId")::int
     FROM "PackageBook" pb
     JOIN "Book" b ON b.id = pb."bookId"
     WHERE pb."packageId" = $1
       AND b."isActive" = true
       AND EXISTS (SELECT 1 FROM "Chapter" c WHERE c."bookId" = b.id)
    ) AS gorunen_kitap
  FROM "Company" co WHERE co."packageId" = $1 ORDER BY co.name`, [PAKET_ID]);

// TPAO-Demo kontrolü
const { rows: [tpaoPaket] } = await c.query(`
  SELECT p.name, COUNT(pb."bookId")::int AS kitap_sayisi
  FROM "Package" p LEFT JOIN "PackageBook" pb ON pb."packageId" = p.id
  WHERE p.name = 'TPAO-Demo' GROUP BY p.id, p.name`);

await c.query("ROLLBACK");
c.release();
await pool.end();

console.log("\n=== SONRASI DOĞRULAMA ===");
console.log(`Demo kitap sayısı    : ${paket?.kitap_sayisi} → ${sonPaket?.kitap_sayisi} (fark ${(sonPaket?.kitap_sayisi ?? 0) - (paket?.kitap_sayisi ?? 0)}, beklenen +${BEKLENEN})`);
console.log(`TPAO-Demo kitap say. : ${tpaoPaket?.kitap_sayisi} (değişmemeli, beklenen 6)`);
console.log("\nDemo şirketleri — kütüphanede görünen (önce → sonra):");
for (const s of sonSirket) {
  const onceki = oncekiGorunen.find((o) => o.name === s.name)?.gorunen_kitap ?? "?";
  const fark   = typeof onceki === "number" ? ` (fark ${s.gorunen_kitap - onceki}, beklenen +${BEKLENEN})` : "";
  console.log(`  ${s.name.padEnd(22)} ${onceki} → ${s.gorunen_kitap}${fark}`);
}

const demokitap_ok = sonPaket?.kitap_sayisi === (paket?.kitap_sayisi ?? 0) + BEKLENEN;
const tpaoOk       = tpaoPaket?.kitap_sayisi === 6;
const sirketOk     = sonSirket.every((s) => {
  const onceki = oncekiGorunen.find((o) => o.name === s.name)?.gorunen_kitap;
  return typeof onceki === "number" && s.gorunen_kitap === onceki + BEKLENEN;
});

if (demokitap_ok && tpaoOk && sirketOk) {
  console.log("\n✓ Tüm doğrulamalar geçti.");
} else {
  console.error("\n⚠  Doğrulama uyarısı — sayılar beklenenden farklı, manuel kontrol gerekli.");
  process.exit(1);
}
