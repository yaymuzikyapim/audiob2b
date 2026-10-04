# AudioB2B — Admin Panel Güvenlik & Veri Denetimi

> **Tarih:** 2026-10-04  
> **Yöntem:** Salt okuma (read-only) kod analizi; canlı veri dokunulmadı.  
> **Kapsam:** `/src/app/admin/**`, `/src/app/dashboard/**`, `/src/app/api/**`, `prisma/schema.prisma`, `src/proxy.ts`, `src/lib/session.ts`, `src/lib/access.ts`

---

## 1. Mimari Özet

| Katman | Konum | Durum |
|--------|-------|-------|
| Edge middleware | `src/proxy.ts` | **Etkin** — Next.js 16.3 `proxy.ts` convention, build: `ƒ Proxy` ✅ |
| Admin layout koruması | `src/app/admin/layout.tsx` | Çalışıyor — `getCurrentUser()` + DB doğrulama ✅ |
| Dashboard layout koruması | `src/app/dashboard/layout.tsx` | Çalışıyor — `getCurrentUser()` + DB doğrulama ✅ |
| API handler başına kontrol | Her route'da `requireUser()` | DB doğrulama — JWT rol tuzağı kapatıldı ✅ |
| Aktif erişim doğrulaması | `src/lib/auth-guard.ts` — `requireUser()` | Tüm yollarda: `isActive` + rol + şirket + lisans ✅ |

**Rol sistemi:** `SUPER_ADMIN` (platform ekibi) · `COMPANY_ADMIN` (müşteri yöneticisi) · `EMPLOYEE` (dinleyici)

**Oturum:** Jose HS256 JWT, 30 günlük süre, `audiob2b_session` cookie + Bearer token (mobil). `SessionPayload` içeriği: `id, email, name, role, companyId`.

---

## 2. Güvenlik Bulguları

### BULGU-1 · ~~`src/proxy.ts` dead code — kenar koruma yok~~
**Önem:** ~~Orta~~ → **GEÇERSİZ**

> **Güncelleme (2026-10-04):** Bu bulgu geçersizdir.  
> Next.js 16.3, middleware için `proxy.ts` + `proxy` export adını resmi convention olarak benimsemiştir (`node_modules/next/dist/lib/constants.js` satır 289: `PROXY_FILENAME = 'proxy'`). Build çıktısı `ƒ Proxy (Middleware)` satırını göstermektedir — proxy aktif ve çalışmaktadır. `/api/*` kapsamı kasıtlıdır: `requireUser()` eksik kalırsa kenar katman yedek güvenlik sağlar (defense-in-depth).

~~`proxy.ts` içindeki fonksiyon `proxy` olarak dışa aktarılmış; Next.js middleware'i `default` veya `middleware` adında export bekler...~~

---

### BULGU-2 · `/api/logos/[...key]` herkese açık
**Önem:** Düşük–Orta

`src/app/api/logos/[...key]/route.ts` içinde oturum kontrolü yok. Proxy da etkin olmadığı için şirket logolarına URL şeması bilinirse kimlik doğrulamasız erişilebilir.

Logolar S3 UUID anahtarlarıyla saklandığından tahmin zor; ancak URL bir kez sızdığında sonsuza kadar erişilebilir.

---

### BULGU-3 · `/katalog` route'u tüm oturum sahiplerine açık
**Önem:** Düşük

`src/app/katalog/route.ts` yalnızca `!session` kontrolü yapıyor. `EMPLOYEE` dahil herhangi bir giriş yapmış kullanıcı özel katalog HTML dosyasına erişebilir.

---

### BULGU-4 · JWT rol değişikliklerini yansıtmıyor
**Önem:** Orta → **✅ Düzeltildi** (commit `69f6874`, `13c6787`)

> `requireUser()` (`src/lib/auth-guard.ts`) JWT'den yalnızca `id`'yi okur; rol, `companyId`, `isActive`, şirket durumu her istekte DB'den sorgulanır. Admin ve dashboard route'larının tamamı, admin/dashboard layout'ları `requireUser()` / `getCurrentUser()` kullanacak şekilde güncellendi.

~~Kullanıcının DB'deki rolü değiştirilse de 30 günlük JWT geçerli kaldığı sürece eski yetkiyle çalışmaya devam eder...~~

---

### BULGU-5 · `player-state`, `bookmarks`, `favorites` — süresi dolmuş üyeler
**Önem:** Düşük → **✅ Düzeltildi** (commit `13c6787`)

