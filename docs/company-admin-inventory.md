# AudioB2B — Müşteri Admin (COMPANY_ADMIN) Panel Envanter Raporu

> **Tarih:** 2026-10-04  
> **Amaç:** `/dashboard/team` ve ilgili API route'larının mevcut durumu; yeni tasarım için veri hazırlığı.  
> **Yöntem:** Salt okuma kod analizi — canlı veriye dokunulmadı.

---

## 1. Müşteri Admin Paneli Nedir?

`COMPANY_ADMIN` rolündeki kullanıcılar, kendi şirketlerinin üyelerini yönetmek için `/dashboard/team` sayfasını kullanır. Bu sayfa `/dashboard/layout.tsx` koruması altında çalışır; `SUPER_ADMIN` buraya yönlendirilmez.

---

## 2. Mevcut Kullanıcı Arayüzü

### `/dashboard/team` — Takım Yönetimi Sayfası
**Dosya:** `src/app/dashboard/team/page.tsx`

Sayfada COMPANY_ADMIN'in görebildiği veriler:

| Bölüm | İçerik | Mevcut |
|-------|--------|--------|
| Koltuk kullanımı | Kullanılan / toplam koltuk | Evet |
| Üye listesi | Ad, e-posta, rol, aktif/pasif durumu | Evet |
| Bekleyen davetler | E-posta, rol, son kullanma tarihi | Evet |
| Üye eylemleri | Aktif/Pasif aç-kapat, Şirketten çıkar | Evet |
| Davet | Tek davet, toplu davet | Evet |

**Bileşenler:**
- `src/components/dashboard/MemberActions.tsx` — üye aktif/pasif + çıkarma işlemleri
- `src/components/dashboard/InviteButton.tsx` — davet gönderme formu

---

## 3. API Route Envanteri

### `/api/dashboard/team` (GET)
**Dosya:** `src/app/api/dashboard/team/route.ts`

**Auth:** `getSession()` + `COMPANY_ADMIN` role kontrolü  
**Veri izolasyonu:** `session.companyId` JWT'den alınarak `where: { companyId }` filtresi uygulanıyor ✓

**Döndürülen veriler:**

```typescript
{
  users: [
    {
      id, name, email, role,          // kullanıcı kimlik bilgileri
      isActive,                         // aktif mi
      lastLoginAt,                      // son giriş (nullable)
      createdAt,                        // kayıt tarihi
    }
  ],
  invites: [
    {
      id, email, role,
      expiresAt,                        // son kullanma tarihi
      usedAt,                           // kullanılmış mı
    }
  ],
  company: {
    maxSeats,                           // maksimum koltuk sayısı
  }
}
```

**Eksik alanlar (DB şemasında yok):**
- `department` / `title` → User modelinde tanımlı değil
- `employeeId` / personel numarası → User modelinde yok
- Dinleme istatistikleri → Bu route döndürmüyor; `PlayHistory` ayrı sorgu gerektirir

---

### `/api/dashboard/member` (PATCH)
**Dosya:** `src/app/api/dashboard/member/route.ts`

**Auth:** COMPANY_ADMIN + `target.companyId === session.companyId` çapraz-şirket koruması ✓

| Eylem | Ne Yapar | DB Etkisi |
|-------|----------|-----------|
| `toggle` | Aktif/pasif durumu değiştir | `user.update({ isActive })` |
| `remove` | Şirketten çıkar | `user.update({ companyId: null, isActive: false })` (soft remove) |

**Dikkat:** `remove` işlemi kullanıcıyı silmiyor; `companyId` null yapılıp pasife alınıyor.

---

### `/api/dashboard/invite` (POST)
**Dosya:** `src/app/api/dashboard/invite/route.ts`

**Auth:** COMPANY_ADMIN  
**Kontroller:**
- Rol: sadece `EMPLOYEE` veya `COMPANY_ADMIN` (SUPER_ADMIN daveti engellenmiş) ✓
- Koltuk kotası: `maxSeats` kontrolü ✓
- Tekrar kontrolü: aynı e-posta için bekleyen davet varsa hata döner ✓

**E-posta:** Davet e-postası Resend ile gönderiliyor.

---

### `/api/dashboard/invite/bulk` (POST)
**Dosya:** `src/app/api/dashboard/invite/bulk/route.ts`

**Auth:** COMPANY_ADMIN  
**Kısıtlamalar:**
- Koltuk kotası başta kontrol ediliyor ancak eş zamanlı çoklu istek durumunda TOCTOU açığı var (doğrulanmalı)
- Her davet için ayrı DB sorgusu (N+1 döngüsü); büyük listeler için yavaş olabilir

---

