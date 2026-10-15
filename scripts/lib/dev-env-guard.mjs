/**
 * Geliştirme ön kontrolü — kabuktan sızan canlı değerleri yakalar.
 *
 * dotenvx (ve dotenv) zaten tanımlı process.env değişkenlerini EZMEZ. Bu yüzden
 * kabukta `set -a; . ./.env` gibi bir komutla canlı değerler export edilmişse,
 * `dotenvx run -f .env.dev` onları .env.dev ile değiştirmez ve geliştirme
 * komutları sessizce CANLI kimlik bilgileriyle çalışır. 14 Ekim 2026'da tam bu
 * oldu: .env.dev ile çalıştığı sanılan bir S3 yetki testi canlı anahtarla
 * PutObject yaptı.
 *
 * Bu script, dev komutlarının EN BAŞINDA (dotenvx'ten önce) çalışır ve bu
 * değişkenlerden biri kabukta tanımlıysa süreci 1 ile durdurur.
 *
 * Değerler hiçbir koşulda yazdırılmaz; yalnızca değişken adı.
 */

export const YASAK = [
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "DATABASE_URL",
  "DIRECT_URL",
];

/** Kabuktan gelen yasak değişkenlerin adlarını döndürür. */
export function sizanlar(env = process.env) {
  return YASAK.filter((k) => typeof env[k] === "string" && env[k] !== "");
}

export function kontrolEt(opts = {}) {
  const env = opts.env ?? process.env;
  const log = opts.log ?? console.error;
  const exit = opts.exit ?? ((k) => process.exit(k));

  const bulunan = sizanlar(env);
  if (bulunan.length === 0) return "temiz";

  log(
    `\n⛔ DURDURULDU — kabukta canlı olabilecek ortam değişkenleri tanımlı:\n` +
    bulunan.map((k) => `     ${k}`).join("\n") + `\n\n` +
    `   dotenvx bu değişkenleri .env.dev ile EZMEZ; komut sessizce bu\n` +
    `   değerlerle çalışırdı. Geliştirme komutları temiz bir kabuk ister.\n\n` +
    `   Çözüm — yeni bir terminal sekmesi açın ya da temizleyin:\n\n` +
    `     unset ${YASAK.join(" ")}\n\n` +
    `   Canlı .env'i kabuğa yüklemeyin (CLAUDE.md → Güvenlik Kuralları).\n`
  );
  exit(1);
  return "durduruldu";
}

// Doğrudan çalıştırıldığında kontrolü uygula.
if (import.meta.url === `file://${process.argv[1]}`) kontrolEt();
