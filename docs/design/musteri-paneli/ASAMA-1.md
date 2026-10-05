# Müşteri Admin Paneli — Aşama 1 Uygulama Şartnamesi

Bu dosya her adım başında ve her oturum sıkıştırmasından sonra yeniden okunur.
Taslak HTML'den veya bu dosyadan ayrılmadan önce kullanıcıya sorulur.

---

## Genel Mimari

- **Route grubu:** `src/app/(company-admin)/dashboard/admin/` — bağımsız layout ağacı
- **Layout:** `AdminShell.tsx` — `[data-theme="company-admin"]` kök wrapper
  - Desktop (≥768px): 260px sabit sol sidebar
  - Mobil (<768px): 56px üst bar + hamburger → slide-in drawer
- **Renk kapsamı:** shadcn token'ları ve IBM Plex Sans yalnızca `[data-theme="company-admin"]` içinde, global `body` etkilenmez
- **Font:** IBM Plex Sans (Google Fonts + TTF `src/assets/fonts/` — PDF için)
- **Kimlik doğrulama:** `requireUser({ roles: ["COMPANY_ADMIN"] })` — tüm admin API route'larında
- **companyId:** Her zaman DB'den (`user.companyId`), URL'den asla

---

## Adım 1 — Altyapı (Tamamlandı)

- `(company-admin)` route grubu
- shadcn/ui + Tailwind 4 CSS-first
- IBM Plex Sans TTF fontları
- `lib/metrics.ts` + `lib/metrics.test.ts`
- `lib/admin-guards.ts`
- Prisma: `PlayHistory.chapterId String?` + migration 20261005000002

---

## Adım 2 — Genel Bakış (`/dashboard/admin`)

### Taslak
`docs/design/musteri-paneli/01-genel-bakis.html`

### Başlık
- `h1`: "Genel Bakış"
- Alt satır: dönem aralığı, örn. "5 Eyl – 5 Eki 2026"
- Dönem seçici: **Son 30 gün** / Bu çeyrek / Bu yıl

### Lisans Kullanımı
- `occupiedSeats + pendingInvites / maxSeats` çubuğu
- Normal durum: `{occupied} / {max} kullanıcı · {pending} davet bekliyor · {empty} boş lisans`
- **Aşım durumu** (occupied + pending > maxSeats): çubuk uyarı rengi (`#DC2626`), metin
  `"Lisans sınırı aşıldı: {occupied+pending} / {max}"`; "boş lisans" yazılmaz
- Sağda: Lisans bitişi tarihi

### KPI Kartları (4 adet, taslaktaki sırayla)
| Kart | Değer | Alt etiket |
|------|-------|------------|
| Aktif dinleyici (30 gün) | `countActiveListeners` | delta: önceki döneme göre % |
| Toplam dinleme | `sumListenedSec` → "X sa Y dk" | delta % |
| Dinleyici başına | toplam / aktif → "X sa Y dk" | delta % |
| Tamamlanan kitap | `countCompletedBooks` | delta % |

**Delta hesabı:** aynı uzunlukta önceki dönem ile kıyasla; artan = yeşil (`#1B7F4C`), azalan = turuncu (`#A3410F`)

**"Aktif / Koltuk" kartı KALDIRILDI.**

### Haftalık Trend Grafiği
- 12 hafta, Pazartesi başlangıçlı (Europe/Istanbul)
- `AreaChart` (recharts) — `type="monotone"`, LinearGradient dolgu
- Y ekseni: değerler küçükse dakika veya ondalıklı; tüm sütunlar 0 ise bile eksende gerçek ölçek
- X ekseni: 6–7 hafta etiketi (her iki haftada bir)

### Katılım Hunisi (4 adım)
```
Davet gönderildi    = max(invitesSentRaw, invitesAccepted)
Davet kabul edildi  = şirketteki toplam aktif kullanıcı sayısı (davetsiz eklenenler dahil)
En az bir kez dinledi = min(everPlayedUsers, invitesAccepted)
Aktif (dönemde)    = countActiveListeners(from, to)
```
**Monoton kural:** her adım ≤ bir önceki adım.

Uyarı kutusu (turuncu): `"X kişi davetini kabul etti ama hiç dinlemedi"`
Bağlantı: **"Hatırlatma gönder →"** → `/dashboard/admin/users?tab=never`

### En Çok Dinlenen Kitaplar
- Top 5, göreli bar, dinleyici sayısı + saat
- **"Tüm rapor →"** → `/dashboard/admin/reports` (Adım 4 tamamlanınca aktif)

### Alt Not
`"Dinleme süreleri {firstV2Date} itibarıyla gerçek dinlenen süreye göre hesaplanır; ileri sarılan bölümler sayılmaz."`

---

## Adım 3 — Kullanıcılar (`/dashboard/admin/users`)

### Taslak
`docs/design/musteri-paneli/02-kullanicilar.html`

