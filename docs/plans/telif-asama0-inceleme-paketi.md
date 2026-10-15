# AudioB2B — Dinleme Verisi ve Telif Altyapısı: Aşama 0 İnceleme Paketi

**Tarih:** 14 Ekim 2026
**Durum:** Uygulama planı taslak. Canlı şemaya henüz dokunulmadı.
**Kaynaklar:** Claude Code'un üç salt okuma raporu (Aşama 0 incelemesi, takip soruları + uygulama planı, son doğrulama sorgusu) ve ikinci kontrolcünün (Claude) değerlendirmesi.

---

## İnceleyenler için yönerge

Bu dosyayı bağımsız bir teknik inceleme için hazırladık. Lütfen:

1. **Katılmadığınız her noktayı gerekçesiyle yazın.** "Katılıyorum" demek gerekmiyor; yalnızca itiraz, eksik ve düzeltme.
2. Özellikle şu risklere odaklanın: **migration güvenliği, geri alma yolu, veri kaybı, canlı sistemi bozma ihtimali, mobil OTA kısıtları.**
3. Bölüm 5'teki önerilerin bir kısmı Claude Code'un, bir kısmı ikinci kontrolcünün. Hangisinin kime ait olduğu belirtildi. İkisini de aynı titizlikle eleştirin.
4. Bölüm 7'deki sorulara mümkünse doğrudan yanıt verin.
5. Rakamları bu dosyadaki ham çıktılarla karşılaştırın. Bir rakam kendi içinde tutarsızsa bildirin.

Bu dosya hukuki veya mali görüş değildir.

---

## 1. Bağlam

AudioB2B, kurumsal (B2B) sesli kitap platformu: Next.js 16 web uygulaması (Vercel, fra1), Expo / React Native mobil uygulama, Prisma 7 + Supabase Postgres (Frankfurt, eu-central-1), ses dosyaları AWS S3 (eu-central-1).

Bugün katalogdaki 1.055 kitabın tamamı SesleKitap'a ait. Plan, başka yayıncıları da eklemek ve **şirket bazlı havuz modeliyle** telif dağıtmak:

- Her şirketin dönem gelirinden bir havuz ayrılır (net gelir × r).
- Havuz, o şirkette dinlenen **içerik dakikasına** göre yayıncılara dağıtılır.
- İçerik dakikası = oynatma hızından bağımsız, fiilen oynatılan içerik aralığı. Tekilleştirme, oturum birleştirme, 30 sn eşik, tutarlılık kontrolü, kişi-kitap-gün ve kişi-gün tavanı sırayla uygulanır.
- Her dinleme, **dinleme anındaki şirkete** yazılır. Kapanan dönem değişmez; geç gelen kayıt ulaştığı döneme girer.
- Çevrimdışı dosyaların erişimi bir bitiş tarihi taşır: min(şirket dönemi sonu, geçiş süresi sonu, kitabın hak bitişi).

Aşama 0'ın amacı: mevcut dinleme verisinin ve kodun bu modele ne kadar hazır olduğunu salt okuma ile ölçmek.

**Ticari durum:** Henüz ödeme yapan müşteri yok. TPAO değerlendirme aşamasında.

---

## 2. Aşama 0 bulguları (Claude Code raporu)

Tüm sorgular `BEGIN READ ONLY; SET LOCAL statement_timeout='30s'; … ROLLBACK;` içinde, yalnızca SELECT ile çalıştırıldı. Dosya, şema veya veri değişmedi.

### 2.1 Şema

**PlayHistory** (`prisma/schema.prisma:179-196`):

```
id            String   @id @default(cuid())
clientId      String?  @unique // istemci UUID; çift kayıt önleme
userId        String
bookId        String
chapterId     String?  // NULL = eski/bölümsüz kayıt
listenedSec   Int      @default(0) // gerçekten dinlenen süre (delta, saniye)
contentSec    Int      @default(0) // tüketilen içerik süresi (listenedSec × hız)
completedPct  Float    @default(0) // tamamlanma yüzdesi (0-100)
clientVersion Int      @default(1) // 1=eski (pozisyon), 2=yeni (delta)
playedAt      DateTime @default(now())
@@index([userId, playedAt])  @@index([bookId])
```

- **Book** (`:107-134`): id, title, author, narrator?, duration Int, coverUrl?, description?, isbn?, isActive, publishedAt?, createdAt, updatedAt, categoryId?, seriesId?, seriesOrder?
- **Company** (`:47-67`): id, name, slug, logoUrl?, brandColor?, licenseType (PER_SEAT | FLEX_POOL), maxSeats, packageId?, startDate, endDate, isActive, isDemo, notes?, createdAt, updatedAt
- **User** (`:12-37`): id, email, name?, password?, role (SUPER_ADMIN | COMPANY_ADMIN | EMPLOYEE), isActive, lastLoginAt?, createdAt, updatedAt, companyId?, pushToken?, passwordChangedAt?
- **Chapter** (`:136-150`): id, bookId, title, order, duration Int, s3Key; `@@unique([bookId, order])`

