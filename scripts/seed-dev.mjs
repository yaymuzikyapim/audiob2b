/**
 * Geliştirme veritabanına sentetik şirket / kullanıcı / dinleme verisi yazar.
 *
 * YALNIZCA yerel geliştirme kümesine (localhost:5433) yazar. Başka bir hedefte
 * durur: prod koruması + açık localhost kontrolü.
 *
 * Tekrar çalıştırılabilir: her çalıştırmada önce kendi sentetik kayıtlarını
 * (id'si "devseed_" ile başlayanları) siler. Katalog verisine (Book, Chapter,
 * Category, Series, Package, PackageBook) DOKUNMAZ.
 *
 *   npm run seed:devdb
 *   TZ=UTC ENV_FILE=.env.dev node scripts/seed-dev.mjs
 *
 * Şifre: .env.dev içindeki DEV_SEED_PASSWORD. Yoksa rastgele üretilip
 * .env.dev'e yazılır. Şifre hiçbir koşulda çıktıya yazdırılmaz.
 * E-posta alan adı yalnızca @example.test — gerçek adres üretilmez.
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import pg from "pg";
import bcrypt from "bcryptjs";
import { assertNotProd, refEtiketi } from "./lib/prod-guard.mjs";
import { pgSsl } from "./lib/pg-ssl.mjs";
import "./lib/pg-utc.mjs";

const ONEK = "devseed_";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envYolu = path.join(root, process.env.ENV_FILE ?? ".env");
const envMetin = fs.readFileSync(envYolu, "utf8");
const env = Object.fromEntries(
  envMetin.split("\n").filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")]; })
);

// ── Hedef kontrolü ──────────────────────────────────────────────────────────
const url = env.DATABASE_URL ?? "";
const yerel = /^postgres(ql)?:\/\/(\w+@)?(localhost|127\.0\.0\.1|\[::1\]):5433\//.test(url);
console.log(`\nHEDEF : ${yerel ? "localhost:5433 (yerel geliştirme)" : `UYGUN DEĞİL (${refEtiketi(url)})`}`);
console.log(`TZ    : ${process.env.TZ ?? "(tanımsız)"}`);
assertNotProd(url, "seed-dev");
if (!yerel) {
  console.error(`\n⛔ DURDURULDU — seed-dev yalnızca localhost:5433 üzerindeki geliştirme\n   kümesine yazar. ENV_FILE=.env.dev kullanın.\n`);
  process.exit(1);
}

// ── Şifre ───────────────────────────────────────────────────────────────────
let sifre = env.DEV_SEED_PASSWORD;
if (!sifre) {
  sifre = crypto.randomBytes(18).toString("base64url");
  const ek = `\n# Sentetik geliştirme kullanıcılarının şifresi (seed-dev.mjs üretti)\nDEV_SEED_PASSWORD=${sifre}\n`;
  fs.appendFileSync(envYolu, ek);
  fs.chmodSync(envYolu, 0o600);
  console.log(`ŞİFRE : DEV_SEED_PASSWORD üretildi ve ${path.basename(envYolu)} dosyasına yazıldı (değer yazdırılmadı)`);
} else {
  console.log(`ŞİFRE : ${path.basename(envYolu)} içindeki DEV_SEED_PASSWORD kullanılıyor`);
}
const hash = await bcrypt.hash(sifre, 10);

const pool = new pg.Pool({ connectionString: url, ssl: pgSsl(url) });
const c = await pool.connect();
const G = 24 * 3600 * 1000;
const simdi = Date.now();
const uuid = () => crypto.randomUUID();

try {
  await c.query("BEGIN");

  // ── Temizlik: yalnızca kendi kayıtları ────────────────────────────────────
  const sil = await c.query(`delete from "User" where id like $1 returning id`, [ONEK + "%"]);
  const sil2 = await c.query(`delete from "Company" where id like $1 returning id`, [ONEK + "%"]);
  console.log(`\nTemizlik: ${sil.rowCount} kullanıcı, ${sil2.rowCount} şirket silindi (önceki seed)`);

  // ── Paketler (kataloğdan, dokunulmaz) ────────────────────────────────────
  const { rows: paketler } = await c.query(
    `select p.id, p.name, count(pb."bookId")::int as kitap from "Package" p
     left join "PackageBook" pb on pb."packageId" = p.id group by 1,2 order by 3 desc`);
  if (paketler.length === 0) throw new Error("Katalog yüklenmemiş: Package tablosu boş. Önce katalog kopyalanmalı.");
  const tamPaket = paketler[0];
  const kucukPaket = paketler[paketler.length - 1];

  // ── Şirketler ────────────────────────────────────────────────────────────
  const sirketler = [
    { k: "qa",       ad: "QA Test A.Ş.",        slug: "devseed-qa-test",      paket: tamPaket.id,   koltuk: 20, aktif: true,  demo: false, bitis: simdi + 365 * G, not: "Sentetik QA şirketi — tam paket" },
    { k: "expired",  ad: "Süresi Dolmuş Ltd.",  slug: "devseed-suresi-dolmus", paket: tamPaket.id,   koltuk: 10, aktif: true,  demo: false, bitis: simdi - 30 * G,  not: "Sentetik — lisans süresi 30 gün önce bitti" },
    { k: "inactive", ad: "Pasif Kurum",          slug: "devseed-pasif-kurum",  paket: tamPaket.id,   koltuk: 10, aktif: false, demo: false, bitis: simdi + 365 * G, not: "Sentetik — isActive=false" },
    { k: "demo",     ad: "Demo Kurum",           slug: "devseed-demo-kurum",   paket: kucukPaket.id, koltuk: 10, aktif: true,  demo: true,  bitis: simdi + 180 * G, not: "Sentetik — isDemo=true" },
  ];
  for (const s of sirketler) {
    s.id = ONEK + "co_" + s.k;
    await c.query(
      `insert into "Company" (id, name, slug, "brandColor", "licenseType", "maxSeats", "packageId",
                              "startDate", "endDate", "isActive", "isDemo", notes, "createdAt", "updatedAt")
       values ($1,$2,$3,'#2563eb','PER_SEAT',$4,$5,$6,$7,$8,$9,$10,now(),now())`,
      [s.id, s.ad, s.slug, s.koltuk, s.paket, new Date(simdi - 200 * G), new Date(s.bitis), s.aktif, s.demo, s.not]);
  }
  console.log(`Şirket  : ${sirketler.length} (${sirketler.map((s) => s.ad).join(", ")})`);

  // ── Kullanıcılar ─────────────────────────────────────────────────────────
  const kullanicilar = [];
  async function kullanici(k, ad, rol, sirketId, aktif = true) {
    const id = ONEK + "u_" + k;
    const eposta = `${k.replace(/_/g, ".")}@example.test`;
    await c.query(
      `insert into "User" (id, email, name, password, role, "isActive", "companyId",
                           "lastLoginAt", "createdAt", "updatedAt")
       values ($1,$2,$3,$4,$5,$6,$7,$8,now(),now())`,
      [id, eposta, ad, hash, rol, aktif, sirketId, aktif ? new Date(simdi - 2 * G) : null]);
    const u = { id, k, rol, sirketId, aktif };
    kullanicilar.push(u);
    return u;
  }

  await kullanici("super", "Sentetik Süper Yönetici", "SUPER_ADMIN", null);
  const calisanlar = [];
  for (const s of sirketler) {
    await kullanici(`${s.k}_admin`, `${s.ad} Yöneticisi`, "COMPANY_ADMIN", s.id);
    // Yalnızca gerçekten aktif şirketlere çalışan: isActive ve süresi dolmamış
    const gercektenAktif = s.aktif && s.bitis > simdi;
    if (gercektenAktif) {
      const adet = s.k === "qa" ? 5 : 3;
      for (let i = 1; i <= adet; i++) {
        calisanlar.push(await kullanici(`${s.k}_calisan${i}`, `Sentetik Çalışan ${s.k.toUpperCase()}-${i}`, "EMPLOYEE", s.id));
      }
    }
  }
  await kullanici("qa_pasif_calisan", "Sentetik Pasif Çalışan", "EMPLOYEE", sirketler[0].id, false);
  await kullanici("sirketsiz", "Sentetik Şirketsiz Kullanıcı", "EMPLOYEE", null);
  console.log(`Kullanıcı: ${kullanicilar.length} (1 SUPER_ADMIN, ${sirketler.length} COMPANY_ADMIN, ${calisanlar.length} aktif çalışan, 1 pasif çalışan, 1 şirketsiz) — tümü @example.test`);

  // ── Dinlenebilir kitaplar ────────────────────────────────────────────────
  const { rows: kitaplar } = await c.query(`
    select b.id, b.duration,
           (select json_agg(json_build_object('id', ch.id, 'd', ch.duration) order by ch."order")
              from "Chapter" ch where ch."bookId" = b.id) as bolumler
    from "Book" b
    where b."isActive" and exists (select 1 from "Chapter" ch where ch."bookId" = b.id)
    order by b.id limit 40`);
  if (kitaplar.length === 0) throw new Error("Dinlenebilir kitap yok: katalog yüklenmemiş.");

  // ── Dinleme kayıtları: son 60 gün, v2, çeşitli hızlar ────────────────────
  const HIZLAR = [1, 1.25, 1.5, 2];
  let ph = 0;
  async function dinleme({ u, kitap, bolum, bitisMs, listenedSec, hiz, pct }) {
    const contentSec = Math.round(listenedSec * hiz);
    await c.query(
      `insert into "PlayHistory" (id, "clientId", "userId", "bookId", "chapterId",
                                  "listenedSec", "contentSec", "completedPct", "clientVersion", "playedAt")
       values ($1,$2,$3,$4,$5,$6,$7,$8,2,$9)`,
      [ONEK + "ph_" + (++ph), uuid(), u.id, kitap.id, bolum?.id ?? null,
       listenedSec, contentSec, pct, new Date(bitisMs)]);
    return contentSec;
  }

  let toplamListened = 0, toplamContent = 0;
  for (const u of calisanlar) {
    const oturumSayisi = 8 + Math.floor(Math.random() * 10);           // 8–17 oturum
    for (let o = 0; o < oturumSayisi; o++) {
      const gunOnce = Math.floor(Math.random() * 60);
      const kitap = kitaplar[Math.floor(Math.random() * kitaplar.length)];
      const bolumler = kitap.bolumler ?? [];
      const bolum = bolumler[Math.floor(Math.random() * bolumler.length)];
      const hiz = HIZLAR[Math.floor(Math.random() * HIZLAR.length)];
      // Oturum 1–6 dilime bölünür (istemci 2 dakikada bir gönderir)
      const dilim = 1 + Math.floor(Math.random() * 6);
      const baslangic = simdi - gunOnce * G - Math.floor(Math.random() * 12 * 3600 * 1000);
      for (let d = 0; d < dilim; d++) {
        const listenedSec = 30 + Math.floor(Math.random() * 91);        // 30–120 sn
        const bitisMs = baslangic + (d + 1) * listenedSec * 1000;
        toplamContent += await dinleme({ u, kitap, bolum, bitisMs, listenedSec, hiz,
          pct: Math.min(100, Math.round(((d + 1) * listenedSec * hiz / Math.max(bolum?.d ?? 600, 1)) * 100)) });
        toplamListened += listenedSec;
      }
    }
  }

  // ── Kenar durumlar ───────────────────────────────────────────────────────
  const kd = [];
  const u0 = calisanlar[0], u1 = calisanlar[1];
  const k0 = kitaplar[0], b0 = (k0.bolumler ?? [])[0];

  // 1) İstanbul gece yarısını aşan oturum (İstanbul 00:00 = UTC 21:00)
  const geceYarisi = new Date(Date.UTC(2026, 9, 10, 21, 0, 0)).getTime();  // 11 Eki İstanbul 00:00
  await dinleme({ u: u0, kitap: k0, bolum: b0, bitisMs: geceYarisi - 60_000, listenedSec: 110, hiz: 1, pct: 20 });
  await dinleme({ u: u0, kitap: k0, bolum: b0, bitisMs: geceYarisi + 60_000, listenedSec: 115, hiz: 1, pct: 40 });
  kd.push("gece yarısını aşan iki dilim (İstanbul gün sınırı)");

  // 2) 30 saniyenin altında kayıtlar
  for (const sn of [6, 11, 19, 27]) {
    await dinleme({ u: u1, kitap: k0, bolum: b0, bitisMs: simdi - 3 * G + sn * 1000, listenedSec: sn, hiz: 1, pct: 2 });
  }
  kd.push("30 sn altı 4 kayıt (6, 11, 19, 27 sn)");

  // 3) Aynı kullanıcının iki cihazda çakışan aralığı
  const cakisma = simdi - 5 * G;
  await dinleme({ u: u0, kitap: kitaplar[1], bolum: (kitaplar[1].bolumler ?? [])[0], bitisMs: cakisma,            listenedSec: 120, hiz: 1,   pct: 15 });
  await dinleme({ u: u0, kitap: kitaplar[2], bolum: (kitaplar[2].bolumler ?? [])[0], bitisMs: cakisma + 30_000,   listenedSec: 120, hiz: 1.5, pct: 15 });
  kd.push("aynı kullanıcı, iki farklı kitap, zamanda çakışan iki dilim (eşzamanlı cihaz)");

  // 4) Yüksek hızda uzun dilim
  await dinleme({ u: u1, kitap: kitaplar[3], bolum: (kitaplar[3].bolumler ?? [])[0], bitisMs: simdi - 1 * G, listenedSec: 115, hiz: 2, pct: 55 });
  kd.push("2.0x hızda dilim (contentSec = 2 × listenedSec)");

  // ── Favori / oynatıcı durumu / yer imi ───────────────────────────────────
  let fav = 0, oyn = 0, yer = 0;
  for (const [i, u] of calisanlar.entries()) {
    for (const kitap of kitaplar.slice(i % 5, (i % 5) + 3)) {
      await c.query(`insert into "UserFavorite" (id, "userId", "bookId", "createdAt")
                     values ($1,$2,$3,now()) on conflict ("userId","bookId") do nothing`,
                    [ONEK + "fav_" + (++fav), u.id, kitap.id]);
    }
    const kitap = kitaplar[(i * 3) % kitaplar.length];
    const bolum = (kitap.bolumler ?? [])[0];
    await c.query(`insert into "PlayerState" (id, "userId", "bookId", "chapterId", "positionSec", "clientSavedAt", "updatedAt")
                   values ($1,$2,$3,$4,$5,$6,now()) on conflict ("userId","bookId") do nothing`,
                  [ONEK + "ps_" + (++oyn), u.id, kitap.id, bolum?.id ?? null,
                   Math.floor(Math.random() * Math.max(bolum?.d ?? 600, 60)), new Date(simdi - 2 * G)]);
    if (i % 2 === 0) {
      await c.query(`insert into "Bookmark" (id, "userId", "bookId", "chapterId", "positionSec", note, "createdAt")
                     values ($1,$2,$3,$4,$5,$6,now())`,
                    [ONEK + "bm_" + (++yer), u.id, kitap.id, bolum?.id ?? null, 90, "Sentetik yer imi"]);
    }
  }

  await c.query("COMMIT");

  console.log(`Dinleme : ${ph} kayıt (hepsi clientVersion=2, contentSec>0, clientId dolu)`);
  console.log(`          toplam listenedSec ${toplamListened}, contentSec ${toplamContent}`);
  console.log(`Kenar durumlar:`);
  kd.forEach((x) => console.log(`          • ${x}`));
  console.log(`Favori ${fav} · oynatıcı durumu ${oyn} · yer imi ${yer}`);
  console.log(`\n✓ COMMIT — sentetik veri yazıldı. Katalog verisine dokunulmadı.\n`);
} catch (e) {
  await c.query("ROLLBACK").catch(() => {});
  console.error("\n⛔ ROLLBACK —", e.message, "\n");
  c.release(); await pool.end();
  process.exit(1);
}

c.release();
await pool.end();