> Tüm dashboard route'ları (`player-state`, `bookmarks`, `bookmarks/[id]`, `favorites`, `favorites/[bookId]`) `requireUser({ roles: ["COMPANY_ADMIN", "EMPLOYEE"] })` kullanacak şekilde güncellendi. Bu, `isActive`, rol ve şirket lisans kontrolünü her istekte DB'den yapar.

~~`/api/dashboard/player-state`, `/api/dashboard/bookmarks`, `/api/dashboard/favorites` route'ları `getSession()` sonrası `getActiveAccess()` çağırmıyor...~~

---

### BULGU-6 · Admin davet — tekrarlanan token kontrolü yok
**Önem:** Düşük → **✅ Düzeltildi** (commit `72a11a3`)

> `POST /api/admin/companies/[id]/invite` route'una bekleyen davet kontrolü eklendi: aynı `email + companyId` için `usedAt: null` ve `expiresAt > now` kombinasyonunda mevcut davet varsa `409` döner.

~~`POST /api/admin/companies/[id]/invite` aynı e-posta + şirket için bekleyen davet bulunup bulunmadığını kontrol etmiyor...~~

---

## 3. Veri Bütünlüğü Bulguları

### BULGU-7 · Kitap silme S3 ses dosyalarını temizlemiyor
**Önem:** Yüksek

`DELETE /api/admin/books/[id]` → `prisma.book.delete()` cascade ile chapter DB kayıtlarını siler, ancak S3'teki ses dosyalarını silmiyor. Tek bölüm silme (`DELETE /api/admin/books/[id]/chapters`) `deleteFile(s3Key)` çağırıyor; toplu kitap silme yapmıyor.

Sonuç: S3 depolama birikiyor, silinmiş ses dosyaları S3'te kalıyor.

---

### BULGU-8 · Paket kitap listesi değiştirme işlemi transaction içinde değil
**Önem:** Yüksek

`PUT /api/admin/packages/[id]`:
```
prisma.packageBook.deleteMany(...)  // tüm kitaplar silindi
prisma.packageBook.createMany(...)  // BAŞARISIZ OLURSA → paket boş kalır
```
İki işlem birbirinden bağımsız. `createMany` başarısız olursa paket sıfır kitapla kalır; bu güncelleme sırasında giriş yapan kullanıcıların kütüphanesi boşalır.

---

### BULGU-9 · Şirket silme kullanıcıları ve logoyu yetim bırakıyor
**Önem:** Orta

`DELETE /api/admin/companies/[id]` → `company.delete()`:
- Kullanıcıların `companyId` alanı `null` oluyor (`SetNull` cascade), `isActive` değişmiyor. Bu kullanıcılar hâlâ giriş deneyebilir.
- S3'teki logo dosyası silinmiyor; depolama birikimi devam eder.
- `InviteToken` kayıtları cascade ile silinir (doğru).

---

### BULGU-10 · Kategori birleştirme işlemi transaction içinde değil
**Önem:** Düşük

`POST /api/admin/categories/merge` önce `book.updateMany` (kaynaktan hedefe), ardından `category.deleteMany` yapıyor; transaction yok. Aralarında hata olursa kitaplar taşınmış ama eski kategoriler silinmemiş olabilir.

---

### BULGU-11 · `positionSec` dinleme süresi değil pozisyon
**Önem:** Bilgi

`src/app/admin/companies/[id]/page.tsx` kullanıcıların toplam dinleme istatistiğini `playerState.positionSec` toplamından hesaplıyor. Bu değer gerçek dinleme süresi değil, mevcut konumdur. Gerçek dinleme istatistikleri için `PlayHistory` (v2) kullanılmalı.

---

## 4. Girdi Doğrulama

| Endpoint | Durum |
|----------|-------|
| `POST /api/admin/books` | `title`, `author`, `duration` zorunluluk kontrolü var; `duration` `parseInt` ile dönüştürülüyor (NaN kontrolü yok) |
| `POST /api/admin/companies` | `name`, `slug`, `startDate`, `endDate` kontrolü var; `maxSeats` `parseInt` (NaN kontrolü yok) |
| `POST /api/admin/books/import` | Satır sayısı sınırı yok; büyük payloadlar performans sorunu yaratabilir |
| `GET /api/admin/cover-upload-url` | `ext` parametresi `contentType` eşlemesinden geliyor (güvenli); boyut sınırı yok (S3 presign sonrası) |
| `GET /api/admin/logo-upload-url` | `contentType` izin listesine göre doğrulanıyor (doğru) |
| `PATCH /api/admin/companies/[id]` | `brandColor` ve `logoUrl` alanları için format/uzunluk doğrulaması yok |
| `POST /api/dashboard/play-history` | `listenedSec < 5` ve `> 3600` reddediliyor (iyi); `listenedAt` ±7 gün/5 dk pencere kontrolü var (iyi) |
| `POST /api/dashboard/player-state` | `clientSavedAt` gelecek zaman için `Math.min(..., Date.now())` ile kırpılıyor (iyi) |

