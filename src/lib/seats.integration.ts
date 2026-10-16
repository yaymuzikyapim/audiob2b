/**
 * Koltuk kotası entegrasyon testi — YALNIZCA geliştirme DB'si (localhost:5433).
 * Çalıştırma: npm run tsx:devdb -- src/lib/seats.integration.ts
 *
 * Test verisi kendi şirketlerini oluşturur (önek "QA-SEAT-") ve sonunda siler.
 * Canlı veritabanına bağlanılırsa hiçbir şey yazmadan durur.
 */

import { prisma } from "./prisma";
import { kullaniciAktiflestirKoltukKontrollu, topluAktiflestirKoltukKontrollu, koltukKapisiIleOlustur } from "./seats";

// Canlı koruması: yalnızca localhost:5433 kabul edilir (prod-guard'ın canliMi kontrolünden daha dar),
// ayrıca canlı proje ref'inin son 5 karakteri (hoxkr) reddedilir. Komut: npm run tsx:devdb (dev-env-guard çalışır).
const url = process.env.DATABASE_URL ?? "";
if (!/localhost:5433\//.test(url) || /hoxkr/.test(url)) {
  console.error("⛔ Bu test yalnızca localhost:5433 geliştirme DB'sinde çalışır. Canlı/bilinmeyen hedefte durdu.");
  process.exit(1);
}

const ONEK = `QA-SEAT-${Date.now()}`;
let passed = 0;
let failed = 0;
function assert(label: string, ok: boolean, got?: unknown) {
  if (ok) { console.log(`  ✓ ${label}`); passed++; }
  else { console.error(`  ✗ ${label}${got !== undefined ? ` (got: ${JSON.stringify(got)})` : ""}`); failed++; }
}

const sirketIdler: string[] = [];
let sayac = 0;

// Şirket + verilen sayıda aktif ve pasif kullanıcı oluşturur.
async function sirketKur(maxSeats: number, aktif: number, pasif: number) {
  const s = await prisma.company.create({
    data: { name: `${ONEK} ${++sayac}`, slug: `${ONEK.toLowerCase()}-${sayac}`, startDate: new Date(), endDate: new Date(Date.now() + 864e5 * 365), maxSeats },
  });
  sirketIdler.push(s.id);
  const kullanicilar: { id: string }[] = [];
  for (let i = 0; i < aktif + pasif; i++) {
    const u = await prisma.user.create({
      data: { email: `${ONEK.toLowerCase()}-${sayac}-${i}@qa.invalid`, name: `QA ${i}`, companyId: s.id, isActive: i < aktif, role: "EMPLOYEE" },
      select: { id: true },
    });
    kullanicilar.push(u);
  }
  return { id: s.id, aktifIdler: kullanicilar.slice(0, aktif).map((u) => u.id), pasifIdler: kullanicilar.slice(aktif).map((u) => u.id) };
}

async function aktifSayi(companyId: string) {
  return prisma.user.count({ where: { companyId, isActive: true } });
}

function kod(e: unknown) {
  return (e as { code?: string } | null)?.code;
}

async function reddedilmeli(fn: () => Promise<unknown>) {
  try { await fn(); return false; } catch (e) { return kod(e) === "SEATS_FULL"; }
}

