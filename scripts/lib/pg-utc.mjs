/**
 * node-postgres için "timestamp without time zone" (OID 1114) ayrıştırıcısını
 * UTC'ye sabitler.
 *
 * Sorun: node-postgres bu tipi YEREL saat sanar. Veritabanındaki değerler UTC
 * olduğu için TZ=Europe/Istanbul altında okunan her timestamp 3 saat geriye
 * kayar. 15 Ekim 2026'da ölçüldü:
 *
 *   DB ham değer                 : 2026-01-01 00:00:00
 *   ham pg, TZ=Europe/Istanbul   : 2025-12-31T21:00:00.000Z   ✗
 *   ham pg, TZ=UTC               : 2026-01-01T00:00:00.000Z   ✓
 *   Prisma (@prisma/adapter-pg)  : 2026-01-01T00:00:00.000Z   ✓ (her iki TZ'de)
 *
 * Yani uygulama (Prisma) etkilenmiyor; etkilenen, ham pg kullanan scriptler.
 * Bu modülü import etmek yeterlidir: ayrıştırıcı süreç genelinde kurulur ve
 * TZ ne olursa olsun doğru sonuç verir.
 *
 *   import "../lib/pg-utc.mjs";
 */

import pg from "pg";

const TIMESTAMP = 1114;        // timestamp without time zone
const TIMESTAMP_ARRAY = 1115;  // _timestamp

function utcAyristir(deger) {
  if (deger === null) return null;
  if (deger === "infinity") return Infinity;
  if (deger === "-infinity") return -Infinity;
  // "2026-01-01 00:00:00.725" → "2026-01-01T00:00:00.725Z"
  return new Date(deger.replace(" ", "T") + "Z");
}

pg.types.setTypeParser(TIMESTAMP, utcAyristir);
pg.types.setTypeParser(TIMESTAMP_ARRAY, (deger) =>
  deger === null ? null : pg.types.arrayParser.create(deger, utcAyristir).parse()
);

export { utcAyristir };
