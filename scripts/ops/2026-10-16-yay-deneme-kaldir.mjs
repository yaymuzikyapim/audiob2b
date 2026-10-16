/**
 * "YAY Deneme" şirketini KALICI siler (16 Ekim 2026, kullanıcı onaylı).
 *
 * Kapsam: yalnızca tek şirket satırı. İlişkili InviteToken kayıtları FK CASCADE ile
 * birlikte silinir. Kullanıcı (User) kayıtı varsa script durur (bağlı User = 0 beklenir).
 *
 * Kullanım:
 *   ENV_FILE=.env.prod node scripts/ops/2026-10-16-yay-deneme-kaldir.mjs            # kuru çalıştırma (salt okuma)
 *   ALLOW_PROD=1 ENV_FILE=.env.prod node scripts/ops/2026-10-16-yay-deneme-kaldir.mjs --apply
 *
 * Güvenlik:
 *   - Kuru çalıştırma BEGIN READ ONLY içinde çalışır, hiçbir şey yazmaz.
 *   - --apply yalnızca ALLOW_PROD=1 ile çalışır (prod-guard), tek transaction'dır.
 *   - Hedef şirket id, ad ve slug sabit olarak doğrulanır; uyuşmazsa durur.
 *   - Yedek dosyasının sha256'sı uygulamadan önce doğrulanır.
 *   - Beklenen dışı herhangi bir sayı → ROLLBACK.
 *   - Kişisel veri yazdırılmaz: e-posta, token ve şifre yok. Silinen şirket satırı
 *     (şirketin kendi alanları) ve davet kayıtlarının id/durum/expiresAt bilgisi basılır.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import pg from "pg";
import { assertNotProd, canliMi, refEtiketi } from "../lib/prod-guard.mjs";
import { pgSsl } from "../lib/pg-ssl.mjs";
import "../lib/pg-utc.mjs";

const UYGULA = process.argv.includes("--apply");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const env = Object.fromEntries(
  fs.readFileSync(path.join(root, process.env.ENV_FILE ?? ".env.prod"), "utf8").split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")]; })
);

const URL_ = env.DIRECT_URL;

const HEDEF = {
  id: "cmufs3ng5000004l542dgl3ks",
  name: "YAY Deneme",
  slug: "yay-deneme",
  beklenenInvite: 2,
};
const YEDEK = "/Users/aliye/Backups/audiob2b/audiob2b-prod-public-20261016-0958.dump";
const YEDEK_SHA256 = "57a5386b3ddef9e4f8a8ec35cf3570ba7379d874eecd488d14d871bc1e8fbf83";

console.log(`\nHEDEF : ${canliMi(URL_) ? `CANLI (${refEtiketi(URL_)})` : `⛔ canlı değil (${refEtiketi(URL_)})`}`);
console.log(`MOD   : ${UYGULA ? "UYGULA (--apply)" : "KURU ÇALIŞTIRMA (salt okuma, BEGIN READ ONLY)"}\n`);

if (!canliMi(URL_)) {
  console.error("⛔ Bu script yalnızca canlı hedefte çalışır (ENV_FILE=.env.prod). Durdu.");
  process.exit(1);
}

if (UYGULA) {
  if (process.env.ALLOW_PROD !== "1") {
    console.error("⛔ --apply yalnızca ALLOW_PROD=1 ile çalışır.");
    process.exit(1);
  }
  assertNotProd(URL_, "2026-10-16-yay-deneme-kaldir");

  if (!fs.existsSync(YEDEK)) {
    console.error("⛔ Yedek dosyası bulunamadı. Durdu.");
    process.exit(1);
  }
  const sha = crypto.createHash("sha256").update(fs.readFileSync(YEDEK)).digest("hex");
  if (sha !== YEDEK_SHA256) {
    console.error(`⛔ Yedek sha256 uyuşmuyor (beklenen ${YEDEK_SHA256}, bulunan ${sha}). Durdu.`);
    process.exit(1);
  }
  console.log(`✓ yedek sha256 doğrulandı: ${sha}\n`);
}

const pool = new pg.Pool({ connectionString: URL_, ssl: pgSsl(URL_) });
const c = await pool.connect();

function fail(mesaj) {
  console.error(`\n⛔ ${mesaj}`);
  throw new Error(mesaj);
}

try {
  await c.query(UYGULA ? "BEGIN" : "BEGIN READ ONLY");

  // 1) Şirket: id, ad, slug birebir eşleşmeli
  const sirket = await c.query(
    `SELECT * FROM "Company" WHERE id = $1`,
    [HEDEF.id]
  );
  if (sirket.rowCount !== 1) fail(`Şirket bulunamadı veya birden fazla (adet ${sirket.rowCount}).`);
  const s = sirket.rows[0];
  if (s.name !== HEDEF.name || s.slug !== HEDEF.slug) {
    fail(`Şirket ad/slug uyuşmuyor (ad "${s.name}", slug "${s.slug}").`);
  }

  const paket = s.packageId
    ? (await c.query(`SELECT name FROM "Package" WHERE id = $1`, [s.packageId])).rows[0]?.name
    : null;
  console.log(`ŞİRKET: son4=${HEDEF.id.slice(-4)} · ad=${s.name} · slug=${s.slug} · isActive=${s.isActive} · isDemo=${s.isDemo} · paket=${paket ?? "-"} · maxSeats=${s.maxSeats} · createdAt=${s.createdAt.toISOString()}`);

  // 2) Bağlı kullanıcı 0 olmalı
  const userSayi = (await c.query(`SELECT count(*)::int AS n FROM "User" WHERE "companyId" = $1`, [HEDEF.id])).rows[0].n;
  console.log(`BAĞLI User: ${userSayi}`);
  if (userSayi !== 0) fail(`Bağlı kullanıcı var (${userSayi}); silme durduruldu.`);

  // 3) Davet kayıtları: yalnızca id + durum + expiresAt (e-posta/token yazılmaz)
  const davetler = await c.query(
    `SELECT id,
            CASE WHEN "usedAt" IS NOT NULL THEN 'kullanildi'
                 WHEN "expiresAt" < now() THEN 'suresi_dolmus'
                 ELSE 'gecerli' END AS durum,
            "expiresAt"
       FROM "InviteToken" WHERE "companyId" = $1 ORDER BY "createdAt"`,
    [HEDEF.id]
  );
  console.log(`DAVET (InviteToken): ${davetler.rowCount} adet (beklenen ${HEDEF.beklenenInvite})`);
  for (const d of davetler.rows) {
    console.log(`  - id=${d.id} · durum=${d.durum} · expiresAt=${d.expiresAt.toISOString()}`);
  }
  if (davetler.rowCount !== HEDEF.beklenenInvite) fail(`Davet sayısı beklenenden farklı (${davetler.rowCount}).`);

  // 4) Demo paketi kitap sayısı referans (silme sonrası değişmemeli)
  const demoOnce = (await c.query(
    `SELECT count(*)::int AS n FROM "PackageBook" pb JOIN "Package" p ON p.id = pb."packageId" WHERE p.name = 'Demo'`
  )).rows[0].n;
  const toplamOnce = (await c.query(`SELECT count(*)::int AS n FROM "Company"`)).rows[0].n;
  console.log(`ÖNCE: şirket=${toplamOnce} · Demo paket kitap=${demoOnce}`);

  if (!UYGULA) {
    await c.query("ROLLBACK");
    console.log("\n✓ Kuru çalıştırma tamam. Hiçbir şey yazılmadı (ROLLBACK).");
  } else {
    // 5) Silme — tek transaction
    const silinen = await c.query(`DELETE FROM "Company" WHERE id = $1 RETURNING *`, [HEDEF.id]);
    if (silinen.rowCount !== 1) fail(`Şirket silme etkisi 1 değil (${silinen.rowCount}).`);

    const invKalan = (await c.query(`SELECT count(*)::int AS n FROM "InviteToken" WHERE "companyId" = $1`, [HEDEF.id])).rows[0].n;
    if (invKalan !== 0) fail(`Cascade sonrası ${invKalan} davet kaydı kaldı.`);

    const toplamSonra = (await c.query(`SELECT count(*)::int AS n FROM "Company"`)).rows[0].n;
    if (toplamSonra !== toplamOnce - 1) fail(`Şirket sayısı beklenmeyen (${toplamOnce} → ${toplamSonra}).`);

    const demoSonra = (await c.query(
      `SELECT count(*)::int AS n FROM "PackageBook" pb JOIN "Package" p ON p.id = pb."packageId" WHERE p.name = 'Demo'`
    )).rows[0].n;
    if (demoSonra !== demoOnce) fail(`Demo paket kitap sayısı değişti (${demoOnce} → ${demoSonra}).`);

    await c.query("COMMIT");

    console.log("\n✓ COMMIT tamam.");
    console.log(`SONRA: şirket=${toplamSonra} · Demo paket kitap=${demoSonra} · davet(bu companyId)=${invKalan}`);
    console.log("\nSİLİNEN ŞİRKET SATIRI (JSON):");
    console.log(JSON.stringify(silinen.rows[0], null, 2));
  }
} catch (e) {
  try { await c.query("ROLLBACK"); } catch {}
  console.error("\n↩ ROLLBACK yapıldı; hiçbir değişiklik kalmadı.");
  process.exitCode = 1;
} finally {
  c.release();
  await pool.end();
}