### Başlık
- `h1`: "Kullanıcılar"
- Alt satır: `{occupied} / {max} lisans kullanımda · {empty} boş`
- Butonlar: "CSV ile toplu davet" + **"Kullanıcı davet et"**

### Sekmeler (5 adet — taslaktaki sıra)
| Sekme | Filtre |
|-------|--------|
| Tümü | tüm kullanıcılar (aktif + pasif) |
| Aktif | `isActive=true` |
| Pasif | `isActive=false` |
| Davet bekleyen | `InviteToken` — `usedAt=null`, süresi dolmamış |
| Hiç dinlemeyen | `isActive=true` VE `v2 PlayHistory kaydı hiç yok` |

**"Yöneticiler" sekmesi yok** — rol filtresi kullanılır.

"Hatırlatma gönder →" Genel Bakış'tan bu sekmeyi açar: `/dashboard/admin/users?tab=never`

### Filtre Satırı
- **Arama:** ad veya e-posta (debounce 300ms)
- **Rol:** Tümü / Çalışan / Yönetici
- **Son dinleme:** Herhangi bir zaman / Son 7 gün / 30 günden uzun süredir yok / Hiç dinlemedi

### Toplu İşlem Çubuğu (seçili satır varsa)
- "Hatırlatma gönder" (e-posta davet)
- "Pasife al"
- "Seçimi temizle"

### Tablo Sütunları (taslaktaki sıra)
| # | Sütun | Açıklama |
|---|-------|----------|
| 1 | ☐ | Checkbox |
| 2 | Kullanıcı | Avatar (baş harfler) + Ad + E-posta |
| 3 | Rol | Çalışan / Yönetici |
| 4 | Durum | Aktif (yeşil) / Pasif (gri) / Davet bekliyor (turuncu) |
| 5 | Son dinleme | Son v2 PlayHistory tarihi, görece format |
| 6 | Dinleme (30 gün) | listenedSec toplamı, sağa hizalı |
| 7 | ⋯ | Satır menüsü |

### Satır Menüsü (3 nokta)
- Rol değiştir (Yönetici yap / Çalışan yap)
- Pasife al / Etkinleştir
- **Şirketten çıkar** (companyId=null, isActive=false; PlayHistory ve PlayerState korunur)
- **DELETE yok** — veri korunur

### Davet Bekleniyor Sekmesi Ek Özellik
- "Daveti yeniden gönder" butonu her satırda

### Sayfalama
- Sunucu taraflı, 25/sayfa

### Korumalar
- **Kendini pasife alamaz:** `409 "Kendinizi pasife alamazsınız."`
- **Son yönetici pasife alma:** `409 "Son şirket yöneticisi pasife alınamaz."` (`lib/admin-guards.ts`)
- **Son yönetici rol düşürme:** `409 "Son şirket yöneticisinin rolü değiştirilemez."`
- **Son yönetici çıkarma:** aynı koruma

---

## Adım 4 — Raporlar (`/dashboard/admin/reports`) [Beklemede]

Taslak: `docs/design/musteri-paneli/03-raporlar.html`

---

## Adım 5 — Dışa Aktarma [Beklemede]

- Excel: `exceljs` → `/api/dashboard/admin/reports/excel`
- PDF: `@react-pdf/renderer`, `runtime="nodejs"`, TTF fontlar, SVG grafikler

---

## Metrik Tanımları

### countCompletedBooks
Bir (userId, bookId) çifti tamamlanmış sayılır ancak **kitabın TÜM bölümleri**
için `max(completedPct) ≥ 90` koşulu sağlanıyorsa.

```
chaptersByBook: bookId → Set<chapterId>  (Prisma Chapter tablosundan)
chapterId=null olan PlayHistory satırları göz ardı edilir (v1 uyumluluğu)
Yalnızca clientVersion=2 satırlar kullanılır
```

### PlayHistory.completedPct
- v2 kayıtlarda: **bölüm bazlı** — `pos / chapter.duration * 100`
- v1 uyumluluğu: `chapterId=null` → sayılmaz

### Huni Monoton Kuralı
`seats ≥ invitesSent ≥ invitesAccepted ≥ hasPlayedEver ≥ activeInPeriod`

---

## Push Politikası

**Push YOK** — Adım 4 (Raporlar) tamamlanana kadar.
Nedeni: "Tüm rapor →" ve "Hatırlatma gönder →" bağlantıları boşa çıkmamalı.
Tüm adımlar bitince birlikte push edilecek.

---

## Güvenlik Notları

- `TEST_USER_EMAIL=reviewer@audiob2b.com.tr` — App Store inceleme hesabı
- `TEST_USER_PASSWORD` asla log, çıktı veya sohbette yazdırılmaz
- Geçici admin hesapları iş bitince silinir (`tmp-admin-screenshot-*`)
