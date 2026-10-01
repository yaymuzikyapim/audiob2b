/**
 * Bir kitabın yüklü bölümlerini siler — hem veritabanından hem S3'ten.
 *
 * Yanlış ses dosyaları yüklendiğinde, kitabı sıfırlayıp yeniden yüklemek için.
 * Kitap kaydının kendisine dokunmaz; yalnızca bölümleri siler ve süreyi 0'lar.
 *
 * Varsayılan olarak SADECE RAPORLAR. Gerçekten silmek için --yes gerekir.
 *
 *   node prisma/reset-book-chapters.mjs --isbn 9786258477764
 *   node prisma/reset-book-chapters.mjs --isbn 9786258477764 --yes
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";

const arg = (n) => { const i = process.argv.indexOf(`--${n}`); return i !== -1 ? process.argv[i + 1] : null; };
const ISBN = arg("isbn");
const YES = process.argv.includes("--yes");

if (!ISBN) {
  console.error("Kullanım: node prisma/reset-book-chapters.mjs --isbn <isbn> [--yes]");
  process.exit(1);
}

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

const { rows: kitaplar } = await pool.query(
  `select id, title, duration from "Book" where isbn = $1`, [ISBN]);
if (kitaplar.length !== 1) {
  console.error(`ISBN ${ISBN} için ${kitaplar.length} kitap bulundu — 1 bekleniyordu`);
  await pool.end();
  process.exit(1);
}
const kitap = kitaplar[0];

const { rows: bolumler } = await pool.query(
  `select id, "order", title, duration, "s3Key" from "Chapter" where "bookId" = $1 order by "order"`,
  [kitap.id]);

console.log(`Kitap: "${kitap.title}" (ISBN ${ISBN})`);
console.log(`Silinecek bölüm: ${bolumler.length}`);
console.log(`Toplam süre: ${Math.floor(kitap.duration / 3600)}sa ${Math.round((kitap.duration % 3600) / 60)}d\n`);

if (bolumler.length === 0) { console.log("Silinecek bölüm yok."); await pool.end(); process.exit(0); }

if (!YES) {
  console.log("🔍 SADECE RAPOR — hiçbir şey silinmedi.");
  console.log(`Gerçekten silmek için:  node prisma/reset-book-chapters.mjs --isbn ${ISBN} --yes`);
  await pool.end();
  process.exit(0);
}

// 1) Veritabanı — önce burası. (Ters sırada S3 silinip DB kalsaydı,
//    kayıtlar olmayan dosyalara işaret ederdi.)
const c = await pool.connect();
try {
  await c.query("BEGIN");
  const d = await c.query(`delete from "Chapter" where "bookId" = $1`, [kitap.id]);
  if (d.rowCount !== bolumler.length) throw new Error(`Beklenen ${bolumler.length} silme, gerçekleşen ${d.rowCount}`);
  await c.query(`update "Book" set duration = 0, "updatedAt" = now() where id = $1`, [kitap.id]);
  await c.query("COMMIT");
  console.log(`✓ Veritabanı: ${d.rowCount} bölüm silindi, kitap süresi 0'landı`);
} catch (e) {
  await c.query("ROLLBACK");
  console.error("❌ ROLLBACK — hiçbir şey silinmedi:", e.message);
  await c.release(); await pool.end();
  process.exit(1);
} finally { c.release(); }

// 2) S3 — buradaki hata veritabanını etkilemez, artık dosya kalırsa sonra temizlenir
let ok = 0, hata = 0;
for (const b of bolumler) {
  if (!b.s3Key) continue;
  try {
    await s3.send(new DeleteObjectCommand({ Bucket: env.AWS_S3_BUCKET, Key: b.s3Key }));
    ok++;
  } catch (e) {
    hata++;
    console.log(`   ⚠ S3 silinemedi: ${b.s3Key} — ${e.message}`);
  }
}
console.log(`✓ S3: ${ok} nesne silindi${hata ? `, ${hata} hata (artık dosya kaldı)` : ""}`);

console.log(`\n✅ "${kitap.title}" sıfırlandı. Şimdi yeniden yükleyebilirsin:`);
console.log(`   npx tsx prisma/upload-from-drive.ts --isbn ${ISBN}`);
await pool.end();