Canlı DB kolonları şemayla birebir aynı.

| Konu | Bulgu |
|---|---|
| Yayıncı / hak sahibi alanı | **Yok.** Book'ta yalnızca author, narrator |
| Süre alanı | `Book.duration` (saniye). Süresi 0/boş: 23 kitap (1.055'in %2,2'si) |
| Önizleme / örnek bölüm ayrımı | **Yok** |
| Ses dosyası sürümü | **Tutulmuyor.** Yeniden yüklemede Chapter satırları silinip yeni id'lerle oluşuyor. `PlayHistory.chapterId` FK değil; bugün yetim chapterId: 0 |
| FK davranışı | `PlayHistory_bookId_fkey` ve `PlayHistory_userId_fkey` **ON DELETE CASCADE**: kitap veya kullanıcı silinince dinleme geçmişi geri dönüşsüz silinir |
| Süre tutarlılığı | `Book.duration = sum(Chapter.duration)` 1.024/1.024 kitapta birebir. 5 bölümlük ffprobe örneklemi: sapma %0,01–%0,08. Bölümü olmadığı halde süresi > 0 olan kitap: 8. Katalog: 8.867 bölüm, 2.412,5 saat |
| Company'de gelir / fiyat | **Yok.** Yalnızca startDate / endDate |
| Şirket türü | Tek alan `isDemo` (boolean). QA / review / trial / ücretli ayrımı yok |

### 2.2 Dinleme kaydının oluşumu

- **Tek endpoint:** `src/app/api/dashboard/play-history/route.ts` (POST).
- **Web:** `AudioPlayer.tsx:92` (logPlayHistory). **Mobil:** `lib/service.ts:78` → `lib/api.ts:420-425`.

**Bir kayıt neyi temsil ediyor:** bir "dilim" (delta aralığı).

| | Mobil | Web |
|---|---|---|
| Gönderim | 2 dakikada bir (`service.ts:18 FLUSH_INTERVAL_MS = 120_000`) + duraklatma / bölüm değişimi | **Periyodik gönderim yok.** Yalnızca onPause, onEnded, changeChapter, beforeunload. Sekme çökerse dilim kaybolur |
| clientId (idempotency) | Var | **Yok** → web kayıtlarında çift kayıt koruması yok |
| listenedAt | Gönderiliyor | **Gönderilmiyor** → playedAt = sunucuya ulaşma anı |
| Kuyruk | **Yalnızca bellekte** (`service.ts:33`). Uygulama kapanırsa gönderilmemiş kayıtlar kaybolur | — |

**Süre hesabı** (web `AudioPlayer.tsx:151-167`, mobil `service.ts:195-203`): `step = currentTime - lastPos`; `step > 0 && step <= dt*rate + tolerans` filtresi; `contentSec += step`, `listenedSec += step / rate`. Yani contentSec = içerik süresi, listenedSec = duvar saati.

- İleri sarma filtreyle elenir, kayda geçmez.
- Geri sarılıp tekrar dinlenen aralık ikinci kez sayılır.
- İzin verilen en yüksek hız: **2,0x** (web ve mobil `[0.75, 1, 1.25, 1.5, 2]`).
- `completedPct` web'de kitap geneli, mobilde bölüm içi: **iki istemcide farklı anlam.**

**clientVersion:** v1 = eski, listenedSec oynatıcı konumundan türetilmiş (gerçek dinleme değil), contentSec yok. v2 = delta tabanlı. Sunucu `route.ts:39` `v === 2 ? 2 : 1`: `v` göndermeyen her istemci v1 sayılıyor. **Ekim'de hâlâ 14 v1 kaydı üretilmiş** (muhtemelen güncellenmemiş eski mobil kurulumlar; doğrulanmadı). Raporlar v1'i tamamen dışlıyor (`clientVersion: 2` filtresi, 3 dosyada).

**Zaman alanları:** tek kolon `playedAt` (`timestamp without time zone`, DB UTC). Dinleme anı ile ulaşma anı **ayrı tutulmuyor.** Sunucu (`route.ts:22-30`), mobilin gönderdiği `listenedAt`'i yalnızca `now−7 gün … now+5 dk` aralığındaysa kabul ediyor; dışındaysa **sessizce `now()` yazıyor** → dinleme yanlış aya düşer.

**Şirket ataması:** PlayHistory'de companyId **yok.** Şirket her zaman bugünkü `User.companyId` üzerinden bulunuyor. Sonuçlar:
- Kullanıcının şirketi değişirse geçmişi yeni şirkete sayılır.
- `report-data.ts:25` `isActive: true` filtresi: **pasife alınan kullanıcının tüm geçmişi şirket raporundan düşer.**
- `listening/route.ts:78` `if (!u.companyId) continue;`: şirketsiz kullanıcının dinlemesi hiçbir yere sayılmaz.