## 4. Veri Modeli Özeti (COMPANY_ADMIN için ilgili alanlar)

### User (Kullanıcı)
| Alan | Tip | Mevcut | Not |
|------|-----|--------|-----|
| id | String | Evet | |
| email | String (unique) | Evet | |
| name | String? | Evet | |
| role | UserRole | Evet | EMPLOYEE / COMPANY_ADMIN |
| isActive | Boolean | Evet | |
| lastLoginAt | DateTime? | Evet | |
| companyId | String? | Evet | |
| createdAt | DateTime | Evet | |
| department | — | **Hayır** | Şemada yok |
| title | — | **Hayır** | Şemada yok |
| employeeId | — | **Hayır** | Şemada yok |
| pushToken | String? | Evet | Push bildirim token'ı (UI'da gösterilmiyor) |

### Company (Şirket)
| Alan | Mevcut | Not |
|------|--------|-----|
| name | Evet | |
| logoUrl | Evet | S3'te saklanıyor, signed URL üretiliyor |
| brandColor | Evet | CSS renk değeri |
| maxSeats | Evet | Koltuk limiti |
| endDate | Evet | Lisans bitiş tarihi |
| licenseType | Evet | PER_SEAT / FLEX_POOL |
| packageId | Evet | Hangi içerik paketi atanmış |
| isActive | Evet | |
| notes | Evet | İç notlar (SUPER_ADMIN görür) |

### InviteToken (Davet)
| Alan | Mevcut |
|------|--------|
| email | Evet |
| role | Evet |
| expiresAt | Evet |
| usedAt | Evet (null = kullanılmamış) |

---

## 5. Raporlama Verileri — Mevcut Durum

COMPANY_ADMIN'in üyeleri hakkında raporlama yapabilmesi için hangi verilerin mevcut olduğu:

| Rapor Türü | Veri Kaynağı | Mevcut | API Var mı |
|------------|--------------|--------|-----------|
| Üye listesi (ad, e-posta, rol, durum) | `User` | Evet | `/api/dashboard/team` |
| Son giriş zamanı | `User.lastLoginAt` | Evet | `/api/dashboard/team` |
| Koltuk kullanımı | `User` count + `Company.maxSeats` | Evet | `/api/dashboard/team` |
| Toplam dinleme süresi (gerçek) | `PlayHistory` (v2, `listenedSec`) | Evet (DB'de) | **Yok** — yeni endpoint gerekir |
| Dinleme süresi kullanıcı bazlı | `PlayHistory GROUP BY userId` | Evet (DB'de) | **Yok** |
| En çok dinlenen kitap (şirkete göre) | `PlayHistory GROUP BY bookId` | Evet (DB'de) | `/api/admin/reports/listening` (sadece SUPER_ADMIN) |
| Mevcut pozisyon / kitap | `PlayerState` | Evet (DB'de) | **Yok** (doğrudan şirket bazlı query yok) |
| Bekleyen davetler | `InviteToken` | Evet | `/api/dashboard/team` |
| Üye kayıt tarihi | `User.createdAt` | Evet | **Yok** (team route dönmüyor) |
| Departman / Ünvan | — | **Hayır** | — |

**Sonuç:** Temel üye yönetimi verileri mevcut. Gerçek dinleme istatistikleri için `PlayHistory` üzerinden şirkete özgü yeni bir API endpoint gerekiyor.

---

## 6. Raporlama API'si Eklemek için Gerekli Sorgu

Eğer COMPANY_ADMIN için dinleme raporu sayfası eklenecekse, gerekli sorgu şöyle görünür:

```typescript
// Şirkete ait tüm kullanıcıların dinleme istatistikleri (taslak)
prisma.playHistory.groupBy({
  by: ["userId"],
  where: {
    user: { companyId: session.companyId },
    clientVersion: 2,
    playedAt: { gte: startDate, lte: endDate },
  },
  _sum: { listenedSec: true },
  _count: { bookId: true },
});
```

Veri izolasyonu: `user.companyId` üzerinden filtreleme gerekiyor; `userId` listesi direkt JWT'den türetilmemeli.

---

## 7. Eksik Özellikler (Tasarım Hazırlığı)

Mevcut panelde olmayan ancak talep görebilecek özellikler:

| Özellik | Gereklilik | Yorum |
|---------|-----------|-------|
| Üye bazlı dinleme raporu | Orta | DB verisi var, API yok |
| Departman/ünvan alanları | Yüksek (varsa) | User şemasına alan eklenmeli |
| Üye import (CSV) | Orta | Bulk invite var ama direkt import yok |
| Davet yeniden gönder | Düşük | Mevcut endpoint var, UI yok |
| Koltuk limiti yaklaşınca uyarı | Düşük | Veri var, bildirim mekanizması yok |
| Üye arama/filtreleme | Orta | Team route'ta mevcut değil |
| Sayfa (pagination) | Düşük | Büyük şirketler için gerekli |
| Raporları dışa aktar (CSV/Excel) | Düşük | Admin panelinde var, dashboard'da yok |

---

## 8. Bileşen Yapısı

```
src/app/dashboard/team/page.tsx          — Takım yönetim sayfası (Server Component)
  └─ src/components/dashboard/
       ├─ InviteButton.tsx               — Davet formu (Client Component)
       └─ MemberActions.tsx             — Üye aktif/pasif + çıkarma (Client Component)
```

---

## 9. Güvenlik Notları (Bu Panel İçin)

- **Veri izolasyonu güvenli:** `session.companyId` JWT'den alınıp DB filtresinde kullanılıyor; başka şirketin verisi dönemez.
- **Rol değişim gecikmesi:** COMPANY_ADMIN rolü JWT'de saklandığından DB'de rol değiştirilse de 30 gün boyunca etki etmeyebilir (bkz. ana audit raporu Bulgu-4).
- **COMPANY_ADMIN SUPER_ADMIN davet edemiyor:** Kontrol mevcut ✓
- **Çapraz-şirket üye işlemi engellendi:** `target.companyId === session.companyId` kontrolü var ✓

---

*Bu envanter salt okunur kod analizine dayanmaktadır. Canlı veri, DB içeriği veya üretim ortamına dokunulmamıştır.*

---

## EK G — Arayüz Altyapısı

### Framework ve Dil

| Bağımlılık | Sürüm |
|-----------|-------|
| Next.js | 16.3.0 (App Router) |
| React / React DOM | 19.2.8 |
| TypeScript | package.json'da explicit yok; `tsconfig.json` mevcut |
| Tailwind CSS | ^4 |
| Prisma ORM | 7.9.1 |

### Bileşen Kütüphaneleri

**Yok.** shadcn/ui, Radix UI, Headless UI veya benzeri hazır bileşen kütüphanesi kullanılmıyor. Tüm arayüz öğeleri (modal, form, tablo, dropdown vb.) elle Tailwind CSS ile yazılmış.

### İkon Seti

Kaynak kodda Lucide, Heroicons, React Icons veya benzeri bir ikon kütüphanesi import'u bulunamadı. İkonlar muhtemelen inline SVG veya Unicode/emoji karakterlerle sağlanıyor.

### Grafik / Chart Kütüphanesi

**Yok.** Recharts, Chart.js, D3, Victory veya benzeri grafik kütüphanesi yok. Dinleme raporları düz HTML tablolarıyla gösteriliyor; görsel grafik yok.

### Form / Validasyon

- `zod` ^4.4.3 `package.json`'da bağımlılık olarak var, ancak API route handler'larında bulunmadı — muhtemelen kullanılmıyor veya ileride entegre edilmek üzere eklendi.
- Form doğrulama: tüm handler'larda manuel `if (!field)` kontrolleri.
- Form state: `useState` ile local state; form kütüphanesi (react-hook-form vb.) yok.

### Ortak Layout ve Bileşenler

**Admin paneli (`/admin`):**
- `src/app/admin/layout.tsx` — AdminSidebar dahil, SUPER_ADMIN kontrolü
- `src/components/admin/AdminSidebar.tsx` — navigasyon kenar çubuğu
- Modal: her bileşen kendi overlay'ini manuel yazıyor (`fixed inset-0 bg-black/60`)
- Tablo: inline Tailwind ile her sayfada tekrardan yazılmış, ortak tablo bileşeni yok
- Toast/bildirim: bulunamadı (başarı/hata durumları state ile satır içi gösteriliyor)

**Dashboard (`/dashboard`):**
- `src/app/dashboard/layout.tsx` — DashboardSidebar dahil, şirket brandColor/logoUrl geçiyor
- `src/components/dashboard/DashboardSidebar.tsx` — logo + brandColor uygulayan kenar çubuğu
- `src/components/dashboard/AudioPlayer.tsx` — tam özellikli ses oynatıcı; brandColor uygulayan
- Ortak tablo/liste bileşeni yok

### brandColor ve logoUrl — Dashboard'da Kullanım

| Konum | Kullanım |
|-------|---------|
| `DashboardSidebar` | `backgroundColor: brandColor` (inline style) |
| `AudioPlayer` | Renk vurgusu için CSS değişkeni olarak uygulanıyor |
| `dashboard/page.tsx` | CSS `--brand` değişkeni olarak `style` attribute'u ile |
| `dashboard/library/page.tsx` | CSS `--brand` değişkeni |
| `dashboard/listen/[bookId]/page.tsx` | AudioPlayer'a prop olarak geçiliyor |
| `dashboard/layout.tsx` | DashboardSidebar'a prop olarak geçiliyor |

**Sonuç:** brandColor ve logo müşteri panelinde aktif olarak kullanılıyor; yeni tasarımda bu değerlerin CSS'e aktarım mekanizması korunmalı.

### Tarih ve Sayı Biçimlendirme

- **Tüm tarihler:** `Intl.DateTimeFormat("tr-TR", {...})` — harici kütüphane yok.
- **Süre (saniye):** Inline `Math.floor(sn/3600)` vb. hesaplama; ortak `formatDuration` utility'i bulunamadı.
- **Locale:** Sabit `tr-TR`; çoklu dil desteği yok.

### Erişilebilirlik Durumu

- `dashboard/` bileşenlerinde toplam **3** `aria-*` / `role` / `<label>` kullanımı
- `admin/` bileşenlerinde toplam **31** `aria-*` / `role` / `<label>` kullanımı
- Interaktif öğelerin büyük çoğunluğu `<div onClick>` veya `<button>` olarak yazılmış; klavye navigasyonu ve screen reader desteği tutarsız.
- Form alanlarında `<label>` kullanımı admin panelinde kısmen mevcut, dashboard'da çok sınırlı.

---

## EK H — Metrik Sınıflandırması

### PlayHistory Alanları (Kısa Özet)

| Alan | Açıklama |
|------|---------|
| `listenedSec` | O oturumda **gerçekten** dinlenen süre (delta, saniye) — doğru dinleme metriği |
| `contentSec` | Dinlenen içerik süresi (hız × listenedSec) |
| `completedPct` | Bölüm tamamlanma yüzdesi (0–100) |
| `clientVersion` | `1` = eski (pozisyon tabanlı, güvenilmez); `2` = yeni (delta tabanlı) |
| `playedAt` | İstemci tarafından gönderilen dinleme zamanı (±7 gün / +5 dk pencere filtreli) |
| `clientId` | UUID; çift kayıt önleme (upsert key) |

**clientVersion 1 vs 2:** v1 kayıtlar `positionSec` bilgisini depolar ama dinleme süresi doğru değildir (ileri-sarma sayılır). v2 kayıtlar sadece gerçek dinlenen süreyi delta olarak gönderir. Raporlar yalnızca v2 kayıtları işlemeli; v1 `listenedSec` sıfır veya güvenilmez değer içerebilir.

### Hazır / Hesaplanabilir / Şema Değişikliği Gerekir

| Metrik | Durum | Notlar |
|--------|-------|--------|
| Aktif kullanıcı (günlük) | **Hesaplanabilir** | `PlayHistory.playedAt` GROUP BY userId, son 1 gün |
| Aktif kullanıcı (haftalık/aylık) | **Hesaplanabilir** | Aynı; tarih penceresi değişiyor |
| Kitap tamamlanma oranı | **Hazır** | `PlayHistory.completedPct` (v2); ortalama veya "en yüksek" seçimi yapılabilir |
| Kullanıcı başına dinleme süresi | **Hesaplanabilir** | `SUM(listenedSec)` GROUP BY userId WHERE clientVersion=2 |
| En çok dinlenen kitaplar | **Hesaplanabilir** | `SUM(listenedSec)` GROUP BY bookId WHERE clientVersion=2 — admin'de mevcut, dashboard'da API yok |
| Hiç giriş yapmamış kullanıcılar | **Hazır** | `User.lastLoginAt IS NULL` filtresi |
| Uzun süredir dinlemeyen kullanıcılar | **Hesaplanabilir** | `MAX(PlayHistory.playedAt)` GROUP BY userId; eşik tarihle karşılaştır |
| Davet kabul oranı | **Hazır** | `InviteToken` WHERE `usedAt IS NOT NULL` / total count; şirket bazlı filtrelenebilir |

**Şema değişikliği gerektiren metrikler:** Departman/ünvan bazlı raporlama (`User.department`, `User.title` alanları şemada yok), kol içi etkinlik takibi, oturum süresi (session başlangıç/bitiş yok).

---

## EK I — "AudioB2B Demo" Şirketinde COMPANY_ADMIN

`prisma/create-demo-users.ts` script'i incelendi: Demo şirketine eklenen tüm kullanıcılar `role: "EMPLOYEE"` ile oluşturuluyor. Script'te COMPANY_ADMIN rolünde kullanıcı tanımı **bulunamadı**.

Demo şirketine COMPANY_ADMIN atanmışsa bu ya başka bir script ile ya da admin panelinden doğrudan yapılmış olabilir — **canlı DB doğrulanmalıdır.**