---

## 5. Performans Bulguları

### BULGU-12 · Raporlarda N+1 sorgu
**Önem:** Orta

`GET /api/admin/reports/listening`: her şirkete en çok dinlenen kitabı bulmak için ayrı `playHistory.groupBy()` sorgusu çalıştırılıyor. Şirket sayısı arttıkça sorgu sayısı lineer büyür.

---

### BULGU-13 · Şirket detay sayfası tüm kullanıcıları paginelemesiz yüklüyor
**Önem:** Düşük

`src/app/admin/companies/[id]/page.tsx` şirkete ait tüm kullanıcıları tek sorguda çekiyor. Büyük şirketlerde (100+ kullanıcı) sayfa yüklenme süresi ve bellek kullanımı artabilir.

---

## 6. Hata Yönetimi

### BULGU-14 · Bildirim log kaydı sessiz hata yutuyor
**Önem:** Düşük

`POST /api/admin/notifications`:
```typescript
prisma.notificationLog.create({ data: logData }).catch(() => {});
```
`await` yok; kayıt başarısız olursa sessizce geçiliyor. Push bildirimi gönderilmiş ancak log tablosuna yansımamış olabilir.

---

## 7. Yıkıcı İşlemler Özeti

| İşlem | S3 Temizlik | Transaction | Audit Log |
|-------|-------------|-------------|-----------|
| Kitap sil | Hayır (ses orphan) | Hayır | Hayır |
| Tek bölüm sil | Evet | Hayır | Hayır |
| Şirket sil | Hayır (logo orphan) | Hayır | Hayır |
| Paket sil | Hayır | Hayır | Hayır |
| Paket kitap listesi değiştir | Hayır | **Hayır ⚠️** | Hayır |
| Kategori birleştir | Hayır | Hayır | Hayır |

---

## 8. Audit Log Durumu

Şemada `AuditLog` modeli yok. Admin işlemleri (şirket oluşturma/silme, kullanıcı şifre sıfırlama, paket değişiklikleri vb.) için kayıt tutulmuyor.

