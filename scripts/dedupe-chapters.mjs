/**
 * Aynı kitap + aynı bölüm numarasına sahip mükerrer kayıtları temizler.
 *
 * Yükleyici iki terminalde aynı anda çalıştığında ortaya çıkıyor: her süreç
 * kitap listesini kendi başlangıcında belleğe alıp "bu bölüm zaten var mı"
 * kontrolünü o kopyadan yaptığı için diğerinin az önce yüklediğini göremiyor.
 * Tabloda (bookId, order) benzersizlik kısıtı olmadığından hata da vermiyor.
 *
 * Her gruptan bir satır bırakır, fazlalıkların hem kaydını hem S3 nesnesini
 * siler, sonra etkilenen kitapların süresini yeniden hesaplar.
 *
 * Varsayılan olarak SADECE RAPORLAR. Uygulamak için --yes gerekir.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";

const UYGULA = process.argv.includes("--yes");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const env = Object.fromEntries(
  fs.readFileSync(path.join(root, ".env"), "utf8").split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")]; })
);
const pool = new pg.Pool({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const s3 = new S3Client({
  region: env.AWS_REGION,
  credentials: { accessKeyId: env.AWS_ACCESS_KEY_ID, secretAccessKey: env.AWS_SECRET_ACCESS_KEY },
});

// Her gruptan en küçük id kalır, diğerleri silinecek
const { rows: silinecek } = await pool.query(`
  select c.id, c."bookId", c."order", c."s3Key", b.title
    from "Chapter" c
    join "Book" b on b.id = c."bookId"
   where c.id not in (
     select min(id) from "Chapter" group by "bookId", "order"
   )
   order by b.title, c."order"`);

if (silinecek.length === 0) { console.log("Mükerrer kayıt yok."); await pool.end(); process.exit(0); }

const kitapBazli = {};
for (const r of silinecek) kitapBazli[r.title] = (kitapBazli[r.title] ?? 0) + 1;
console.log(`Silinecek fazla satır: ${silinecek.length}  (${Object.keys(kitapBazli).length} kitapta)\n`);
Object.entries(kitapBazli).sort((a, b) => b[1] - a[1]).forEach(([t, n]) =>
  console.log(`   ${String(n).padStart(3)}  ${t.slice(0, 60)}`));

// Güvenlik: silinecek satırlara bağlı kullanıcı verisi var mı?
const ids = silinecek.map((r) => r.id);
for (const t of ["Bookmark", "PlayerState"]) {
  const { rows: [x] } = await pool.query(
    `select count(*)::int n from "${t}" where "chapterId" = any($1::text[])`, [ids]);
  if (x.n > 0) { console.error(`\n❌ İPTAL — ${t} tablosunda ${x.n} kayıt bu bölümlere bağlı.`); await pool.end(); process.exit(1); }
}
console.log("\n✓ Güvenlik kontrolü: silinecek satırlara bağlı yer imi / dinleme konumu yok");

if (!UYGULA) {
  console.log("\n🔍 SADECE RAPOR — hiçbir şey silinmedi.");
  console.log("Uygulamak için: node prisma/dedupe-chapters.mjs --yes");
  await pool.end();
  process.exit(0);
}

const c = await pool.connect();
try {
  await c.query("BEGIN");
  const d = await c.query(`delete from "Chapter" where id = any($1::text[])`, [ids]);
  if (d.rowCount !== ids.length) throw new Error(`Beklenen ${ids.length} silme, gerçekleşen ${d.rowCount}`);

  // Etkilenen kitapların süresini bölüm toplamına eşitle
  const bookIds = [...new Set(silinecek.map((r) => r.bookId))];
  const u = await c.query(`
    update "Book" b set duration = t.toplam, "updatedAt" = now()
      from (select "bookId" id, sum(duration)::int toplam from "Chapter"
             where "bookId" = any($1::text[]) group by "bookId") t
     where b.id = t.id and b.duration is distinct from t.toplam`, [bookIds]);

  const { rows: [kalan] } = await c.query(
    `select count(*)::int n from (select 1 from "Chapter" group by "bookId","order" having count(*)>1) t`);
  if (kalan.n > 0) throw new Error(`${kalan.n} mükerrer grup kaldı — iptal`);

  await c.query("COMMIT");
  console.log(`\n✓ Veritabanı: ${d.rowCount} fazla satır silindi`);
  console.log(`✓ ${u.rowCount} kitabın süresi yeniden hesaplandı`);
} catch (e) {
  await c.query("ROLLBACK");
  console.error("\n❌ ROLLBACK — hiçbir şey silinmedi:", e.message);
  c.release(); await pool.end();
  process.exit(1);
} finally { c.release(); }

let ok = 0, hata = 0;
for (const r of silinecek) {
  if (!r.s3Key) continue;
  try { await s3.send(new DeleteObjectCommand({ Bucket: env.AWS_S3_BUCKET, Key: r.s3Key })); ok++; }
  catch (e) { hata++; console.log(`   ⚠ S3 silinemedi: ${r.s3Key} — ${e.message}`); }
}
console.log(`✓ S3: ${ok} fazla nesne silindi${hata ? `, ${hata} hata` : ""}`);

const { rows: [t] } = await pool.query(`select count(*)::int n from "Chapter"`);
console.log(`\n✅ Tamamlandı. Toplam bölüm: ${t.n}`);
await pool.end();
