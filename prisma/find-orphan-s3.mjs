/**
 * S3'te olup veritabanında karşılığı olmayan ses dosyalarını bulur.
 *
 * Yükleme sırası "önce S3, sonra Chapter kaydı" olduğu için, veritabanı
 * bağlantısı S3 yüklemesinden sonra koparsa dosya S3'te kalır ama hiçbir
 * kayıt ona işaret etmez. Yeniden denemede yeni bir anahtar üretildiğinden
 * eski dosya sonsuza kadar orada durur ve depolama maliyeti yaratır.
 *
 * Varsayılan olarak SADECE RAPORLAR. Silmek için --delete gerekir.
 *
 *   node prisma/find-orphan-s3.mjs
 *   node prisma/find-orphan-s3.mjs --delete
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from "@aws-sdk/client-s3";

const SIL = process.argv.includes("--delete");
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

// Veritabanındaki tüm anahtarlar
const { rows } = await pool.query(`select "s3Key" from "Chapter" where "s3Key" is not null`);
const kayitli = new Set(rows.map((r) => r.s3Key));
console.log(`Veritabanındaki bölüm anahtarı: ${kayitli.size}`);

// S3'teki tüm bölüm nesneleri
const artiklar = [];
let toplam = 0, boyut = 0, token;
do {
  const r = await s3.send(new ListObjectsV2Command({
    Bucket: env.AWS_S3_BUCKET, Prefix: "books/", ContinuationToken: token,
  }));
  for (const o of r.Contents ?? []) {
    if (!o.Key.endsWith(".mp3")) continue;
    toplam++;
    if (!kayitli.has(o.Key)) { artiklar.push(o.Key); boyut += o.Size ?? 0; }
  }
  token = r.IsTruncated ? r.NextContinuationToken : undefined;
} while (token);

console.log(`S3'teki ses nesnesi:          ${toplam}`);
console.log(`\nSahipsiz (artık) nesne: ${artiklar.length}  —  ${(boyut / 1024 / 1024).toFixed(1)} MB`);

if (artiklar.length === 0) { console.log("Temizlenecek bir şey yok."); await pool.end(); process.exit(0); }

// Hangi kitaplara ait olduklarını göster
const kitapSay = {};
for (const k of artiklar) { const id = k.split("/")[1]; kitapSay[id] = (kitapSay[id] ?? 0) + 1; }
const ids = Object.keys(kitapSay);
const { rows: kitaplar } = await pool.query(`select id, title from "Book" where id = any($1::text[])`, [ids]);
const ad = Object.fromEntries(kitaplar.map((b) => [b.id, b.title]));
for (const [id, n] of Object.entries(kitapSay).sort((a, b) => b[1] - a[1])) {
  console.log(`   ${String(n).padStart(4)} dosya  ${ad[id] ?? "(kitabı silinmiş: " + id + ")"}`);
}

if (!SIL) {
  console.log(`\n🔍 SADECE RAPOR — hiçbir şey silinmedi.`);
  console.log(`Silmek için: node prisma/find-orphan-s3.mjs --delete`);
  await pool.end();
  process.exit(0);
}

let silinen = 0;
for (let i = 0; i < artiklar.length; i += 1000) {
  const grup = artiklar.slice(i, i + 1000);
  const r = await s3.send(new DeleteObjectsCommand({
    Bucket: env.AWS_S3_BUCKET,
    Delete: { Objects: grup.map((Key) => ({ Key })), Quiet: true },
  }));
  silinen += grup.length - (r.Errors?.length ?? 0);
  (r.Errors ?? []).forEach((e) => console.log(`   ⚠ silinemedi: ${e.Key} — ${e.Message}`));
}
console.log(`\n✅ ${silinen} artık nesne silindi (${(boyut / 1024 / 1024).toFixed(1)} MB)`);
await pool.end();
