/**
 * Mükerrer kitap temizliği — 20 Eylül 2026
 *
 * 14.09.2026'da seed ile eklenen 3 boş kaydı siler (0 bölüm, 0 süre, hiçbir
 * pakete/favoriye/dinleme geçmişine bağlı değil). Silmeden önce bu kayıtların
 * taşıdığı seri bilgisini sesleri barındıran gerçek kayda devreder.
 *
 * Tek transaction içinde çalışır; bağlı veri bulursa hiçbir şey yapmadan geri alır.
 *
 * Çalıştır: node prisma/fix-duplicate-books.mjs
 * Önce dene (hiçbir şey yazmaz): node prisma/fix-duplicate-books.mjs --dry-run
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import { assertNotProd } from "../scripts/lib/prod-guard.mjs";
import { pgSsl } from "../scripts/lib/pg-ssl.mjs";

const DRY_RUN = process.argv.includes("--dry-run");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const env = fs.readFileSync(path.join(root, process.env.ENV_FILE ?? ".env"), "utf8");
const url = env.match(/^DATABASE_URL\s*=\s*"?([^"\n]+)"?/m)[1];

assertNotProd(url, "fix-duplicate-books");

const pool = new pg.Pool({ connectionString: url, ssl: pgSsl(url) });

const SERIES = "cser_turk_klasikleri_001";
const pairs = [
  { seed: "cser_book_mesakk_001",    real: "cmty8013000ixtit3slesip7h", order: 17, setSeries: false, ad: "Meşakk-ı Hayat" },
  { seed: "cser_book_meyhanede_001", real: "cmty8013000iytit3s37ds9fu", order: 18, setSeries: true,  ad: "Meyhanede Kadınlar" },
  { seed: "cser_book_taassuk_001",   real: "cmty80lcc00ontit3xajlwdhz", order: 6,  setSeries: false, ad: "Taaşşuk-ı Talat ve Fitnat" },
];

const c = await pool.connect();
try {
  await c.query("BEGIN");

  // 1) Güvenlik: seed kayıtlarına bu arada veri bağlanmışsa iptal et
  const seeds = pairs.map((p) => p.seed);
  const { rows: [g] } = await c.query(
    `select
       (select count(*)::int from "Chapter"      where "bookId" = any($1::text[])) ch,
       (select count(*)::int from "PackageBook"  where "bookId" = any($1::text[])) pb,
       (select count(*)::int from "UserFavorite" where "bookId" = any($1::text[])) uf,
       (select count(*)::int from "PlayHistory"  where "bookId" = any($1::text[])) ph,
       (select count(*)::int from "Bookmark"     where "bookId" = any($1::text[])) bm,
       (select count(*)::int from "PlayerState"  where "bookId" = any($1::text[])) ps`,
    [seeds]
  );
  const bagli = Object.values(g).reduce((a, b) => a + b, 0);
  if (bagli > 0) throw new Error("İPTAL — seed kayıtlarına bağlı veri oluşmuş: " + JSON.stringify(g));
  console.log("✓ Güvenlik kontrolü: seed kayıtlarında bölüm/paket/favori/geçmiş yok");

  // 2) Seri bilgisini sesleri olan gerçek kayda taşı
  for (const p of pairs) {
    const r = p.setSeries
      ? await c.query(
          `update "Book" set "seriesId"=$1, "seriesOrder"=$2, "updatedAt"=now() where id=$3`,
          [SERIES, p.order, p.real]
        )
      : await c.query(
          `update "Book" set "seriesOrder"=$1, "updatedAt"=now() where id=$2`,
          [p.order, p.real]
        );
    console.log(`✓ ${p.ad}: gerçek kayda seriesOrder=${p.order}${p.setSeries ? " + seriesId" : ""} atandı (${r.rowCount} satır)`);
  }

  // 3) Seed kayıtlarını sil
  const del = await c.query(`delete from "Book" where id = any($1::text[]) returning id, title`, [seeds]);
  del.rows.forEach((r) => console.log(`🗑  silindi: ${r.id} — "${r.title}"`));
  if (del.rowCount !== 3) throw new Error(`Beklenen 3 silme, gerçekleşen ${del.rowCount}`);

  if (DRY_RUN) {
    await c.query("ROLLBACK");
    console.log("\n🔍 DRY RUN — hiçbir değişiklik kaydedilmedi (geri alındı)");
  } else {
    await c.query("COMMIT");
    console.log("\n✅ COMMIT — işlem tamamlandı");
  }
} catch (e) {
  await c.query("ROLLBACK");
  console.error("\n❌ ROLLBACK — hiçbir değişiklik yapılmadı:", e.message);
  process.exitCode = 1;
} finally {
  c.release();
}

// Doğrulama
const q = async (s) => (await pool.query(s)).rows;
console.log("\n=== SONRASI ===");
console.log("Toplam kitap:", (await q(`select count(*)::int n from "Book"`))[0].n);
console.log("Kalan cser_book_* kaydı:", (await q(`select count(*)::int n from "Book" where id like 'cser_book_%'`))[0].n);
console.table(await q(`select title, isbn, "seriesOrder" from "Book"
  where id in ('cmty8013000ixtit3slesip7h','cmty8013000iytit3s37ds9fu','cmty80lcc00ontit3xajlwdhz')`));
const dup = await q(`select isbn, count(*)::int n from "Book" where isbn is not null group by isbn having count(*)>1`);
console.log("Aynı ISBN'li kalan grup:", dup.length ? JSON.stringify(dup) : "yok ✓");
await pool.end();
