/**
 * Birim testleri: TZ=UTC npx tsx src/lib/seats.test.ts
 *
 * Koltuk kararını (koltukVarMi) doğrular. Veritabanına bağlanmaz.
 * Yeniden aktifleştirme yolundaki kota kapısı aynı fonksiyonu kullanır.
 */

import { koltukVarMi, koltukYeterliMi } from "./seats";

let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean, got?: unknown) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}${got !== undefined ? ` (got: ${JSON.stringify(got)})` : ""}`);
    failed++;
  }
}

console.log("\nkoltukVarMi — kota kararı");

assert("boş şirket, 10 koltuk → var", koltukVarMi({ aktifKullanici: 0, bekleyenDavet: 0, maxSeats: 10 }) === true);
assert("9 aktif, 0 davet, 10 koltuk → var (son koltuk)", koltukVarMi({ aktifKullanici: 9, bekleyenDavet: 0, maxSeats: 10 }) === true);
assert("9 aktif + 1 bekleyen davet, 10 koltuk → yok", koltukVarMi({ aktifKullanici: 9, bekleyenDavet: 1, maxSeats: 10 }) === false);
assert("10 aktif, 0 davet, 10 koltuk → yok", koltukVarMi({ aktifKullanici: 10, bekleyenDavet: 0, maxSeats: 10 }) === false);
assert("5 aktif + 5 davet, 10 koltuk → yok", koltukVarMi({ aktifKullanici: 5, bekleyenDavet: 5, maxSeats: 10 }) === false);
assert("4 aktif + 5 davet, 10 koltuk → var", koltukVarMi({ aktifKullanici: 4, bekleyenDavet: 5, maxSeats: 10 }) === true);
assert("maxSeats 0 → yok", koltukVarMi({ aktifKullanici: 0, bekleyenDavet: 0, maxSeats: 0 }) === false);

console.log("\nkoltukYeterliMi — toplu aktifleştirme kotası");

assert("5 aktif, 0 davet, 5 eklenecek, 10 koltuk → yeterli", koltukYeterliMi({ aktifKullanici: 5, bekleyenDavet: 0, maxSeats: 10, eklenecek: 5 }) === true);
assert("5 aktif, 0 davet, 6 eklenecek, 10 koltuk → yetersiz", koltukYeterliMi({ aktifKullanici: 5, bekleyenDavet: 0, maxSeats: 10, eklenecek: 6 }) === false);
assert("8 aktif + 1 davet, 1 eklenecek, 10 koltuk → yeterli", koltukYeterliMi({ aktifKullanici: 8, bekleyenDavet: 1, maxSeats: 10, eklenecek: 1 }) === true);
assert("8 aktif + 1 davet, 2 eklenecek, 10 koltuk → yetersiz", koltukYeterliMi({ aktifKullanici: 8, bekleyenDavet: 1, maxSeats: 10, eklenecek: 2 }) === false);
assert("10 aktif, 0 eklenecek → yeterli (kimse aktifleşmiyor)", koltukYeterliMi({ aktifKullanici: 10, bekleyenDavet: 0, maxSeats: 10, eklenecek: 0 }) === true);
assert("eklenecek=1 ile koltukVarMi ile aynı sonuç (dolu)", koltukYeterliMi({ aktifKullanici: 9, bekleyenDavet: 1, maxSeats: 10, eklenecek: 1 }) === koltukVarMi({ aktifKullanici: 9, bekleyenDavet: 1, maxSeats: 10 }));

console.log(`\n${passed} geçti, ${failed} başarısız`);
if (failed > 0) process.exit(1);
