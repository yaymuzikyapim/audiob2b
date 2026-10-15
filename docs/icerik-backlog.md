# İçerik backlog'u

**Oluşturma:** 15 Ekim 2026 (Adım 0-F, madde 2) · **Durum:** yalnızca not, işlem yapılmadı

Bu dosya kataloğun ses/paket tarafındaki açık uçlarını tek yerde tutar. Hiçbir madde
için işlem (aktifleştirme, pakete ekleme, yükleme) yapılmamıştır — karar kullanıcıya aittir.

Sayımlar **15 Ekim 2026 katalog kopyasından** alınmıştır (canlıyla birebir aynı: Book 1055,
Chapter 8867, PackageBook 1046). Sorgular geliştirme DB'sinde (`localhost:5433`) çalıştırıldı.

---

## (a) Sesi bulunamayan kitaplar — pasife alındı

**21 aktif kitap**, Drive'da ses dosyası bulunamadığı için 15 Ekim 2026'da `isActive=false`
yapıldı (Adım 0-D). ISBN listesi, işlem kaydı, zaman damgası ve geri alma komutu:
[`docs/runbooks/canli-islem-kaydi.md`](runbooks/canli-islem-kaydi.md). Ses dosyaları
yüklendiğinde geri alınacak.

### Drive tarafında çözülmesi gerekenler

| Konu | ISBN | Not |
|---|---|---|
| MP3 **alt klasörü** görünüyor, dosyalar işlenmemiş | `9786055212308` | Drive'da klasör var, yükleme yapılmamış |
| MP3 **alt klasörü** görünüyor, dosyalar işlenmemiş | `9786256316737` | Listen Up! 20. Bölüm — kitapta `duration=720` yazılı ama **0 bölüm** var |
| Drive yolu **yanlış** | `9786256316775` | Listen Up! 24. Bölüm: Young People and Gaming — yol düzeltilmeden yükleme denenmemeli |

> `9786055212308` 21'lik listede **yok** (zaten pasifti); diğer ikisi listede.

---

## (b) Aktif + sesli, ama hiçbir pakette değil — 15 kitap (9 kaldı)

Bu kitaplar yayında ve bölümleri var, fakat `PackageBook` kaydı olmadığı için **hiçbir
şirket kütüphanesinde görünmüyor**.

### Çözüldü (2026-10-15) — Demo paketine eklendi

6 kutsal kitap `Demo` paketine eklendi (işlem kaydı:
[`docs/runbooks/canli-islem-kaydi.md`](runbooks/canli-islem-kaydi.md)):

| ISBN | Başlık | Bölüm |
|---|---|---|
| 9786258477764 | Kur'an-ı Kerim | 114 |
| 9786258477931 | Zebur (Mezmurlar) | 150 |
| 9786258477887 | Kutsal Kitap (Tevrat, Zebur ve İncil) | 80 |
| 9786258477955 | Tevrat (Eski Antlaşma / Tanah) | 51 |
| 9786258477924 | Süleyman Peygamber'in Özdeyişler Kitabı | 31 |
| 9786258477856 | İncil | 30 |

### Karar bekleyen 9 kitap

| ISBN | Başlık | Bölüm |
|---|---|---|
| 9786255578228 | Felatun Bey ile Rakım Efendi | 11 |
| 9786055212698 | The Gift of the Magi | 2 |
| 9786055212704 | The Happy Prince | 2 |
| 9786258320060 | Mad Mehmed | 1 |
| 9786055212674 | Snow White | 1 |
| 9786055212681 | The Christmas Tree and the Wedding | 1 |
| 9786258320138 | The Golden-Haired Children | 1 |
| 9786258320145 | The Horse-Devil And The Witch | 1 |
| 9786258477993 | The Rose Beauty | 1 |

Bu 9 kitap (İngilizce kısa öyküler + Felatun Bey) muhtemelen gözden kaçmış —
hangi pakete ekleneceğine karar verilmeli.

---

## (c) Sesi olduğu halde pasif — 6 kitap

Bölümleri yüklü ama `isActive=false`. Neden pasif oldukları kayıtlı değil (telif, kalite,
revizyon?); açılacaklarsa tek tek gerekçe doğrulanmalı.

| ISBN | Başlık | Bölüm |
|---|---|---|
| 9786257439213 | Seksen Günde Dünya Turu | 38 |
| 9786255578792 | Gulyabani | 8 |
| 9786255578815 | Acımak | 7 |
| 9786257112284 | T.U.H.A.F. Marka Yönetimi | 6 |
| 9786258477115 | Meşakk-ı Hayat | 3 |
| 9786057063403 | Şeker Anlatıyor | 1 |

---

## (d) Bölümsüz ama süresi dolu — 8 kitap

`Chapter` kaydı yok, fakat `Book.duration` sıfırdan büyük. Süre bir yerden (eski içe
aktarma ya da elle giriş) gelmiş; ses yok. **Hepsi şu an pasif** — yani kullanıcıya
"süresi var ama hiç bölümü yok" diye görünen bir kitap kalmadı.

| ISBN | Başlık | `duration` (sn) | Aktif |
|---|---|---|---|
| 9786257888066 | Genç Werther'in Acıları | 16.740 | hayır |
| 9786057144638 | Çizgibilm | 16.560 | hayır |
| 9786059795807 | Kara Oklar Çetesi 1 - Büyük Macera | 15.000 | hayır |
| 9786256316737 | Listen Up! 20. Bölüm | 720 | hayır |
| 9786256316744 | Listen Up! 21. Bölüm: Table Manners | 540 | hayır |
| 9786256316768 | Listen Up! 23. Bölüm: Who is Shopaholic? | 540 | hayır |
| 9786055212452 | Bremen Mızıkacıları | 420 | hayır |
| 9786256316751 | Listen Up! 22. Bölüm: The Burger | 360 | hayır |

Bölümsüz kitapların dağılımı: **31 kitap bölümsüz**, 8'inde süre dolu, 23'ünde süre 0;
**31'inin tamamı pasif**. Ses yüklendiğinde `duration` bölümlerden yeniden hesaplanmalı —
mevcut değerler doğrulanmamıştır.

---

## Sorgular

```sql
-- (b) aktif + bölümlü ama pakette değil
select b.isbn, b.title, count(c.id) bolum
from "Book" b join "Chapter" c on c."bookId" = b.id
where b."isActive" and not exists (select 1 from "PackageBook" pb where pb."bookId" = b.id)
group by 1,2 order by 3 desc;

-- (c) bölümlü ama pasif
select b.isbn, b.title, count(c.id) bolum
from "Book" b join "Chapter" c on c."bookId" = b.id
where not b."isActive" group by 1,2 order by 3 desc;

-- (d) bölümsüz ama süresi dolu
select b.isbn, b.title, b.duration, b."isActive"
from "Book" b
where not exists (select 1 from "Chapter" c where c."bookId" = b.id)
  and coalesce(b.duration, 0) > 0
order by 3 desc;
```
