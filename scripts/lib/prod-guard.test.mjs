/**
 * Birim testleri: node scripts/lib/prod-guard.test.mjs
 *
 * Gerçek bağlantı dizesi kullanılmaz; ref'i "hoxkr" ile biten UYDURMA bir
 * proje ref'i ve uydurma şifre ile test edilir. Ağ ya da DB erişimi yok.
 */

import { assertNotProd, canliMi, refCikar, refEtiketi } from "./prod-guard.mjs";

let passed = 0, failed = 0;

function assert(label, condition, got) {
  if (condition) { console.log(`  ✓ ${label}`); passed++; }
  else { console.error(`  ✗ ${label}${got !== undefined ? ` (got: ${JSON.stringify(got)})` : ""}`); failed++; }
}

// Uydurma değerler — hiçbiri gerçek değil.
const FAKE_PROD_POOLER = "postgresql://postgres.aaaaaaaaaaaaaaahoxkr:sifre@aws-1-eu-central-1.pooler.supabase.com:5432/postgres";
const FAKE_PROD_DIRECT = "postgresql://postgres:sifre@db.aaaaaaaaaaaaaaahoxkr.supabase.co:5432/postgres";
const FAKE_DEV_POOLER  = "postgresql://postgres.bbbbbbbbbbbbbbbdev99:sifre@aws-1-eu-central-1.pooler.supabase.com:5432/postgres";
const FAKE_LOCAL       = "postgresql://postgres:sifre@127.0.0.1:5433/audiob2b_restore_test";

// ── refCikar ────────────────────────────────────────────────────────────────
console.log("\nrefCikar");
assert("pooler biçiminden ref çıkarır", refCikar(FAKE_PROD_POOLER) === "aaaaaaaaaaaaaaahoxkr", refCikar(FAKE_PROD_POOLER));
assert("direkt host biçiminden ref çıkarır", refCikar(FAKE_PROD_DIRECT) === "aaaaaaaaaaaaaaahoxkr", refCikar(FAKE_PROD_DIRECT));
assert("yerel bağlantıda ref yok", refCikar(FAKE_LOCAL) === null, refCikar(FAKE_LOCAL));
assert("undefined güvenli", refCikar(undefined) === null);

// ── canliMi ─────────────────────────────────────────────────────────────────
console.log("\ncanliMi");
assert("canlı pooler → true", canliMi(FAKE_PROD_POOLER) === true);
assert("canlı direkt host → true", canliMi(FAKE_PROD_DIRECT) === true);
assert("geliştirme projesi → false", canliMi(FAKE_DEV_POOLER) === false);
assert("yerel Postgres → false", canliMi(FAKE_LOCAL) === false);
assert("boş değer → false", canliMi("") === false);

// ── refEtiketi: tam ref asla sızmaz ─────────────────────────────────────────
console.log("\nrefEtiketi");
assert("yalnızca son 5 karakteri gösterir", refEtiketi(FAKE_PROD_POOLER) === "…hoxkr", refEtiketi(FAKE_PROD_POOLER));
assert("ref yoksa açıklama döner", refEtiketi(FAKE_LOCAL) === "ref çözülemedi");

// ── assertNotProd ───────────────────────────────────────────────────────────
console.log("\nassertNotProd");

function dene(url, env) {
  const cikti = [];
  let exitKodu = null;
  const sonuc = assertNotProd(url, "test", {
    env,
    log: (m) => cikti.push(m),
    warn: (m) => cikti.push(m),
    exit: (k) => { exitKodu = k; },
  });
  return { sonuc, exitKodu, metin: cikti.join("\n") };
}

const a = dene(FAKE_PROD_POOLER, {});
assert("canlı + ALLOW_PROD yok → durduruldu", a.sonuc === "durduruldu", a.sonuc);
assert("canlı + ALLOW_PROD yok → exit(1)", a.exitKodu === 1, a.exitKodu);
assert("mesajda '…hoxkr' geçer", a.metin.includes("…hoxkr"));
assert("mesajda 'ALLOW_PROD=1' geçer", a.metin.includes("ALLOW_PROD=1"));
assert("mesajda şifre geçmez", !a.metin.includes("sifre"));
assert("mesajda bağlantı dizesi geçmez", !a.metin.includes("pooler.supabase.com") && !a.metin.includes("postgresql://"));
assert("mesajda tam ref geçmez", !a.metin.includes("aaaaaaaaaaaaaaahoxkr"));

const b = dene(FAKE_PROD_POOLER, { ALLOW_PROD: "1" });
assert("canlı + ALLOW_PROD=1 → izinli", b.sonuc === "izinli", b.sonuc);
assert("canlı + ALLOW_PROD=1 → exit çağrılmaz", b.exitKodu === null, b.exitKodu);
assert("uyarı mesajı '…hoxkr' içerir", b.metin.includes("…hoxkr"));

const c = dene(FAKE_PROD_POOLER, { ALLOW_PROD: "true" });
assert("ALLOW_PROD=true (1 değil) → yine durdurur", c.sonuc === "durduruldu" && c.exitKodu === 1, c.sonuc);

const d = dene(FAKE_DEV_POOLER, {});
assert("geliştirme DB'si → devam, çıktı yok", d.sonuc === "devam" && d.exitKodu === null && d.metin === "", d.sonuc);

const e = dene(FAKE_LOCAL, {});
assert("yerel Postgres → devam", e.sonuc === "devam" && e.exitKodu === null, e.sonuc);

const f = dene(undefined, {});
assert("bağlantı dizesi yok → devam (başka hata mekanizması devralır)", f.sonuc === "devam", f.sonuc);

console.log(`\n${failed === 0 ? "✅" : "❌"} prod-guard: ${passed} geçti, ${failed} başarısız`);
process.exit(failed === 0 ? 0 : 1);
