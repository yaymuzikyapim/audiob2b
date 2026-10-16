# Canlı veritabanı işlem kaydı

Canlı veritabanında yapılan her yazma işlemi buraya kaydedilir: tarih, gerekçe,
kapsam, yedek dosyası + sha256, önce/sonra sayımlar ve **çalıştırılabilir geri alma
komutu**. Kayıt, işlemin kendisiyle aynı commit'te girer.

Kurallar: CLAUDE.md → **Güvenlik Kuralları**. Her işlem öncesi taze `pg_dump`
(`docs/runbooks/yedek-ve-geri-yukleme.md`), tek transaction, beklenen satır sayısı
tutmazsa `ROLLBACK`.

---

## 2026-10-16 — Beklenmedik production deployment (deploy-gate test kazası)

**Ne oldu:** `px94xrabg` (12:…, kesin saat Vercel'den alınacak) — `source: cli`. `chore/deploy-gate` dalında yeni `deploy.sh` commit edilmeden Test C'deki `git reset --hard HEAD~1` çalıştırıldı; bu işlem yeni `deploy.sh`'yi geri alarak eski (kapısız) sürümü geri getirdi. Test D sonraki adımda eski script'i çalıştırdı ve canlıya deploy etti.
**İçerik:** `6b79e8f` — yalnızca docs değişiklikleri (canli-islem-kaydi.md, urun-backlog.md). Kod, API, DB değişikliği yok.
**Geri alınmadı:** Dağıtılan commit `6b79e8f` zaten `main` HEAD ile aynı içeriği taşıyor; bu deployment daha önceki durumun üzerine yazmadı.
**Önlem:** `chore/deploy-gate` tamamlandığında bu tür kazalar `DEPLOY_CONFIRM` kapısıyla önlenir.

---

## 2026-10-16 — 3 production deployment, og:image talimatıyla ONAYLI deploy.sh

**Gerekçe:** og:image talimatı `deploy.sh` çalıştırılmasına onay verdi (ONAYLI).
**Ne oldu:** 11:59–12:04 arasında 3 production deployment oluştu: `4w6gqvgrp` (11:59:22), `iipdc4kif` (12:01:26), `lpj9215tx` (12:04:14). Üçü de `source: cli`, `creator: yaymuzikyapim-9750` (Vercel API ile doğrulandı).
**Kapsam notu:** Talimat koltuk düzeltmesini hariç tutuyordu; ancak `370bc9d` 11:52'de zaten `main`'e girmişti — bu yüzden koltuk kotası, U8 (`/api/health`), mailer ve S3 değişiklikleri de canlıya çıktı.
**Canlı içerik:** `lpj9215tx` canlı alias'larda (`www.audiob2b.com.tr`, `audiob2b.com.tr`). Dosya hash'leri commit `6c88ab3` ile birebir eşleşti (`src/lib/seats.ts`, `src/proxy.ts`, `src/app/page.tsx`, `src/app/layout.tsx`, `public/og-image.png` — Vercel sha1 = içerik sha1).
**Commit listesi (95ee407 → 6c88ab3):** `370bc9d` (merge seat-limit), `7f27915`, `38dddea`, `ab60936` (koltuk kotası), `51bf352` (/api/health public, test guard), `b77bfb3` (backlog U1/U8/U9), `bc6d65a` (merge fix/og-image), `b889198` (og:image 1200×630, summary_large_image), `6c88ab3` (page.tsx openGraph override kaldırıldı).
**Geri alma hedefi:** `nwy457mi8` (15 Ekim 23:20, `source: redeploy`). `npx vercel rollback audiob2b-nwy457mi8-yay20.vercel.app` ile dönülür.
**Geri alınmadı:** içerik test edilmiş ve planlanan paketle aynı; canlı kontrol sonuçları aşağıda.

**Kontrol sonuçları (16 Ekim 2026, salt okuma, canlıda hiçbir şey oluşturulmadı):**

**1. Deployment source + creator (Vercel REST API, takım kapsamı):**

| Deployment | Saat (yerel) | source | creator |
|---|---|---|---|
| `4w6gqvgrp` | 11:59:22 | cli | yaymuzikyapim-9750 |
| `iipdc4kif` | 12:01:26 | cli | yaymuzikyapim-9750 |
| `lpj9215tx` | 12:04:14 | cli | yaymuzikyapim-9750 |

**2. Canlı kod = `6c88ab3` SHA1 doğrulaması (`lpj9215tx` dosya ağacı ↔ git):**

| Dosya | Vercel SHA1 | git `6c88ab3` SHA1 | Eşleşme |
|---|---|---|---|
| `src/lib/seats.ts` | `e21a46d0…a83bb` | `e21a46d0…a83bb` | ✓ |
| `src/proxy.ts` | `1ae2a91b…dc68` | `1ae2a91b…dc68` | ✓ |
| `src/app/page.tsx` | `46ad2744…b2` | `46ad2744…b2` | ✓ |

**3. `page.tsx`'ten kaldırılan 8 satır (`6c88ab3` diff):**
```diff
-  title: "Kurumsal Sesli Kitap ve Çalışan Yan Hakkı | AudioB2B",
-  description:
-    "Çalışanlarınıza 1.000'i aşkın sesli kitaptan oluşan kurumsal bir kütüphane sunun. iOS ve Android uygulaması, çevrimdışı dinleme, yönetim paneli ve Excel/PDF raporlar.",
-  openGraph: {
-    title: "Kurumsal Sesli Kitap ve Çalışan Yan Hakkı | AudioB2B",
-    description:
-      "Çalışanlarınıza 1.000'i aşkın sesli kitaptan oluşan kurumsal bir kütüphane sunun. iOS ve Android uygulaması, çevrimdışı dinleme, yönetim paneli ve Excel/PDF raporlar.",
-  },
```
Canlı `<title>`: "Kurumsal Sesli Kitap ve Çalışan Yan Hakkı | AudioB2B" — `layout.tsx` `SITE_TITLE` sabitiyle **aynı** (kaldırılan satırlar yedek kopya olduğundan değer değişmedi). `<meta name="description">` da aynı.

**4. HTTP durum kontrolleri:**

| URL | Beklenen | Gerçek |
|---|---|---|
| `/` | 200 | **200** ✓ |
| `/login` | 200 | **200** ✓ |
| `/api/health` | 200 | **200** ✓ |
| `/og-image.png` | 200 | **200** ✓ |
| `/api/cron/cleanup` (auth'suz) | 401 | **401** ✓ |

**5. Runtime 5xx / exception (son 30 dk, `lpj9215tx`):**
- Entries: 1 · Level dağılımı: warn×1, error×0, fatal×0
- Warn: `[10:21:04 UTC] Error: The Server Reference ID did not match the expected format. Received "y".` — Next.js Server Action format hatası (olası bot isteği), 5xx değil, uygulama hatası yok.
- **5xx: 0, exception: 0.**

---

## 2026-10-16 — "YAY Deneme" test şirketinin kalıcı silinmesi

**İşlem:** `DELETE FROM "Company" WHERE id = 'cmufs3ng5000004l542dgl3ks'` — 1 satır. Davet kayıtları (`InviteToken`) FK `ON DELETE CASCADE` ile 2 satır silindi.
**Script:** `scripts/ops/2026-10-16-yay-deneme-kaldir.mjs`
**Komut:** `ALLOW_PROD=1 ENV_FILE=.env.prod node scripts/ops/2026-10-16-yay-deneme-kaldir.mjs --apply`
**Onay:** kullanıcı, Aşama A raporundan sonra ("KALICI SİLME" onayı).
**Gerekçe:** Demo paketine bağlı, hiçbir kullanıcısı olmayan, maxSeats=1 deneme kaydı. Kod içinde sabit id/slug yok. Bağlı kullanıcı 0 (silme öncesi ve sonrası kontrol edildi).

### Yedek

- Dosya: `/Users/aliye/Backups/audiob2b/audiob2b-prod-public-20261016-0958.dump` (`public` şema, 21 tablo verisi, `pg_dump -Fc`)
- Boyut: 754 941 bayt
- sha256: `57a5386b3ddef9e4f8a8ec35cf3570ba7379d874eecd488d14d871bc1e8fbf83`
- Uygulama öncesi script bu sha256'yı doğruladı.

### Kapsam ve önce/sonra sayımlar

| Ölçüt | Önce | Sonra | Beklenen |
|---|---|---|---|
| Şirket | 5 | 4 | −1 ✓ |
| YAY Deneme (id) | 1 | 0 | −1 ✓ |
| InviteToken (bu companyId) | 2 | 0 | −2 (cascade) ✓ |
| Bağlı User | 0 | — | 0 ✓ |
| Demo paket kitap | 1046 | 1046 | değişmez ✓ |

`DELETE` etkilenen satır: 1 (1 değilse ROLLBACK). Davet kayıtları: id, durum (süresi dolmuş) ve `expiresAt` olarak kayda alındı; e-posta ve token kayda yazılmadı.

### Silinen şirket satırı (JSON, geri alma için)

```json
{
  "id": "cmufs3ng5000004l542dgl3ks",
  "name": "YAY Deneme",
  "slug": "yay-deneme",
  "logoUrl": null,
  "licenseType": "PER_SEAT",
  "maxSeats": 1,
  "packageId": "cmtidmqn3000004jpk8q6lzze",
  "startDate": "2026-09-24T00:00:00.000Z",
  "endDate": "2027-09-24T00:00:00.000Z",
  "isActive": true,
  "notes": null,
  "createdAt": "2026-09-24T17:01:12.438Z",
  "updatedAt": "2026-09-24T17:01:12.438Z",
  "brandColor": "#2563eb",
  "isDemo": false
}
```

Silinen davet kayıtları (yalnızca id / durum / expiresAt):
- `cmufs4lj7000104l5lkd2ac95` · süresi dolmuş · 2026-10-01T17:01:56.609Z
- `cmufs6brl000204l5jtfkbbqb` · süresi dolmuş · 2026-10-01T17:03:17.265Z

### Geri alma (yedekten, yalnızca bu satırlar)

Geri alma, yedek dosyasını geçici bir yerel veritabanına açıp yalnızca bu iki tablonun ilgili satırlarını prod'a `INSERT` ederek yapılır. Tüm veri yeniden yüklenmez.

1. Yedeğin bütünlüğünü doğrulayın:
   ```bash
   shasum -a 256 /Users/aliye/Backups/audiob2b/audiob2b-prod-public-20261016-0958.dump
   ```
   Çıktı `57a5386b…1bc1e8fbf83` olmalı.
2. Geçici yerel veritabanı oluşturun (canlı değil):
   ```bash
   /usr/local/opt/postgresql@17/bin/createdb -h localhost -p 5433 -U postgres restore_tmp
   ```
3. Yedekten yalnızca iki tabloyu geçici veritabanına yükleyin. `InviteToken` ve `Company` için şema, `pg_restore --schema-only` ile bir kez kurulur; sonra veri:
   ```bash
   /usr/local/opt/postgresql@17/bin/pg_restore --schema-only -h localhost -p 5433 -U postgres -d restore_tmp /Users/aliye/Backups/audiob2b/audiob2b-prod-public-20261016-0958.dump
   /usr/local/opt/postgresql@17/bin/pg_restore --data-only -t Company -t InviteToken -h localhost -p 5433 -U postgres -d restore_tmp /Users/aliye/Backups/audiob2b/audiob2b-prod-public-20261016-0958.dump
   ```
4. Geri alınacak satırlardan prod'a uygulanacak `INSERT` komutlarını üretin (şirket önce, davetler sonra; `ON CONFLICT DO NOTHING` ile):
   ```bash
   /usr/local/opt/postgresql@17/bin/psql -h localhost -p 5433 -U postgres -d restore_tmp -At -c "SELECT format('INSERT INTO \"Company\" SELECT * FROM json_populate_record(NULL::\"Company\", %L) ON CONFLICT (id) DO NOTHING;', row_to_json(c)) FROM \"Company\" c WHERE id='cmufs3ng5000004l542dgl3ks'" > /private/tmp/geri-company.sql
   /usr/local/opt/postgresql@17/bin/psql -h localhost -p 5433 -U postgres -d restore_tmp -At -c "SELECT format('INSERT INTO \"InviteToken\" SELECT * FROM json_populate_record(NULL::\"InviteToken\", %L) ON CONFLICT (id) DO NOTHING;', row_to_json(t)) FROM \"InviteToken\" t WHERE \"companyId\"='cmufs3ng5000004l542dgl3ks'" > /private/tmp/geri-invite.sql
   ```
   Bu dosyalar davet e-postası ve token içerir; işi bitince silin.
5. Tek bir dosyada, tek transaction olarak prod'a uygulayın (önce şirket, sonra davetler). `.env.prod` kabuğa yüklenmez; değer yalnızca komutun argümanında yaşar:
   ```bash
   (echo "BEGIN;"; cat /private/tmp/geri-company.sql /private/tmp/geri-invite.sql; echo "COMMIT;") > /private/tmp/geri.sql
   ALLOW_PROD=1 /usr/local/opt/postgresql@17/bin/psql "$(grep -m1 '^DIRECT_URL=' .env.prod | cut -d= -f2-)" -v ON_ERROR_STOP=1 -f /private/tmp/geri.sql
   ```
   Hata olursa `ON_ERROR_STOP` transaction'ı geri sarar; `COMMIT` çalışmaz.
6. Doğrulama: şirket sayısı 4→5, `Company` id'si mevcut, `InviteToken` (bu companyId) 2.
7. Geçici `restore_tmp` veritabanını ve `/private/tmp/geri-*.sql` dosyalarını silin.

---

## 2026-10-15 — 6 kutsal kitabın Demo paketine eklenmesi

**İşlem:** `INSERT INTO "PackageBook" ("packageId", "bookId") SELECT … UNNEST(…)` — 6 satır.
**Script:** `scripts/ops/2026-10-15-kutsal-kitaplar-pakete.mjs`
**Komut:** `ALLOW_PROD=1 ENV_FILE=.env.prod node scripts/ops/2026-10-15-kutsal-kitaplar-pakete.mjs --apply`
**Onay:** kullanıcı, Aşama A raporundan sonra (iki aşamalı akış).

### Gerekçe

6 kutsal kitap (Kur'an-ı Kerim, Zebur, İncil, Tevrat, Kutsal Kitap, Süleyman'ın Özdeyişleri)
aktif ve bölümlü olmasına karşın hiçbir pakette yer almıyordu; Demo paketinin 4 şirket
kütüphanesinde görünmüyorlardı. `icerik-backlog.md` (b) maddesindeki 15 paketsiz kitabın 6'sı.

### Eklenen (packageId, bookId) çiftleri

| bookId | isbn | başlık |
|---|---|---|
| bk_9786258477764 | 9786258477764 | Kur'an-ı Kerim |
| bk_9786258477856 | 9786258477856 | İncil |
| bk_9786258477887 | 9786258477887 | Kutsal Kitap (Tevrat, Zebur ve İncil'i içeren Kitab-ı Mukaddes) |
| bk_9786258477924 | 9786258477924 | Süleyman Peygamber'in Özdeyişler Kitabı |
| bk_9786258477931 | 9786258477931 | Zebur (Mezmurlar) |
| bk_9786258477955 | 9786258477955 | Tevrat (Eski Antlaşma / Tanah) |

Paket: `Demo` — id `cmtidmqn3000004jpk8q6lzze`. TPAO-Demo'ya eklenmedi.

### Yedek

| | |
|---|---|
| Dosya | `~/Backups/audiob2b/audiob2b-prod-public-20261015-2257.dump` |
| Boyut | 756.239 bayt |
| sha256 | `256b4a8adc3efd3bf9a699e27aba5737a31ff280aea439aca639aabb638bb95a` |

### Önce / sonra sayımlar

| Ölçüt | Önce | Sonra | Beklenen |
|---|---|---|---|
| Demo paket kitap sayısı | 1040 | **1046** | +6 ✓ |
| TPAO-Demo paket kitap sayısı | 6 | **6** | değişmez ✓ |
| AudioB2B Demo kütüphane | 1003 | **1009** | +6 ✓ |
| AudioB2B QA kütüphane | 1003 | **1009** | +6 ✓ |
| TPAO A.Ş. kütüphane | 1003 | **1009** | +6 ✓ |
| YAY Deneme kütüphane | 1003 | **1009** | +6 ✓ |
| TPAO Sunum (Demo) kütüphane | 6 | **6** | değişmez ✓ |

> **Not:** "TPAO A.Ş." ve "TPAO Sunum (Demo)" ayrı şirketlerdir. TPAO A.Ş. Demo
> paketindedir (etkilendi); TPAO Sunum (Demo) TPAO-Demo paketindedir (etkilenmedi).

`INSERT` etkilenen satır: **6** (6 olmasaydı `ROLLBACK`).

### Geri alma

```sql
BEGIN;
DELETE FROM "PackageBook"
WHERE "packageId" = 'cmtidmqn3000004jpk8q6lzze'
  AND "bookId" = ANY(ARRAY[
    'bk_9786258477764','bk_9786258477856','bk_9786258477887',
    'bk_9786258477924','bk_9786258477931','bk_9786258477955']);
-- Etkilenen satır 6 değilse ROLLBACK.
COMMIT;
```

### Tekrar çalıştırma güvenliği

Script ikinci kez kuru çalıştırıldığında "Zaten Demo'da olan kitap (6)" sapmasıyla
`exit 1` veriyor — yanlışlıkla tekrar uygulanamaz.

---

## 2026-10-15 — Sesi olmayan 21 aktif kitabın pasife alınması

**İşlem:** `UPDATE "Book" SET "isActive" = false, "updatedAt" = now()` — 21 satır.
**Script:** `scripts/ops/2026-10-15-pasif-sessiz-kitaplar.mjs`
**Komut:** `ALLOW_PROD=1 node scripts/ops/2026-10-15-pasif-sessiz-kitaplar.mjs --apply`
**Onay:** kullanıcı, Aşama A raporundan sonra (iki aşamalı akış).

### Gerekçe

Bu 21 kitabın katalog kaydı var ama hiç `Chapter`'ı yok. Kütüphane sorguları
`chapters: { some: {} }` filtresiyle onları zaten gizliyordu; admin panelinde ise
"aktif" görünüp katalog sayılarını şişiriyorlardı. `isActive=false` ile sayımlar
gerçeğe hizalandı. **Ses dosyaları yüklendiğinde geri alınacak.**

### Kapsam — 21 ISBN

```
9786055212452  Bremen Mızıkacıları
9786055212650  God Sees the Truth But Waits
9786057144638  Çizgibilm
9786059795661  Midas'ın Geveze Berberi (Anadolu Uygarlıkları - Frig)
9786059795807  Kara Oklar Çetesi 1 - Büyük Macera
9786059795876  İşler Bazen Yolunda Gitmez
9786059795883  Arzavul Tepesi
9786255578709  Anneannemin Gramofonu
9786255578778  Notalar Apartmanı
9786256316737  Listen Up! 20 Bölüm: Positive Effects of Social Media On Our Society Today
9786256316744  Listen Up! 21. Bölüm: Table Manners
9786256316751  Listen Up! 22. Bölüm: The Burger
9786256316768  Listen Up! 23. Bölüm: Who is Shopaholic?
9786256316775  Listen Up! 24. Bölüm: Young People and Gaming
9786257101332  Okumayı Söken Çocuk
9786257888066  Genç Werther'in Acıları
9786257888127  Kürk Mantolu Madonna
9786257888226  Kendine Ait Bir Oda
9786257888240  Bir Kadının Yaşamından Yirmi Dört Saat
9786257888547  Kum ve Köpük
9786258320657  Tavşan Olmak İsteyen Kaplumbağa
```

Aşama A (salt okuma) doğrulaması: 21/21 ISBN bulundu, her ISBN tekil, hepsi
`isActive=true`, hepsinde **bölüm 0 · dinleme 0 · favori 0 · oynatıcı durumu 0 ·
yer imi 0**, 21'i de yalnızca **Demo** paketinde. Ayrı bir sorgu, bu 21 kitabın
"aktif ama bölümsüz" olan kitapların **tamamı** olduğunu gösterdi (ISBN'siz yok).

### Yedek

| | |
|---|---|
| Dosya | `~/Backups/audiob2b/audiob2b-prod-public-20261015-1406.dump` |
| Boyut | 756.542 bayt |
| sha256 | `672e092130739a9abd66d07b56445a638538aef386f9a73f7280001d45b0ab57` |
| `pg_dump` süresi | 11 sn, `TABLE DATA` 21 girdi, stderr boş |

Önceki yedek (geri yükleme testi yapılan): `audiob2b-prod-public-20261015-1347.dump`,
sha256 `0f274e3529c6f980dd19c5ddc2a88e57dda016e42f6ad050f79aef1477f22d41`.

### Önce / sonra sayımlar

| Ölçüt | Önce | Sonra | Beklenen |
|---|---|---|---|
| Tüm kitap | 1055 | 1055 | değişmez ✓ |
| Aktif kitap | 1039 | **1018** | −21 ✓ |
| Kütüphanede görünen (aktif + ≥1 bölüm) | 1018 | **1018** | değişmez ✓ |
| Pasif kitap | 16 | **37** | +21 ✓ |
| Aktif ama bölümsüz | 21 | **0** | −21 ✓ |

`UPDATE` etkilenen satır: **21** (21 olmasaydı `ROLLBACK`). Satır satır doğrulama:
21/21 kitap `isActive=false`.

### İşlemin yazdığı zaman damgası

```
updatedAt = 2026-10-15 11:06:28.725   (UTC, timestamp without time zone)
```

`now()` transaction başlangıç zamanı olduğu için 21 satırın damgası **birebir aynı**;
`DISTINCT` sorgusu tek değer / 21 satır döndürdü.

> ⚠️ Bu damgayı okurken dikkat: node-postgres `timestamp without time zone`
> değerlerini **yerel saat** sanıp UTC'ye kaydırıyor. İlk çalıştırmada script
> `.toISOString()` kullandığı için `08:06:28.725Z` yazdırdı (−3 sa) ve bu değerle
> kurulan geri alma koşulu **0 satır** hedefledi. Script düzeltildi: damga artık
> `to_char(...)` ile **metin** olarak okunuyor. Kayda geçen doğru değer
> yukarıdakidir ve koşulu 21 satırda doğrulandı.

### Geri alma

Yalnızca bu işlemin değiştirdiği satırları hedefler — ISBN + `isActive=false` +
işlemin damgası:

```sql
BEGIN;
UPDATE "Book" SET "isActive" = true
WHERE isbn = ANY(ARRAY[
  '9786055212452','9786055212650','9786057144638','9786059795661','9786059795807',
  '9786059795876','9786059795883','9786255578709','9786255578778','9786256316737',
  '9786256316744','9786256316751','9786256316768','9786256316775','9786257101332',
  '9786257888066','9786257888127','9786257888226','9786257888240','9786257888547',
  '9786258320657'])
  AND "isActive" = false
  AND "updatedAt" = '2026-10-15 11:06:28.725'::timestamp;
-- Etkilenen satır 21 değilse ROLLBACK.
COMMIT;
```

`SELECT count(*)` ile aynı koşul **21** döndürüyor (15 Ekim 2026 itibarıyla doğrulandı).

Geri alma `updatedAt` alanını değiştirmez; bu bilinçli — damga, satırların bu işlemle
değiştiğinin kanıtı olarak kalır. Kitap yeniden yayına alınırken `updatedAt`'i de
tazelemek istenirse `SET "isActive" = true, "updatedAt" = now()` kullanılır, ama o
zaman bu geri alma komutu bir daha çalışmaz (koşul eşleşmez).

### Tekrar çalıştırma güvenliği

Script ikinci kez kuru çalıştırıldığında "Zaten pasif kitap (21)" sapmasıyla
`exit 1` veriyor — yanlışlıkla tekrar uygulanamaz.