async function main() {
  console.log("\n— Kota dolu şirket (maxSeats 2, aktif 2): her yol reddetmeli");
  const dolu = await sirketKur(2, 2, 2);
  const pasifA = dolu.pasifIdler[0];
  const pasifB = dolu.pasifIdler[1];

  assert("P1 PATCH/member: tekil aktifleştirme reddedildi",
    await reddedilmeli(() => kullaniciAktiflestirKoltukKontrollu(dolu.id, pasifA, { isActive: true })));
  assert("P3 toplu aktifleştirme reddedildi", await reddedilmeli(() => topluAktiflestirKoltukKontrollu(dolu.id, [pasifA, pasifB])));
  assert("P4 süper admin kullanıcı oluşturma reddedildi", await reddedilmeli(() =>
    koltukKapisiIleOlustur(dolu.id, (tx) => tx.user.create({ data: { email: `${ONEK.toLowerCase()}-dolu-x@qa.invalid`, name: "x", companyId: dolu.id, isActive: true, role: "EMPLOYEE" } }))));
  assert("P5 süper admin davet oluşturma reddedildi", await reddedilmeli(() =>
    koltukKapisiIleOlustur(dolu.id, (tx) => tx.inviteToken.create({ data: { email: "x@qa.invalid", companyId: dolu.id, role: "EMPLOYEE", token: `${ONEK}-${Math.random()}`, expiresAt: new Date(Date.now() + 864e5) } }))));
  assert("dolu şirkette aktif sayı değişmedi (2)", (await aktifSayi(dolu.id)) === 2, await aktifSayi(dolu.id));
  assert("reddedilen aktifleştirmelerde pasif kullanıcılar pasif kaldı",
    (await prisma.user.count({ where: { id: { in: [pasifA, pasifB] }, isActive: false } })) === 2);

  console.log("\n— Boş şirket (maxSeats 5, aktif 0): her yol geçmeli");
  const bos = await sirketKur(5, 0, 3);
  await kullaniciAktiflestirKoltukKontrollu(bos.id, bos.pasifIdler[0], { isActive: true });
  assert("P1 tekil aktifleştirme geçti", (await aktifSayi(bos.id)) === 1);
  await topluAktiflestirKoltukKontrollu(bos.id, [bos.pasifIdler[1], bos.pasifIdler[2]]);
  assert("P3 toplu aktifleştirme geçti (3 aktif)", (await aktifSayi(bos.id)) === 3);
  await koltukKapisiIleOlustur(bos.id, (tx) => tx.user.create({ data: { email: `${ONEK.toLowerCase()}-bos-x@qa.invalid`, name: "x", companyId: bos.id, isActive: true, role: "EMPLOYEE" } }));
  assert("P4 süper admin kullanıcı oluşturma geçti (4 aktif)", (await aktifSayi(bos.id)) === 4);

  console.log("\n— Eşzamanlılık: 1 koltuk kaldı, 2 eşzamanlı aktifleştirme");
  const yarim = await sirketKur(2, 1, 2);
  const sonuc = await Promise.allSettled([
    kullaniciAktiflestirKoltukKontrollu(yarim.id, yarim.pasifIdler[0], { isActive: true }),
    kullaniciAktiflestirKoltukKontrollu(yarim.id, yarim.pasifIdler[1], { isActive: true }),
  ]);
  const basarili = sonuc.filter((r) => r.status === "fulfilled").length;
  assert("tam olarak 1 istek geçti (FOR UPDATE)", basarili === 1, basarili);
  assert("şirket aktif sayısı 2 (kota aşılmadı)", (await aktifSayi(yarim.id)) === 2, await aktifSayi(yarim.id));

  console.log("\n— Taşmış şirket (maxSeats 2, aktif 4): mevcut kullanıcılar etkilenmez, pasifleştirme çalışır, yeni aktifleştirme reddedilir");
  const tasmis = await sirketKur(2, 4, 1);
  const aktifOnce = await prisma.user.count({ where: { companyId: tasmis.id, isActive: true } });
  assert("taşmış şirkette 4 aktif (maxSeats 2)", aktifOnce === 4, aktifOnce);
  assert("taşmış şirkette yeni aktifleştirme reddedildi", await reddedilmeli(() =>
    kullaniciAktiflestirKoltukKontrollu(tasmis.id, tasmis.pasifIdler[0], { isActive: true })));
  // Pasifleştirme: member/admin yolu doğrudan isActive=false yazar; kota kontrolü yoktur.
  await prisma.user.update({ where: { id: tasmis.aktifIdler[0] }, data: { isActive: false } });
  assert("taşmış şirkette pasifleştirme çalıştı (3 aktif)", (await aktifSayi(tasmis.id)) === 3);
  const kalanAktif = await prisma.user.findMany({ where: { id: { in: tasmis.aktifIdler.slice(1) } }, select: { isActive: true } });
  assert("mevcut aktif kullanıcılar aktif kaldı", kalanAktif.every((u) => u.isActive));
  console.log("  · Not: giriş (login) yolu koltuk saymıyor; bu test login route'unu çağırmaz (kod incelemesiyle doğrulandı).");

  console.log(`\n${passed} geçti, ${failed} başarısız`);
}

main()
  .catch((e) => {
    console.error("⛔ Test beklenmeyen hatayla durdu:", e);
    failed++;
  })
  .finally(async () => {
    // Temizlik: test kullanıcılarını sil, sonra şirketleri (davetler cascade ile gider).
    for (const id of sirketIdler) {
      await prisma.user.deleteMany({ where: { companyId: id } });
      await prisma.inviteToken.deleteMany({ where: { companyId: id } });
      await prisma.company.deleteMany({ where: { id } });
    }
    await prisma.$disconnect();
    if (failed > 0) process.exit(1);
  });