**Kayıt tutulan:**
- `NotificationLog` (push bildirimleri — ancak yazımı bkz. Bulgu-14)
- `User.lastLoginAt` (giriş zamanı)
- `PlayHistory` (dinleme istatistikleri)
- Sunucu `console.error` logları (Vercel/hosting log'larına gidiyor)

---

## 9. Öncelik Sırası

| # | Bulgu | Önem | Durum |
|---|-------|------|-------|
| 1 | Kitap silme S3 temizlemiyor | Yüksek | Açık |
| 2 | Paket PUT transaction yok | Yüksek | Açık |
| 3 | JWT rol değişikliklerini yansıtmıyor | Orta | **✅ Düzeltildi** `69f6874` `13c6787` |
| 4 | Koltuk kontrolü TOCTOU | Orta | **✅ Düzeltildi** `87386db` |
| 5 | Raporlarda N+1 sorgu | Orta | Açık |
| 6 | Şirket silme kullanıcıları/logoyu yetim bırakıyor | Orta | Açık |
| 7 | `/api/logos` auth yok | Orta | Açık |
| 8 | Bildirim log fire-and-forget | Düşük | Açık |
| 9 | Admin davet tekrar kontrolü yok | Düşük | **✅ Düzeltildi** `72a11a3` |
| 10 | Süresi dolmuş kullanıcı state yazabiliyor | Düşük | **✅ Düzeltildi** `13c6787` |
| 11 | Kategori birleştirme transaction yok | Düşük | Açık |
| 12 | `/katalog` tüm oturumlar erişebiliyor | Düşük | Açık |
| 13 | `positionSec` dinleme süresi sanılıyor | Bilgi | Açık |
| 14 | Şirket sayfası paginelemesiz kullanıcı yüklemesi | Düşük | Açık |
| — | ~~`proxy.ts` etkin değil~~ | ~~Orta~~ | **Geçersiz** — Next.js 16.3 convention |

---

*Bu rapor salt okunur kod analizine dayanmaktadır. Canlı veri, DB içeriği veya S3 bucket'ına dokunulmamıştır.*

---

## EK A — Bulgu-1 Yeniden Doğrulaması: `proxy.ts` Durumu (GEÇERSİZ)

**Next.js sürümü:** 16.3.0 (`package.json`)

**2026-10-04 Yeniden inceleme:** Bulgu-1 GEÇERSİZ olarak revize edildi.

**`node_modules/next/dist/lib/constants.js` satır 289:**
```
PROXY_FILENAME = 'proxy'
```
Next.js 16.3, `proxy.ts` dosyasını ve `proxy` adlı export'u resmi convention olarak desteklemektedir. Derleme zamanı template kodu: `const handlerUserland = (isProxy ? mod.proxy : mod.middleware) || mod.default`.

**Build çıktısı (route tablosu):**
```
ƒ Proxy (Middleware)    src/proxy.ts
```
Proxy aktif ve çalışmaktadır.

**İlk denetimdeki hata:** `.next/server/middleware-manifest.json` boş görünüyordu çünkü Next.js 16.3'te proxy, middleware-manifest yerine ayrı bir mekanizma üzerinden kaydedilmektedir.

**Sonuç:** `src/proxy.ts` doğru convention'ı kullanıyor. `/api/*` kapsamı kasıtlıdır (defense-in-depth). Değişiklik gerekmez.

---

## EK B — Bulgu-4 Kapsamı: Route Başına Auth Türü

### Dashboard ve Mobile Route'ları

| Route | getActiveAccess (DB) | Sadece JWT | Rol Kontrolü |
|-------|---------------------|-----------|--------------|
| `/api/dashboard/library` | Evet ✓ | — | SUPER_ADMIN reddedilir |
| `/api/dashboard/book/[id]` | Evet ✓ | — | SUPER_ADMIN reddedilir |
| `/api/dashboard/audio-url` | Evet ✓ | — | SUPER_ADMIN reddedilir |
| `/api/dashboard/play-history` | Evet ✓ | — | SUPER_ADMIN reddedilir |
| `/api/dashboard/player-state` | **Hayır ✗** | JWT | SUPER_ADMIN reddedilir |
| `/api/dashboard/bookmarks` | **Hayır ✗** | JWT | yok |
| `/api/dashboard/favorites` | **Hayır ✗** | JWT | yok |
| `/api/dashboard/team` | **Hayır ✗** | JWT | `role === "COMPANY_ADMIN"` (JWT'den) |
| `/api/dashboard/member` | **Hayır ✗** | JWT | `role === "COMPANY_ADMIN"` + hedef `companyId` DB'den |
| `/api/dashboard/invite` | **Hayır ✗** | JWT | `role === "COMPANY_ADMIN"` + `company.maxSeats` DB'den |
| `/api/dashboard/invite/bulk` | **Hayır ✗** | JWT | `role === "COMPANY_ADMIN"` + `company.maxSeats` DB'den |
| `/api/mobile/last-played` | Evet ✓ | — | SUPER_ADMIN reddedilir |
| `/api/mobile/push-token` | **Hayır ✗** | JWT | yok |

### Admin Route'ları

Tüm `/api/admin/*` route'larında `session.role !== "SUPER_ADMIN"` kontrolü var; bu kontrol JWT'den okunuyor. Hiçbirinde kullanıcının `isActive` durumunu DB'den doğrulayan `getActiveAccess()` veya benzeri sorgu yok.

### Pratik Senaryo Analizi

**Pasife alınmış COMPANY_ADMIN (isActive=false):**
- `user.update({ isActive: false })` yapılıyor.
- DB'de `isActive=false`, ancak JWT hâlâ geçerli (30 güne kadar).
- `team`, `member`, `invite`, `invite/bulk` route'larında yalnızca `session.role` kontrol ediliyor.
- **Sonuç: Pasife alınmış COMPANY_ADMIN elindeki JWT ile davet göndermeye, üye pasife almaya devam edebilir.**

**Pasife alınmış SUPER_ADMIN:**
- Tüm `/api/admin/*` route'larında `session.role !== "SUPER_ADMIN"` JWT'den kontrol ediliyor; `isActive` sorgulanmıyor.
- **Sonuç: Pasife alınmış SUPER_ADMIN tüm admin API işlemlerini yapmaya devam edebilir.**
- Dashboard route'larında `getActiveAccess()` kullananlar (library, book/[id], vb.) `user.isActive` kontrolü yaptığından bu gruba erişimi keser — ancak admin route'larını kesmez.

---

## EK C — Toplu Davet Koltuk Kontrolü (TOCTOU) — ✅ Düzeltildi (commit `87386db`)

### Eşzamanlı İstek Riski

> **Güncelleme (2026-10-04):** TOCTOU açığı kapatıldı. `/api/dashboard/invite`, `/api/dashboard/invite/bulk` ve `/api/invite/accept` üç endpoint'i de `SELECT id FROM "Company" WHERE id = $companyId FOR UPDATE` kilidini `$transaction` içinde kullanıyor. Koltuk sayımı formülü: `aktif kullanıcılar + bekleyen süresi dolmamış davetler ≥ maxSeats`.

~~`/api/dashboard/invite` ve `/api/dashboard/invite/bulk` her ikisi de şu pattern'ı kullanıyor...~~

### PER_SEAT vs FLEX_POOL Farkı

Şu an kodda `licenseType` alanı **koltuk sayım mantığını etkilemiyor.** Her iki tip için de `maxSeats` sayısı aynı şekilde kullanılıyor. `FLEX_POOL` tipi için farklı bir kota hesabı uygulanması düşünüldüyse bu henüz implemente edilmemiş.

---

## EK D — Yıkıcı İşlemler: Arayüzde Onay Adımı

| İşlem | API Var mı | UI Tetikleyici | Arayüzde Onay |
|-------|-----------|---------------|--------------|
| Kitap sil | Evet | `DeleteBookButton` | **Evet** — iki tıklama (confirm state) |
| Tek bölüm sil | Evet | `ChapterUploader` | **Evet** — `window.confirm()` diyaloğu |
| Şirket sil | Evet | **UI tetikleyici yok** | — (API çağrısı mevcut, UI'da buton/tetikleyici bulunamadı) |
| Paket sil | Evet | **UI tetikleyici yok** | — (API çağrısı mevcut, UI'da buton/tetikleyici bulunamadı) |
| Paket kitap listesi değiştir (PUT) | Evet | `PackageBookManager` | **Hayır** — direkt kaydet |
| Kategori birleştir | Evet | doğrulanmalı | doğrulanmalı |

**Not:** Şirket ve paket silme API route'ları mevcut (`DELETE /api/admin/companies/[id]`, `DELETE /api/admin/packages/[id]`), ancak mevcut admin UI bileşenlerinde bu endpoint'leri çağıran bir buton veya form bulunamadı. Bu durumun kasıtlı olup olmadığı doğrulanmalıdır.

---

## EK E — "AudioB2B Demo" Şirketi İstatistiklerde

Prisma şemasında `isDemo`, `isTest` veya benzeri bir alan yok. Admin raporlarında (`/api/admin/reports/listening`, `/api/admin/stats`) Demo şirketi diğer şirketlerden ayırt edilmiyor.

Demo kullanıcı oluşturma script'i (`prisma/create-demo-users.ts`) DB'de `"Demo"` içeren adla şirketi bulup EMPLOYEE rolünde kullanıcılar ekliyor. Bu kullanıcıların ürettiği PlayHistory kayıtları admin raporlarında gerçek müşteri verileriyle karışık görünüyor.

**Demo şirketini istatistiklerden çıkarmak için** şema değişikliği (`isDemo Boolean @default(false)`) ya da şirket adı/slug filtresi gerekiyor.

---

## EK F — Logo Erişimi ve Bulgu-2 Kapsamı

Logo erişiminin unauthenticated akışlarda kullanıldığı yerler:

| Konum | Logo Kullanımı |
|-------|--------------|
| Giriş ekranı (`/login`) | **Hayır** — logo yok |
| Davet sayfası (`/invite`) | **Hayır** — logo yok |
| Davet e-postası (`src/lib/emails/invite.ts`) | **Hayır** — yalnızca "AudioB2B" metin |
| Dashboard (oturum sonrası) | **Evet** — signed URL üretilerek gösteriliyor |
| Mobil uygulama (`/api/mobile/last-played`) | **Evet** — oturum gerektiriyor |

**Sonuç:** Logolar yalnızca oturum açmış kullanıcılara gösteriliyor. `/api/logos/[...key]`'e auth eklenmesi (Bulgu-2 düzeltmesi) hiçbir unauthenticated akışı bozmaz.
