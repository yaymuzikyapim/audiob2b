/**
 * Sesi olmayan 21 aktif kitabı pasife alır (Adım 0-D, 15 Ekim 2026).
 *
 * Gerekçe: bu 21 kitabın katalog kaydı var ama hiç Chapter'ı yok. Kütüphane
 * sorguları `chapters: { some: {} }` ile onları zaten gizliyor; admin panelinde
 * ise "aktif" görünüp sayımları şişiriyorlar. isActive=false yapılarak katalog
 * sayıları gerçeğe hizalanır. Ses dosyaları yüklendiğinde geri alınır.
 *
 * Kullanım:
 *   node scripts/ops/2026-10-15-pasif-sessiz-kitaplar.mjs            # kuru çalıştırma (salt okuma)
 *   ENV_FILE=.env.dev node scripts/ops/...                            # geliştirme DB'si
 *   ALLOW_PROD=1 node scripts/ops/... --apply                         # canlıda uygula
 *
 * --apply, ALLOW_PROD=1 olmadan çalışmaz. Kuru çalıştırma hiçbir şey yazmaz.
 * Kişisel veri yazdırılmaz: kullanıcı adı/e-posta yok, yalnızca şirket adı + adet.
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
const env = Object.fromEntries(
  fs.readFileSync(path.join(root, process.env.ENV_FILE ?? ".env"), "utf8").split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")]; })
);

const ISBNLER = [
  "9786255578709", "9786256316737", "9786256316744", "9786256316751", "9786256316768",
  "9786256316775", "9786059795883", "9786257888240", "9786055212452", "9786057144638",
  "9786257888066", "9786055212650", "9786059795876", "9786059795807", "9786257888226",
  "9786257888547", "9786257888127", "9786059795661", "9786255578778", "9786257101332",
  "9786258320657",
];
const BEKLENEN = 21;

// ── Hedef yazdırma (CLAUDE.md Güvenlik Kuralı 4) ────────────────────────────
function hedefEtiketi(url) {
  const m = /@?(localhost|127\.0\.0\.1|\[::1\]):(\d+)\/([^?]+)/.exec(String(url ?? ""));
  if (m) return `${m[1]}:${m[2]}/${m[3]}`;
  return canliMi(url) ? `CANLI (${refEtiketi(url)})` : `bilinmeyen (${refEtiketi(url)})`;
}

console.log(`\nHEDEF : ${hedefEtiketi(env.DATABASE_URL)}`);
console.log(`MOD   : ${UYGULA ? "UYGULA (--apply)" : "KURU ÇALIŞTIRMA (salt okuma)"}`);
console.log(`ISBN  : ${ISBNLER.length} adet (beklenen ${BEKLENEN})\n`);

if (ISBNLER.length !== BEKLENEN) {
  console.error(`⛔ ISBN listesi ${ISBNLER.length} adet, ${BEKLENEN} olmalı.`);
  process.exit(1);
}
if (UYGULA) {
  if (process.env.ALLOW_PROD !== "1") {
    console.error("⛔ --apply yalnızca ALLOW_PROD=1 ile çalışır.\n   ALLOW_PROD=1 node scripts/ops/2026-10-15-pasif-sessiz-kitaplar.mjs --apply\n");
    process.exit(1);
  }
  // Yazma yolu prod korumasından geçer; kuru çalıştırma salt okuma olduğu için geçmez.
  assertNotProd(env.DATABASE_URL, "2026-10-15-pasif-sessiz-kitaplar");
} else if (canliMi(env.DATABASE_URL)) {
  console.log("NOT   : canlı veritabanına SALT OKUMA bağlanılıyor (BEGIN READ ONLY).\n");
}

const pool = new pg.Pool({ connectionString: env.DATABASE_URL, ssl: pgSsl(env.DATABASE_URL) });
const c = await pool.connect();

// ── AŞAMA A — salt okuma ────────────────────────────────────────────────────
await c.query("BEGIN READ ONLY");
await c.query("SET LOCAL statement_timeout = '30s'");

const { rows: kitaplar } = await c.query(`
  select b.isbn, b.id, b.title, b."isActive",
         (select count(*)::int from "Chapter"      x where x."bookId" = b.id) as bolum,
         (select count(*)::int from "PlayHistory"  x where x."bookId" = b.id) as dinleme,
         (select count(*)::int from "UserFavorite" x where x."bookId" = b.id) as favori,
         (select count(*)::int from "PlayerState"  x where x."bookId" = b.id) as oynatici,
         (select count(*)::int from "Bookmark"     x where x."bookId" = b.id) as yerimi,
         (select count(*)::int from "PackageBook"  x where x."bookId" = b.id) as pakette
  from "Book" b where b.isbn = any($1::text[]) order by b.isbn, b.id`, [ISBNLER]);

const { rows: [ozet] } = await c.query(`
  select (select count(*)::int from "Book" where "isActive") as aktif_kitap,
         (select count(*)::int from "Book" b where b."isActive"
            and exists (select 1 from "Chapter" c where c."bookId" = b.id)) as kutuphanede_gorunen,
         (select count(*)::int from "Book") as tum_kitap`);

const { rows: sirketler } = await c.query(`
  with hedef as (select id from "Book" where isbn = any($1::text[]))
  select coalesce(co.name, '(şirketsiz)') as sirket,
         count(*) filter (where k.tur = 'favori')   as favori,
         count(*) filter (where k.tur = 'oynatici') as oynatici,
         count(*) filter (where k.tur = 'yerimi')   as yerimi
  from (
    select "userId", 'favori'   as tur from "UserFavorite" where "bookId" in (select id from hedef)
    union all select "userId", 'oynatici' from "PlayerState"  where "bookId" in (select id from hedef)
    union all select "userId", 'yerimi'   from "Bookmark"     where "bookId" in (select id from hedef)
  ) k
  join "User" u on u.id = k."userId"
  left join "Company" co on co.id = u."companyId"
  group by 1 order by 1`, [ISBNLER]);

await c.query("ROLLBACK");

// ── Rapor ───────────────────────────────────────────────────────────────────
const bulunan = new Set(kitaplar.map((k) => k.isbn));
const eksik = ISBNLER.filter((i) => !bulunan.has(i));
const sayim = {};
for (const k of kitaplar) sayim[k.isbn] = (sayim[k.isbn] ?? 0) + 1;
const mukerrer = Object.entries(sayim).filter(([, n]) => n > 1);
const pasifOlanlar = kitaplar.filter((k) => !k.isActive);
const bolumluler = kitaplar.filter((k) => k.bolum > 0);
const dinlemeliler = kitaplar.filter((k) => k.dinleme > 0);

console.log("ISBN            bölüm dinleme favori oynatıcı yerimi pakette aktif  başlık");
console.log("─".repeat(100));
for (const k of kitaplar) {
  console.log(
    `${k.isbn}  ${String(k.bolum).padStart(5)} ${String(k.dinleme).padStart(7)} ` +
    `${String(k.favori).padStart(6)} ${String(k.oynatici).padStart(9)} ${String(k.yerimi).padStart(6)} ` +
    `${String(k.pakette).padStart(7)}  ${k.isActive ? "evet " : "HAYIR"}  ${k.title}`
  );
}

console.log(`\nBulunan kitap : ${kitaplar.length} / ${BEKLENEN}`);
console.log(`Tüm kitap     : ${ozet.tum_kitap}`);
console.log(`Aktif kitap   : ${ozet.aktif_kitap}`);
console.log(`Kütüphanede görünen (aktif + en az 1 bölüm) : ${ozet.kutuphanede_gorunen}`);

if (sirketler.length) {
  console.log("\nHedef kitaplara bağlı kullanıcı kaydı (şirket adı + adet; kişi bilgisi yok):");
  console.log("  şirket                  favori oynatıcı yerimi");
  for (const s of sirketler) {
    console.log(`  ${s.sirket.padEnd(22)} ${String(s.favori).padStart(6)} ${String(s.oynatici).padStart(9)} ${String(s.yerimi).padStart(6)}`);
  }
} else {
  console.log("\nHedef kitaplara bağlı favori / oynatıcı durumu / yer imi kaydı yok.");
}

const sapmalar = [];
if (eksik.length) sapmalar.push(`Katalogda bulunamayan ISBN (${eksik.length}): ${eksik.join(", ")}`);
if (mukerrer.length) sapmalar.push(`Aynı ISBN'li birden fazla kitap: ${mukerrer.map(([i, n]) => `${i} (${n})`).join(", ")}`);
if (pasifOlanlar.length) sapmalar.push(`Zaten pasif kitap (${pasifOlanlar.length}): ${pasifOlanlar.map((k) => k.isbn).join(", ")}`);
if (bolumluler.length) sapmalar.push(`Bölümü OLAN kitap (${bolumluler.length}): ${bolumluler.map((k) => `${k.isbn} (${k.bolum} bölüm)`).join(", ")}`);
if (dinlemeliler.length) sapmalar.push(`Dinleme kaydı OLAN kitap (${dinlemeliler.length}): ${dinlemeliler.map((k) => `${k.isbn} (${k.dinleme})`).join(", ")}`);

if (sapmalar.length) {
  console.log("\n⛔ SAPMA VAR — hiçbir değişiklik yapılmadı:");
  sapmalar.forEach((s) => console.log(`   • ${s}`));
  c.release(); await pool.end();
  process.exit(1);
}
console.log("\n✓ Beklentiler karşılandı: 21 kitap, hepsi aktif, hepsinde bölüm 0 ve dinleme 0.");

if (!UYGULA) {
  console.log("\nKURU ÇALIŞTIRMA — hiçbir değişiklik yapılmadı.");
  console.log(`Uygulamak için: ALLOW_PROD=1 node ${path.relative(root, fileURLToPath(import.meta.url))} --apply\n`);
  c.release(); await pool.end();
  process.exit(0);
}

// ── AŞAMA B — tek transaction ───────────────────────────────────────────────
try {
  await c.query("BEGIN");
  await c.query("SET LOCAL statement_timeout = '30s'");
  const r = await c.query(`
    update "Book" set "isActive" = false, "updatedAt" = now()
    where isbn = any($1::text[]) and "isActive" = true
      and not exists (select 1 from "Chapter" c where c."bookId" = "Book".id)
    returning isbn, to_char("updatedAt",'YYYY-MM-DD HH24:MI:SS.MS') as damga`, [ISBNLER]);

  console.log(`\nUPDATE etkilenen satır: ${r.rowCount}`);
  // Damga METİN olarak okunur: node-postgres "timestamp without time zone"
  // değerini yerel saat sanıp UTC'ye kaydırıyor (15 Ekim 2026'da 3 saat sapma
  // yarattı ve yazdırılan geri alma koşulu 0 satır hedefledi).
  const damgalar = [...new Set(r.rows.map((x) => x.damga))];
  console.log(`updatedAt damgası (${damgalar.length} farklı): ${damgalar.join(", ")}`);
  if (damgalar.length !== 1) {
    await c.query("ROLLBACK");
    console.error("⛔ ROLLBACK — updatedAt damgası tek değil; geri alma koşulu kurulamaz.");
    c.release(); await pool.end();
    process.exit(1);
  }
  if (r.rowCount !== BEKLENEN) {
    await c.query("ROLLBACK");
    console.error(`⛔ ROLLBACK — ${BEKLENEN} satır beklenirken ${r.rowCount} etkilendi.`);
    c.release(); await pool.end();
    process.exit(1);
  }
  await c.query("COMMIT");
  console.log("✓ COMMIT");
  console.log(`\nGERİ ALMA (yalnızca bu işlemin değiştirdiği satırlar):`);
  console.log(`  UPDATE "Book" SET "isActive" = true`);
  console.log(`  WHERE isbn = ANY(ARRAY[...21 ISBN...])`);
  console.log(`    AND "isActive" = false`);
  console.log(`    AND "updatedAt" = '${damgalar[0]}'::timestamp;   -- UTC, DB'nin yazdığı ham değer`);
} catch (e) {
  await c.query("ROLLBACK").catch(() => {});
  console.error("⛔ ROLLBACK —", e.message);
  c.release(); await pool.end();
  process.exit(1);
}

// ── Sonrası doğrulama ───────────────────────────────────────────────────────
await c.query("BEGIN READ ONLY");
const { rows: [son] } = await c.query(`
  select (select count(*)::int from "Book" where "isActive") as aktif_kitap,
         (select count(*)::int from "Book" b where b."isActive"
            and exists (select 1 from "Chapter" c where c."bookId" = b.id)) as kutuphanede_gorunen`);
const { rows: sonKitaplar } = await c.query(
  `select isbn, "isActive" from "Book" where isbn = any($1::text[]) order by isbn`, [ISBNLER]);
await c.query("ROLLBACK");

console.log("\n=== SONRASI ===");
console.log(`Aktif kitap   : ${ozet.aktif_kitap} → ${son.aktif_kitap} (fark ${son.aktif_kitap - ozet.aktif_kitap}, beklenen -${BEKLENEN})`);
console.log(`Kütüphanede görünen : ${ozet.kutuphanede_gorunen} → ${son.kutuphanede_gorunen} (fark ${son.kutuphanede_gorunen - ozet.kutuphanede_gorunen}, beklenen 0)`);
const halaAktif = sonKitaplar.filter((k) => k.isActive);
console.log(`21 kitabın isActive=false doğrulaması : ${sonKitaplar.length - halaAktif.length}/${sonKitaplar.length}` +
  (halaAktif.length ? ` — HÂLÂ AKTİF: ${halaAktif.map((k) => k.isbn).join(", ")}` : " ✓"));

c.release();
await pool.end();
