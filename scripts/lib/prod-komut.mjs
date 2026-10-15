#!/usr/bin/env node
/**
 * Canlıya karşı çalışacak komutlar için tek giriş kapısı.
 *
 * Yerel `.env` artık geliştirme DB'sini (localhost:5433) gösterir; canlı değerler
 * `.env.prod` içindedir. Canlıya kasıtlı erişim yalnızca bu sarmalayıcıyla olur:
 *
 *   ALLOW_PROD=1 node scripts/lib/prod-komut.mjs prisma migrate status
 *
 * Yaptıkları (sırayla):
 *   1. Kabuk sızıntısı kontrolü — AWS_ACCESS_KEY_ID / DATABASE_URL / DIRECT_URL gibi
 *      değişkenler kabukta tanımlıysa durur. (dotenvx bunları EZMEZ; sızan değer
 *      `-f .env.prod` komutunu sessizce başka bir hedefe yönlendirebilir.)
 *   2. ALLOW_PROD=1 yoksa durur.
 *   3. Hedefi yazdırır — proje ref'inin yalnızca son 5 karakteri (CLAUDE.md kuralı 4).
 *   4. `dotenvx run -f .env.prod --quiet -- <komut>` olarak çalıştırır.
 *
 * Bağlantı dizesi, kullanıcı adı, şifre veya anahtar değeri asla yazdırılmaz.
 */
import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { refEtiketi, canliMi } from "./prod-guard.mjs";
import { sizanlar } from "./dev-env-guard.mjs";

const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ENV_PROD = path.join(KOK, ".env.prod");

const argv = process.argv.slice(2);
if (argv.length === 0) {
  console.error("Kullanım: ALLOW_PROD=1 node scripts/lib/prod-komut.mjs <komut> [argüman...]");
  process.exit(1);
}

// 1 — kabuk temiz mi
const sizan = sizanlar(process.env);
if (sizan.length > 0) {
  console.error(
    `\n⛔ DURDURULDU — kabukta ortam değişkeni sızıntısı var: ${sizan.join(", ")}\n` +
    `   dotenvx bu değerleri EZMEZ; komut .env.prod yerine sızan hedefe gidebilir.\n` +
    `   Yeni bir kabuk açıp tekrar deneyin (CLAUDE.md → Güvenlik Kuralları 1–2).\n`
  );
  process.exit(1);
}

// 2 — açık izin
if (process.env.ALLOW_PROD !== "1") {
  console.error(
    `\n⛔ DURDURULDU — bu komut CANLI ortama bağlanır.\n` +
    `   Bilinçli olarak istiyorsanız başına ALLOW_PROD=1 ekleyin:\n` +
    `     ALLOW_PROD=1 npm run ${process.env.npm_lifecycle_event ?? "<komut>"} -- ...\n`
  );
  process.exit(1);
}

// 3 — hedefi yazdır
if (!fs.existsSync(ENV_PROD)) {
  console.error(`\n⛔ DURDURULDU — .env.prod bulunamadı (${path.relative(KOK, ENV_PROD)}).\n`);
  process.exit(1);
}
const icerik = fs.readFileSync(ENV_PROD, "utf8");
const url =
  icerik.match(/^DIRECT_URL\s*=\s*"?([^"\n]+)"?/m)?.[1] ??
  icerik.match(/^DATABASE_URL\s*=\s*"?([^"\n]+)"?/m)?.[1] ??
  "";
if (!url) {
  console.error("\n⛔ DURDURULDU — .env.prod içinde DIRECT_URL/DATABASE_URL yok.\n");
  process.exit(1);
}
console.error(`→ HEDEF: ${canliMi(url) ? "CANLI" : "canlı değil"} (${refEtiketi(url)}) · env: .env.prod · TZ=UTC`);

// 4 — çalıştır
const cocuk = spawn(
  "npx",
  ["dotenvx", "run", "-f", ".env.prod", "--quiet", "--", ...argv],
  { cwd: KOK, stdio: "inherit", env: { ...process.env, TZ: "UTC", ENV_FILE: ".env.prod" } }
);
cocuk.on("exit", (kod, sinyal) => process.exit(sinyal ? 1 : (kod ?? 1)));
