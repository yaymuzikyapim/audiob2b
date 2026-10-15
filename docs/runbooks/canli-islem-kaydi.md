# Canlı veritabanı işlem kaydı

Canlı veritabanında yapılan her yazma işlemi buraya kaydedilir: tarih, gerekçe,
kapsam, yedek dosyası + sha256, önce/sonra sayımlar ve **çalıştırılabilir geri alma
komutu**. Kayıt, işlemin kendisiyle aynı commit'te girer.

Kurallar: CLAUDE.md → **Güvenlik Kuralları**. Her işlem öncesi taze `pg_dump`
(`docs/runbooks/yedek-ve-geri-yukleme.md`), tek transaction, beklenen satır sayısı
tutmazsa `ROLLBACK`.

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