**Kullanıcı şirket değiştirebiliyor mu:** Değiştiren endpoint bulunamadı. Atama yalnızca oluşturmada yapılıyor. Audit tablosu olmadığı için DB'den yapılmış değişiklik ölçülemiyor.

### 2.3 Veri kalitesi

```
toplam_satir: 216 · toplam_boyut: 160 kB

   ay    | v | kayit | listened_sn | content_sn
---------+---+-------+-------------+-----------
 2026-08 | 1 |    32 |        2435 |         0
 2026-09 | 1 |    91 |       17730 |         0
 2026-09 | 2 |    42 |       13908 |       967
 2026-10 | 1 |    14 |        1684 |         0
 2026-10 | 2 |    37 |        1253 |       753
```

- Toplam 37.010 sn ≈ 10,3 saat. v1: 137 kayıt / 21.849 sn. v2: 79 kayıt / 15.161 sn.
- Dinlenen kitap: 33. Dinleyen kullanıcı: 9 (63 kullanıcının %14'ü).
- **30 sn altı:** ham kayıt %47,2 (102/216); oturum bazında (aynı kullanıcı + kitap, < 5 dk boşluk) %38,2 (39/102 oturum).
- **Kişi-gün dağılımı** (39 kişi-gün): p50 600 sn, p90 1.836, p99 = p99,9 = max 9.703 sn (2 sa 41 dk). 24 saati aşan yok. Hacim küçük olduğu için yüzdelikler anlamsız.
- **Kitap süresini aşan:** tek kayıtta listenedSec > duration: 6; contentSec > duration: 0. Kişi-kitap-gün toplamı > duration: 8 kombinasyon.
- **Çakışan kayıtlar:** 242 çift (≤ 5 sn fark, aynı gönderim partisi: 58; gerçek aday: 184). 4 kullanıcı. %96'sı en az bir v1 kaydı içeriyor. Cihaz kimliği olmadığı için eşzamanlı cihaz mı v1 şişmesi mi ayırt edilemiyor.
- **Gecikme dağılımı:** hesaplanamıyor (ulaşma anı yok).
- clientId NULL: 187/216 (%86,6). chapterId NULL: 205/216 (%94,9). contentSec = 0 ama listenedSec > 0: 155/216 (%71,8).
- Hız oranı (v2, contentSec > 0, 61 kayıt): min 1,00, max 1,56.
- Sunucu eşikleri: 5 sn altı yazılmıyor (`route.ts:14`), 3.600 sn üstü **sessizce atılıyor** (`route.ts:18`). İkisi de sayılmıyor ve loglanmıyor.
- İç ekip (AudioB2B / Sesle) hesaplarını ayıran alan **yok.**
- Kitap dışı içerik bugün yok ("Podcast" kategorisi boş), ama katalog bunu işaretleyemiyor.

### 2.4 Lisans bitişi ve çevrimdışı dosyalar

- **Sunucu** (`src/lib/auth-guard.ts`): her istekte isActive, company.isActive, `endDate`, packageId kontrol ediliyor.
- **Mobil:** lisans engel kodları yalnızca kütüphane listesi çağrısında yakalanıyor (`api.ts:327,355`).
- **Çevrimdışı oynatma lisans kontrolünden geçmiyor:** `lib/player.tsx:268,292,302` → `startLocal ?? await getAudioUrl(...)`. İndirilmiş dosya varsa hiç ağ çağrısı yok. Kütüphane disk önbelleği yaş sınırsız.
- **Dosyalar silinmiyor:** `deleteAllDownloads()` yalnızca çıkışta ve kullanıcı lisans-bitti ekranında "Çıkış Yap"a basarsa.
- **Şifreleme yok:** düz MP3, `Paths.document/downloads`.
- **Sonuç:** çevrimdışı erişim **süresiz**; lisans bittikten sonraki dinleme ne engelleniyor ne ölçülüyor.

---

## 3. Takip soruları (Claude Code raporu)

### 3.1 contentSec neden listenedSec'ten çok düşük?

**Kod hatası yok. Eylül'deki uçurumu 18 sentetik kayıt yaratıyor.**

- contentSec ve clientVersion aynı gün eklendi (24 Eylül; web 75e597a, 93bb3ff; mobil 0bb3511, 15045df).
- **İlk v2 kaydı 12 Eylül**, yani v2'yi üreten koddan 12 gün önce.

```
content_sifir | kayit | listened_sn | content_sn | clientid_yok | chapterid_yok |    ilk     |    son     | max_listened
 f            |    61 |        1661 |       1720 |           32 |            50 | 2026-09-24 | 2026-10-12 |          121
 t            |    18 |       13500 |          0 |           18 |            18 | 2026-09-12 | 2026-10-02 |         1000
```

18 kaydın parmak izi:
- 17 farklı güne yayılmış, ama **hepsinin saati 19:23:53 UTC** (tek bir `now() - interval 'N days'` çalıştırmasının izi).
- listenedSec değerlerinin **hepsi 100'e tam bölünüyor** (500–1000); gerçek kayıtlarda bu oran 0/137.
- clientId ve chapterId hepsinde NULL. 3 kullanıcı, 5 kitap.
- Endpoint 7 günden eski tarihi reddederdi; kayıtlar 20 gün geriye tarihli → **doğrudan DB'ye yazılmış.** Üreten script repoda yok (commit edilmemiş, doğrulanmadı).
- **Gerçek v2:** 61 kayıt / 1.661 sn = **27,7 dakika.** sum(content)/sum(listened) = 1,036 (tasarıma uygun).

Code'un tespit ettiği iki zayıflık: sunucu `v=2`'yi sorgusuz kabul ediyor (contentSec=0 ile v2 kombinasyonunu işaretleyen kontrol yok), ve doğrudan DB yazımını engelleyen bir şey yok.

### 3.2 Book ve User silen yerler

| # | Yer | Tür |
|---|---|---|
| 1 | `src/app/api/admin/books/[id]/route.ts:113` `prisma.book.delete` (SUPER_ADMIN, admin kitap sayfasındaki sil düğmesi) | **HARD DELETE**, Chapter + PlayHistory cascade, S3 temizliği |
| 2 | `prisma/fix-duplicate-books.mjs:68` | **HARD DELETE** (elle çalıştırılan script, 4 Ekim'de 3 kayıt için çalıştı) |
| 3 | `scripts/security-test.mjs:243` `prisma.user.deleteMany` | HARD DELETE, yalnızca testin kendi kullanıcıları |
| 4 | `src/app/api/dashboard/member/route.ts:30-33` toggle_active | SOFT (isActive); kullanıcı şirket raporundan düşer |
| 5 | `src/app/api/dashboard/member/route.ts:37-41` remove | `companyId: null, isActive: false`. Satır durur, **şirket bağı kalıcı kopar** |
| 6 | `src/app/api/dashboard/admin/users/[userId]/route.ts:52-56` leave | Aynı. Koddaki yorum "PlayHistory korunur" diyor: satır korunuyor, atıf korunmuyor |

Company silen kod yok. Admin panelinde kullanıcıyı kalıcı silen düğme yok. Bugün şirketsiz 1 kullanıcı var, dinleme kaydı yok.

### 3.3 Son doğrulama sorgusu

**Şirketler:**

```
       name        | demo | aktif | baslangic  |   bitis    | koltuk | kullanici | admin | calisan | pasif
 AudioB2B QA       | f    | t     | 2026-10-05 | 2100-01-01 |     20 |         5 |     1 |       4 |     1
 YAY Deneme        | f    | t     | 2026-09-24 | 2027-09-24 |      1 |         0 |     0 |       0 |     0
 AudioB2B Demo     | t    | t     | 2026-08-15 | 2027-08-15 |     10 |        51 |     1 |      50 |     0
 TPAO A.Ş.         | t    | t     | 2026-10-05 | 2027-01-01 |     25 |         2 |     2 |       0 |     0
 TPAO Sunum (Demo) | t    | t     | 2026-08-14 | 2027-08-13 |     10 |         4 |     1 |       3 |     0

       name        | kayit | listened_sn | dinleyen
 AudioB2B Demo     |   135 |       20480 |        3
 TPAO Sunum (Demo) |    47 |        2766 |        1
 AudioB2B QA       |    32 |       13720 |        4
 TPAO A.Ş.         |     2 |          44 |        1
 YAY Deneme        |     0 |      (null) |        0
```

- **18 sentetik kaydın tamamı AudioB2B QA'da** (isDemo = false). Bu şirketin 13.720 sn'sinin 13.500'ü (%98,4) sentetik; gerçek QA dinlemesi 220 sn.
- Bugünkü raporlarda "demo hariç" dinlemenin %98,4'ü sentetik. **Gerçek ücretli müşteri dinlemesi yok.**
- `isDemo` hiçbir koddan **yazılmıyor**; yalnızca 3 yerde okunuyor. Mevcut değerler doğrudan DB'den girilmiş. Admin panelinde değiştirme arayüzü yok.
- AudioB2B Demo: 51 kullanıcı / 10 koltuk.

**iOS / Android dosya erişimi:**
- iOS: `UIFileSharingEnabled` ve `LSSupportsOpeningDocumentsInPlace` **yok** (app.json ve üretilmiş Info.plist). Dosyalar Files uygulamasına açık değil. Ancak `Documents` varsayılan olarak iCloud / iTunes yedeğine dahil; `isExcludedFromBackup` kullanılmıyor (doğrulanmadı).
- Android: `Paths.document` → `context.filesDir` (kaynak zinciri izlendi): uygulamaya özel dahili depolama. Depolama izni yok. Root'suz cihazda başka uygulama erişemez. Kalan boşluk: adb backup, root, iOS yedeği.

**Book.isActive gerçekten gizliyor mu? Listelerde evet, erişimde HAYIR.**
- Gizlenen yerler: kütüphane API'si ve web kütüphane / kategori sayfaları (7 yer).
- **Kontrol etmeyen yerler:** `api/dashboard/book/[id]`, `api/dashboard/audio-url`, `dashboard/listen/[bookId]` sayfası, favorites, player-state, bookmarks ve **play-history**. Tek kapı "kitap pakette mi".
- Pasif bir kitabın id'sini bilen istemci oynatıcıyı açabilir, imzalı S3 bağlantısı alabilir. Mobil önbellek ve indirilen kitaplar zaten yerelde oynanıyor.
- **Sonuç:** `Book.isActive` bir görünürlük anahtarı, erişim anahtarı değil. Hakkı biten kitabı pasife almak dinlenmesini durdurmuyor ve PlayHistory yazılmaya devam ediyor.

---

## 4. Claude Code'un uygulama planı

**Dağıtım tipleri:** WEB = Vercel deploy · OTA = JS-only Expo güncellemesi · SÜRÜM = yeni native build + mağaza incelemesi.

**OTA kısıtı:** `app.json:65-66` `runtimeVersion.policy: "appVersion"`, `version: "1.0.6"`. OTA yalnızca aynı appVersion ile derlenmiş kurulumlara ulaşır. Mevcut kullanıcılara OTA çıkabilmek için sürüm 1.0.6'da kalmalı. Kurulu: expo-file-system, expo-secure-store, expo-updates, expo-device, react-native-track-player. **AsyncStorage ve expo-crypto yok** (eklemek SÜRÜM gerektirir).

### A — Sunucu ve şema

**A1. PlayHistory'ye receivedAt, companyId, platform, appVersion** (WEB, risk düşük–orta)

```sql
ALTER TABLE "PlayHistory"
  ADD COLUMN "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "companyId"  TEXT,
  ADD COLUMN "platform"   TEXT,
  ADD COLUMN "appVersion" TEXT;
CREATE INDEX "PlayHistory_companyId_playedAt_idx" ON "PlayHistory" ("companyId", "playedAt");
-- Geri doldurma (ayrı adım):
UPDATE "PlayHistory" p SET "companyId" = u."companyId"
  FROM "User" u WHERE u.id = p."userId" AND p."companyId" IS NULL;
```

- companyId'ye FK **konmaz** (ON DELETE SET NULL bile atfı bozar).
- Geri doldurma varsayımı: "her kullanıcı hep bugünkü şirketindeydi". Bugün güvenli: 216/216 satır dolacak; companyId değiştiren endpoint yok; companyId → NULL yapan akışlardan geçmiş kullanıcının kaydı yok.
- Şirketsiz kullanıcının kaydı yine yazılır, companyId NULL kalır.
- Geri alma: 4 kolon + index drop.
- Değişecek dosyalar: schema.prisma, yeni migration, `play-history/route.ts`, auth-guard (`companyId` select'te mi, doğrulanmadı).

**A2. CASCADE → RESTRICT, silme akışları soft-delete** (WEB, risk orta–yüksek)

```sql
ALTER TABLE "PlayHistory" DROP CONSTRAINT "PlayHistory_bookId_fkey";
ALTER TABLE "PlayHistory" ADD CONSTRAINT "PlayHistory_bookId_fkey"
  FOREIGN KEY ("bookId") REFERENCES "Book"(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE "PlayHistory" DROP CONSTRAINT "PlayHistory_userId_fkey";
ALTER TABLE "PlayHistory" ADD CONSTRAINT "PlayHistory_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE "Book" ADD COLUMN "archivedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "deletedAt"  TIMESTAMP(3);
```

- Bookmark, PlayerState, UserFavorite cascade'leri olduğu gibi kalır.
- Risk: dinlemesi olan kitabı silme denemesi 500 verir; admin paneli anlamlı mesaj dönmeli. `fix-duplicate-books.mjs` ve `security-test.mjs` RESTRICT'e takılır.
- Geri alma: constraint'leri tek ALTER ile CASCADE'e döndürmek, veri kaybı yok.

**A3. Sessiz reddetmeler görünür olsun** (WEB, risk düşük)

```sql
CREATE TABLE "PlayHistoryReject" (
  id       TEXT PRIMARY KEY,
  "reason" TEXT NOT NULL, -- below_min | above_cap | stale_timestamp | pct_clamped | v2_without_content
  "day"    DATE NOT NULL,
  "count"  INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX "PlayHistoryReject_reason_day_key" ON "PlayHistoryReject" ("reason","day");
```

- Yalnızca sebep + gün + adet; kişisel veri yok. Sayaç yazımı ana işlemi yavaşlatmamalı, hatası yutulmalı.
- Code'un bıraktığı karar: pencere dışı listenedAt için (a) reddet ya da (b) `playedAt = listenedAt` yaz ve `isStale` işaretle.

**A4. Şirket raporları PlayHistory.companyId'den okusun** (WEB, risk orta; A1'e bağımlı)

- `report-data.ts:25,27,28,33`, `admin/reports/listening/route.ts:73-80`, `dashboard/admin/metrics/route.ts:41,47,59,63,123`: kullanıcı listesi yerine doğrudan `playHistory.where({ companyId })`; isActive ve şirketsiz filtreleri kalkar.
- Açık karar: `clientVersion: 2` filtresi sentetik v2'yi içeri alıyor; `clientVersion = 2 AND contentSec > 0` mı olmalı, yoksa sentetikler mi işaretlenmeli?
- Risk: pasif kullanıcılar dahil olunca rapor toplamları artar; önceden gönderilmiş raporlarla uyuşmazlık. Bugünkü veride etki 0.

### B — İstemci

**B1. Web** (WEB, risk orta): 60 sn periyodik gönderim (yalnızca oynarken), her gönderim için `crypto.randomUUID()` clientId, `listenedAt`, sayfa kapanışında `navigator.sendBeacon`. Sunucu upsert'e zaten hazır. Doğrulanmamış: sendBeacon'ın `text/plain` gövdesini `req.json()`'ın okuyup okumadığı. Kayıt sayısı artar; "30 sn altı" oranı mekanik olarak yükselir.

**B2. Mobil** (OTA, risk orta): `_pending` kuyruğu **expo-file-system** ile JSON dosyasında kalıcı (downloads.ts'teki meta.json kalıbıyla; AsyncStorage kullanılmaz çünkü SÜRÜM ister). `platform` = `Platform.OS`, `appVersion` = `Updates.runtimeVersion` / `updateId`. Bozuk dosya sonsuz döngüye sokmamalı; 4xx'te kayıt düşürme davranışı korunmalı. Şart: `version: "1.0.6"` korunmalı.

### C — Çevrimdışı lisans (yalnızca tasarım)

**C1** (sunucu WEB + istemci OTA, **risk yüksek: yanlış pozitif kesinti**):
1. Kütüphane cevabına `company.endDate` (+ isActive, packageId).
2. Cihazda `expo-secure-store` ile saklama.
3. `player.tsx:268,292,302`'de yerel oynatmadan önce kontrol. Saat geri alınmasına karşı "en son görülen sunucu zamanı" saklanır.
4. Açılışta ve N saatte bir hafif lisans kontrolü (`/api/dashboard/me` benzeri endpoint var mı, doğrulanmadı).
5. Bitişte davranış: (a) yalnızca oynatmayı kilitle, (b) dosyaları sil, (c) önce kilitle, X gün sonra sil. Karar verilmedi.
6. Hoşgörü penceresi: "son başarılı doğrulamadan itibaren N gün".

**C2 — Şifreleme seçenekleri:**

| Seçenek | Koruma | Maliyet | Dağıtım |
|---|---|---|---|
| 0. Şifreleme yok, yalnızca C1 kilidi | Uygulama içinden erişim kesilir; dosya cihazda düz | Yok | OTA |
| 1. İşletim sistemi dosya koruması | Cihaz kilitliyken diskte şifreli | Düşük–orta | Muhtemelen SÜRÜM |
| 2. Uygulama seviyesi AES + yerel proxy | "Sıradan kullanıcı çıkaramaz" | Yüksek (expo-crypto + proxy + RNTP testleri) | SÜRÜM |
| 3. DRM (Widevine / FairPlay) | "Kararlı saldırgan çıkaramaz" | Çok yüksek (lisans sunucusu, 8.867 bölümün yeniden paketlenmesi) | SÜRÜM + altyapı |

### D — Şirket türü

**D1** (WEB, risk düşük):

```sql
CREATE TYPE "CompanyType" AS ENUM ('PAID','TRIAL','DEMO','QA','REVIEW','INTERNAL');
ALTER TABLE "Company" ADD COLUMN "companyType" "CompanyType" NOT NULL DEFAULT 'PAID';
UPDATE "Company" SET "companyType" = 'DEMO' WHERE "isDemo" = true;
-- isDemo hemen düşürülmez; okuyan 3 nokta geçtikten ve bir rapor dönemi doğrulandıktan sonra.
ALTER TABLE "User" ADD COLUMN "isInternal" BOOLEAN NOT NULL DEFAULT false;
```

İç ekip işareti e-posta alan adından türetilmemeli. Şirket oluşturma / düzenleme ekranına yazma yolu eklenecek (bugün yok).

### Code'un önerdiği sıra ve paketleme

| Sıra | Madde | Gerekçe |
|---|---|---|
| 0 | 18 sentetik kayıt kararı | Önce karar verilmezse tüm rapor doğrulamaları yanlış taban üzerinde yapılır |
| 1 | A3 | Bağımsız, düşük riskli, hemen ölçüm üretir |
| 2 | A1 | Temel; geri doldurma varsayımı bugün %100 güvenli, beklendikçe bozulur |
| 3 | A2 | — |
| 4 | D1 | A4'ten önce rapor filtreleri doğru kümeye otursun |
| 5 | A4 | A1 + D1 gerektirir |
| 6–7 | B1, B2 | Sunucu hazır olduktan sonra |
| 8–9 | C1, C2 | En riskli, en çok ürün kararı gerektiren |

Paketler: P1 = A3 · P2 = A1 + A2 + D1 (tek migration) · P3 = A4 · P4 = B1 · P5 = B2 (OTA) · P6 = C1 sunucu · P7 = C1 istemci (OTA).

---

## 5. İkinci kontrolcünün (Claude) değerlendirmesi

### 5.1 Code raporlarındaki düzeltmeler

1. Aşama 0 §5.3'te "Asgari süre eşiği (G)" başlığı yanlış: G, telif modelinde **günlük tavan**. Ölçülen şey 30 sn eşik; rakamlar doğru.
2. "Verinin %63,4'ü v1" **kayıt sayısına** göre. Süre bazında 21.849 / 37.010 = %59.
3. Risk 8'deki cümle bozuk. Doğrusu: 1.024 sesli kitabın yalnızca 33'ü (%3,2) dinlenmiş.
4. Code Aşama 0'da v2 içindeki contentSec / listenedSec uçurumunu fark etmedi; takip sorusunda çözdü (§3.1).
5. Benim hatam: §3.3'ten önce "demo dışı 2 şirketten biri muhtemelen TPAO A.Ş." demiştim. Yanlış: demo dışı şirketler AudioB2B QA ve YAY Deneme. TPAO A.Ş. isDemo = true.

### 5.2 Plan değişiklik önerileri

| # | Madde | Öneri | Gerekçe |
|---|---|---|---|
| a | Ön koşul | **İlk migration'dan önce ayrı bir geliştirme veritabanı** (Supabase, Frankfurt; şema + anonim/sentetik veri) | Plan "staging"de test diyor ama staging yok; bugün tüm testler canlıda yapılmak zorunda |
| b | Ön koşul | Her migration öncesi canlı DB'nin pg_dump yedeği (repo dışında, chmod 600) | Mevcut ekip kuralı |
| c | Paketleme | **P1 = A1 + A3** (ikisi de `play-history/route.ts`); A2 ayrı; D1 türler belirlendikten sonra ayrı | Üçünü tek migration'da birleştirmek geri almayı zorlaştırır; A3'ün pencere kararı A1'deki receivedAt'e dayanıyor |
| d | A3 karar | **Gerçek dinleme tarihi saklansın, receivedAt ayrı yazılsın.** Azami çevrimdışı süreden (taslak 30 gün) eski kayıtlar reddedilip sayaca yazılsın. Gelecek tarihli (> now + 5 dk) kayıtlar reddedilsin | Telif modelinde geç kayıt, ulaştığı döneme yazılıyor ama günlük tavan dinleme anına göre uygulanıyor; bunun için iki zamanın da doğru tutulması gerekiyor. "isStale" bayrağına gerek kalmıyor: receivedAt − playedAt farkı bunu zaten veriyor |
| e | A2 | `Book.archivedAt` yerine mevcut `Book.isActive` kullanılsın; **ama** §3.3'e göre isActive bugün yalnızca görünürlük. A2'ye şu eklenmeli: `book/[id]`, `audio-url`, `listen/[bookId]`, favorites, player-state, bookmarks ve **play-history**'de `isActive` kontrolü (veya merkezi bir `canAccessBook` yardımcı fonksiyonu) | Hakkı biten kitap dinlenmeye ve PlayHistory'ye yazılmaya devam ediyor. Çevrimdışı tarafı C1 kapatır |
| f | A2 | `User.deletedAt` eklenmesin | Kullanıcıyı silen tek yer güvenlik testi; kullanılmayacak alan |
| g | A2 | `fix-duplicate-books.mjs` dinlemesi olan kopyayı silmek yerine PlayHistory satırlarını ana kitaba taşısın, sonra silsin | RESTRICT sonrası script yarıda kalır; taşımak veriyi korur |
| h | D1 | **Varsayılan `PAID` kullanılmasın**, beş şirket tek tek sınıflansın; yeni şirketler için varsayılan TRIAL | Ödeme yapan müşteri yok; varsayılan PAID mevcut 2 şirketi yanlış etiketler |
| i | D1 | `endDate = 2100-01-01` sentinel'ı yerine tür (QA / INTERNAL) kullanılsın; arayüzde "Süresiz" gösterilsin | Sentinel tarih raporları ve uyarıları yanıltıyor |
| j | C2 | Şimdilik Seçenek 0 + C1 yeterli; iOS yedeğini kapatmak (`isExcludedFromBackup`) ayrıca değerlendirilsin | Android'de dosyalar sandbox içinde, iOS'ta Files uygulamasına kapalı. Asıl acil boşluk süresiz erişim (C1) |
| k | A1 | Sunucu, yazma anında kullanıcının şirketinin aktif ve sözleşmesinin geçerli olduğunu zaten kontrol ediyor (auth-guard); companyId bu kontrol edilmiş şirketten alınmalı | Telif modelinde "şirket = dinleme anındaki aktif sözleşmeli şirket" |
| l | Sıra | A4'ün öncelikli olması: TPAO panelini doğrudan etkiliyor (pasif kullanıcı geçmişinin düşmesi). A1 çıktıktan hemen sonra | Müşteri tarafında görünür hata |

### 5.3 Önerilen sıra (Claude)

0. Geliştirme veritabanı + yedekleme prosedürü
1. Sentetik kayıt kararı (§6.1)
2. **P1:** A1 + A3 (WEB)
3. **P2:** A4 (WEB)
4. **P3:** A2 + erişim kontrolleri (WEB)
5. **P4:** D1 (WEB, sınıflandırma kararından sonra)
6. **P5:** B1 web (WEB)
7. **P6:** B2 mobil (OTA, 1.0.6 korunarak)
8. **P7–P8:** C1 sunucu, C1 istemci (WEB + OTA)
9. C2 (gerekirse)

---

## 6. Karar bekleyen konular (ürün sahibi)

1. **18 sentetik kayıt** (AudioB2B QA'da). 2 Ekim'de bir test veya demo için üretilmiş görünüyor. Seçenekler: (a) yedekleyip silmek, (b) bırakıp QA türüyle zaten dışlamak. QA şirketi tüm raporlardan çıkacaksa (b) yeterli olabilir; ama "demo hariç" mevcut raporları bugün de bozuyor.
2. **Pencere dışı listenedAt** (§5.2 d önerisi) ve **azami çevrimdışı süre** (taslak 30 gün).
3. **Beş şirketin türü** (önerilen):

| Şirket | Bugün | Önerilen tür | Not |
|---|---|---|---|
| AudioB2B QA | isDemo = false, bitiş 2100 | QA | Sentetik veri burada |
| YAY Deneme | isDemo = false, 0 kullanıcı | ? | Amacı belirsiz |
| AudioB2B Demo | isDemo = true, 51 / 10 koltuk | TRIAL (+ App Store inceleme hesabı REVIEW'a ayrılmalı) | Farklı kurumlardan aday deneme kullanıcıları |
| TPAO A.Ş. | isDemo = true, 25 koltuk | TRIAL | TPAO değerlendiricileri |
| TPAO Sunum (Demo) | isDemo = true | DEMO | Yalnızca sunum hesapları |

4. **C1 bitiş davranışı:** kilitle / sil / kademeli; hoşgörü penceresi süresi.
5. **Rapor değişikliği:** A4 sonrası rakamlar değişebilir; müşteriye "bu tarihten itibaren" notu gerekir mi?

---

## 7. İnceleyenlere sorular

1. **P1 (A1 + A3)** tek migration ve tek deploy olarak güvenli mi? `NOT NULL DEFAULT CURRENT_TIMESTAMP` ile receivedAt eklemek mevcut 216 satır için doğru bir başlangıç değeri mi (gerçek ulaşma anı bilinmiyor)? Mevcut satırlar için receivedAt NULL bırakılmalı mı?
2. **companyId geri doldurma varsayımı** yeterli mi, yoksa geri doldurulan satırlar ayrıca işaretlenmeli mi (örneğin `companyIdSource = 'backfill'`)?
3. **A2:** RESTRICT ile `isActive` erişim kontrolünü aynı deploy'da çıkarmak mı, ayrı çıkarmak mı daha güvenli? Merkezi bir `canAccessBook` fonksiyonu mu, endpoint başına kontrol mü?
4. **Pencere dışı kayıtlar:** §5.2 d önerisi Code'un (a) ve (b) seçeneklerinden daha mı iyi? Saklanan istemci zamanının manipüle edilmesine karşı başka bir önlem gerekir mi?
5. **B1:** 60 sn periyodik gönderim + sendBeacon kombinasyonunda çift kayıt riski var mı (son dilim hem interval hem beacon ile gönderilirse)? clientId bunu her durumda önler mi?
6. **B2:** expo-file-system tabanlı kalıcı kuyrukta eşzamanlı yazma ve bozulma senaryoları yeterince ele alınmış mı?
7. **C1:** Hoşgörü penceresi ve saat manipülasyonuna karşı "son görülen sunucu zamanı" yaklaşımı yeterli mi? Daha basit ve güvenli bir alternatif var mı?
8. **D1:** CompanyType enum değerleri yeterli mi? `isDemo`'nun bir süre `companyType` ile birlikte yaşaması tutarsızlık riski doğurur mu (ikisi farklılaşırsa hangisi geçerli)?
9. Bu planda **gözden kaçan bir veri kaybı veya geri alınamaz adım** görüyor musunuz?
10. Sıralamada (§4 Code, §5.3 Claude) hangisini tercih edersiniz, neden?
