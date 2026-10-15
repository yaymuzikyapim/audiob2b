/** Birim testleri: node scripts/lib/dev-env-guard.test.mjs */
import { kontrolEt, sizanlar, YASAK } from "./dev-env-guard.mjs";

let passed = 0, failed = 0;
const assert = (l, c, g) => c
  ? (console.log(`  ✓ ${l}`), passed++)
  : (console.error(`  ✗ ${l}${g !== undefined ? ` (got: ${JSON.stringify(g)})` : ""}`), failed++);

function dene(env) {
  const cikti = []; let kod = null;
  const sonuc = kontrolEt({ env, log: (m) => cikti.push(m), exit: (k) => { kod = k; } });
  return { sonuc, kod, metin: cikti.join("\n") };
}

console.log("\nsizanlar");
assert("boş ortam → sızan yok", sizanlar({}).length === 0);
assert("AWS_ACCESS_KEY_ID yakalanır", sizanlar({ AWS_ACCESS_KEY_ID: "AKIA..." }).includes("AWS_ACCESS_KEY_ID"));
assert("boş string sızma saymaz", sizanlar({ DATABASE_URL: "" }).length === 0);
assert("dört değişken izleniyor", YASAK.length === 4 && YASAK.includes("DIRECT_URL"));

console.log("\nkontrolEt");
const a = dene({});
assert("temiz kabuk → temiz, çıkış yok", a.sonuc === "temiz" && a.kod === null && a.metin === "", a.sonuc);

const b = dene({ AWS_ACCESS_KEY_ID: "AKIASAHTE000000TEST" });
assert("AWS anahtarı varsa durur", b.sonuc === "durduruldu" && b.kod === 1, b.sonuc);
assert("mesajda değişken adı geçer", b.metin.includes("AWS_ACCESS_KEY_ID"));
assert("mesajda unset önerisi var", b.metin.includes("unset"));
assert("mesajda DEĞER geçmez", !b.metin.includes("AKIASAHTE000000TEST"));

const c = dene({ DATABASE_URL: "postgresql://x@y/z" });
assert("DATABASE_URL varsa durur", c.sonuc === "durduruldu" && c.kod === 1, c.sonuc);
assert("mesajda bağlantı dizesi geçmez", !c.metin.includes("postgresql://"));

const d = dene({ DIRECT_URL: "postgresql://x@y/z", AWS_SECRET_ACCESS_KEY: "s" });
assert("birden fazla sızma hepsini listeler",
  d.metin.includes("DIRECT_URL") && d.metin.includes("AWS_SECRET_ACCESS_KEY"), d.metin);

const e = dene({ NEXT_PUBLIC_BASE_URL: "http://localhost:3000", S3_DELETE_DISABLED: "true" });
assert("alakasız değişkenler engellemez", e.sonuc === "temiz", e.sonuc);

console.log(`\n${failed === 0 ? "✅" : "❌"} dev-env-guard: ${passed} geçti, ${failed} başarısız`);
process.exit(failed === 0 ? 0 : 1);
