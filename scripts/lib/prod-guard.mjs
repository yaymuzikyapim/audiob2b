/**
 * Prod koruması — canlı veritabanına yazan scriptleri kazara çalıştırmayı engeller.
 *
 * Kullanım (yazan her script, DB/S3'e ilk dokunmadan önce):
 *
 *   import { assertNotProd } from "../scripts/lib/prod-guard.mjs";
 *   assertNotProd(env.DATABASE_URL, "fix-book-titles");
 *
 * Canlıya bilerek yazmak gerekiyorsa:
 *
 *   ALLOW_PROD=1 node prisma/fix-book-titles.mjs
 *
 * Neden host'a değil, bağlantı dizesinin tamamına bakıyoruz: Supabase pooler
 * bağlantısında proje ref'i HOST'ta geçmiyor, KULLANICI adında geçiyor
 * (postgres.<ref>@aws-1-eu-central-1.pooler.supabase.com). Yalnızca host'u
 * kontrol eden bir koruma bu kurulumda hiçbir şeyi engellemez.
 *
 * Bağlantı dizesi, kullanıcı adı ve şifre hiçbir koşulda yazdırılmaz; yalnızca
 * proje ref'inin son 5 karakteri gösterilir.
 */

/** Canlı proje ref'lerinin son 5 karakteri. Tam ref repoya yazılmaz. */
export const CANLI_REF_SONEKLERI = ["hoxkr"];

/** Supabase proje ref'ini bağlantı dizesinden çıkarır; bulamazsa null. */
export function refCikar(connectionString) {
  const s = String(connectionString ?? "");
  // pooler:  postgresql://postgres.<ref>:<sifre>@aws-1-....pooler.supabase.com
  // direkt:  postgresql://postgres:<sifre>@db.<ref>.supabase.co
  const m = s.match(/\/\/postgres\.([a-z0-9]{16,24})(?=[:@])/) ?? s.match(/@db\.([a-z0-9]{16,24})\.supabase\./);
  return m ? m[1] : null;
}

/** Bağlantı dizesi canlı projeyi gösteriyor mu? */
export function canliMi(connectionString) {
  const ref = refCikar(connectionString);
  return ref !== null && CANLI_REF_SONEKLERI.includes(ref.slice(-5));
}

/** Gösterim için güvenli etiket: "…hoxkr" ya da "ref çözülemedi". */
export function refEtiketi(connectionString) {
  const ref = refCikar(connectionString);
  return ref ? `…${ref.slice(-5)}` : "ref çözülemedi";
}

/**
 * Canlıysa ve ALLOW_PROD=1 yoksa süreci 1 ile durdurur.
 * Test edilebilmesi için çıkış ve yazdırma enjekte edilebilir.
 */
export function assertNotProd(connectionString, etiket = "script", opts = {}) {
  const env = opts.env ?? process.env;
  const log = opts.log ?? console.error;
  const exit = opts.exit ?? ((kod) => process.exit(kod));

  if (!canliMi(connectionString)) return "devam";

  const ref = refEtiketi(connectionString);

  if (env.ALLOW_PROD === "1") {
    (opts.warn ?? console.warn)(`⚠️  PROD: "${etiket}" canlı veritabanına (${ref}) ALLOW_PROD=1 ile bağlanıyor.`);
    return "izinli";
  }

  log(
    `\n⛔ DURDURULDU — "${etiket}" canlı veritabanına (${ref}) bağlanmak üzereydi.\n` +
    `   Bu script veritabanına veya S3'e YAZIYOR.\n\n` +
    `   Geliştirme DB'siyle çalışmak için .env.dev okuyan bir komut kullanın\n` +
    `   (ör. npm run tsx:devdb -- <script>). prisma/*.mjs scriptleri şu an\n` +
    `   doğrudan .env okuyor; dev DB desteği için ENV_FILE eklenmesi gerekiyor.\n\n` +
    `   Gerçekten canlıda çalıştırmak istiyorsanız ALLOW_PROD=1 gerekli:\n\n` +
    `     ALLOW_PROD=1 <komut>\n`
  );
  exit(1);
  return "durduruldu";
}
