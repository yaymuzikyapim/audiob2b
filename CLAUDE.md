@AGENTS.md

## Veritabanı Migration Kuralı — RLS

**Yeni tablo ekleyen her migration `ENABLE ROW LEVEL SECURITY` içerir.**
Migration SQL'inin sonuna her yeni tablo için şu satır eklenir:
```sql
ALTER TABLE "TablAdı" ENABLE ROW LEVEL SECURITY;
```

## Veritabanı Migration Kuralı

Schema değişikliği yapıldığında deployment sırası:

1. **Önce migration**: `prisma migrate deploy` komutunu local'den çalıştır (DIRECT_URL ile, port 5432)
2. **Sonra kod deploy**: Vercel'e push et

`prisma migrate deploy` Vercel build'inde YOK — kasıtlı olarak kaldırıldı (Supabase pooler port 6543 üzerinde timeout yapıyordu).

## Prisma Config

- `DATABASE_URL` → Supabase pooler (port 6543) — uygulama bağlantısı
- `DIRECT_URL` → Supabase direct (port 5432) — migration'lar için

Her iki değişken de Vercel Environment Variables'a eklenmiş olmalı.

## Cron Güvenliği

`/api/cron/cleanup` route'u `Authorization: Bearer <CRON_SECRET>` başlığı ister.
`CRON_SECRET` değişkenini Vercel Environment Variables'a eklemeyi unutma (bir kez ayarla).
Vercel, kendi cron job'larını bu başlıkla otomatik olarak çağırır.

## Push Öncesi Kontrol Listesi

Push yapmadan önce her iki koşul sağlanmalı:

1. **`npm run build` yerelde temiz olmalı** — Vercel'de build'i kıran dosyalar (import edilip commit edilmemiş bileşenler vb.) yerelde de hata verir.
2. **`git status` temiz olmalı** — takip edilmeyen (untracked) dosya bırakılmamalı; her dosya ya commit edilmeli, ya silinmeli, ya da `.gitignore`'a eklenmeli.

**`npx vercel --prod` doğrudan çalıştırılmaz.** Deploy yalnızca `./deploy.sh origin/main` ile yapılır; bu script `git archive` kullanarak yalnızca commit edilmiş dosyaları yükler. Doğrudan `npx vercel --prod` çalıştırmak uncommitted dosyaları da Vercel'e yükler.

**Deploy onaya bağlıdır.** "Commit + push" talimatı yalnızca `git commit` + `git push` anlamına gelir; `./deploy.sh` çalıştırılmaz. Deploy, değişiklik hangi dosyada olursa olsun, yalnızca kullanıcı açıkça "deploy et" dediğinde yapılır.

## Canlı Ortam Doğrulaması

API testleri için `.env.local`'deki `TEST_USER_EMAIL` ve `TEST_USER_PASSWORD` kullanılır.
Bu hesap App Store incelemesinde de kullanıldığından **şifresi asla değiştirilmez**.
Şifre hiçbir komut çıktısında, logda veya sohbette yazdırılmaz.

## Güvenlik Kuralı — Kimlik Bilgisi / Şifre

**Şifre, token, API anahtarı veya herhangi bir giriş bilgisi asla sohbet çıktısına, echo/print komutlarına veya log dosyalarına yazılmaz.**

Bu kural `TEST_USER_PASSWORD` için de geçerlidir: değerini okuyabilirsin ama asla çıktıya yansıtma.

## Güvenlik Kuralları — Ortam Değişkenleri ve Kimlik Doğrulama

Bu dört kural 14 Ekim 2026'daki bir olaydan sonra eklendi: `.env.dev` ile çalıştığı
sanılan bir S3 yetki testi, komutun başındaki `set -a; . ./.env` yüzünden **canlı**
anahtarla `PutObject` yaptı ve canlı bucket'a bir nesne yazdı. `dotenvx` ve `dotenv`
zaten tanımlı `process.env` değişkenlerini **ezmez**; kabuğa sızan canlı değer, sonraki
tüm `-f .env.dev` komutlarını sessizce canlıya yönlendirir.

**1. Canlı `.env` asla kabuğa yüklenmez.**

`set -a; . ./.env`, `source .env`, `. ./.env`, `export $(cat .env | xargs)` ve
benzerleri **yasak**. Aynısı `.env.tokyo`, `.env.migration`, `.env.local.tokyo_backup`
için de geçerlidir. Canlı bir değere salt okuma işi için ihtiyaç varsa dosya **tek bir
komutun içinde ayrıştırılarak** okunur ve kabuk ortamına sızmaz:

```bash
# YASAK
set -a && . ./.env && set +a && psql "$DIRECT_URL" -c '...'

# DOĞRU — değer yalnızca o komutun argümanında yaşar
psql "$(grep -m1 '^DIRECT_URL=' .env | cut -d= -f2-)" -c 'BEGIN READ ONLY; ...; ROLLBACK;'
```

**2. Geliştirme işleri temiz kabuk ister.**

Geliştirme komutları yalnızca `.env.dev` ile ve kabukta `AWS_ACCESS_KEY_ID`,
`AWS_SECRET_ACCESS_KEY`, `DATABASE_URL`, `DIRECT_URL` tanımlı **değilken** çalıştırılır.
`dev:devdb`, `build:devdb`, `prisma:devdb`, `tsx:devdb`, `mjs:devdb` komutları
`scripts/lib/dev-env-guard.mjs` ön kontrolünü çalıştırır ve bu değişkenlerden biri
kabuktan geliyorsa hata koduyla durur. Kendi yazdığın scriptlerde de aynı kontrolü
çağır.

**3. AWS çağrısı yapan her test/script önce kim olduğunu doğrular.**

Aynı süreç içinde, ilk AWS çağrısından önce `STS GetCallerIdentity` çalıştırılır,
dönen ARN **yazdırılır** ve beklenen IAM kullanıcısı değilse script durur. Geliştirme
için beklenen: `arn:aws:iam::989208155263:user/audiob2b-dev-readonly`. Canlı:
`arn:aws:iam::989208155263:user/audiob2b-s3-user`. Anahtar değerleri yazdırılmaz,
yalnızca ARN.

**4. DB işi yapan her script hedefini yazdırır.**

Aynı süreç içinde bağlandığı hedef yazdırılır: yerel için `localhost:5433`, canlı için
proje ref'inin **yalnızca son 5 karakteri** (`…hoxkr`). Bağlantı dizesi, kullanıcı adı
ve şifre yazdırılmaz. `scripts/lib/prod-guard.mjs` canlı ref'i görürse `ALLOW_PROD=1`
olmadan süreci durdurur.

## Canlı DB'de Kullanıcı Oluşturma Yasağı

**Canlı veritabanında hiçbir koşulda kullanıcı oluşturulmaz; özellikle SUPER_ADMIN veya COMPANY_ADMIN rolüyle.**

- JWT/oturum anahtarı (AUTH_SECRET, JWT_SECRET vb.) elle üretilmez, curl veya script ile imzalanmaz.
- Giriş gerektiren UI testi (ekran görüntüsü dahil) gerekiyorsa **dur ve kullanıcıdan iste**; kullanıcı kendisi giriş yapıp ekran görüntüsü verir.
- "Hemen sileceğim" gerekçesi bu yasağı kaldırmaz — canlı DB'ye yazma eylemi gerçekleşmiş olur.

## Deneme Şirketleri Kısıtlaması

**review-company-001 ve TRIAL türündeki şirketler gerçek deneme kullanıcıları içerir: bu şirketlerde test yapılmaz, devre dışı bırakılmaz, kullanıcı eklenip çıkarılmaz. Testler için ayrı QA şirketi kullanılır.**

review-company-001'deki şu hesaplara şimdilik dokunma (kullanıcı kararı, 5 Ekim 2026):
- audiob2b.com.tr EMPLOYEE: App Store inceleme hesabı — şirket, rol, veri değiştirilmez
- iyzico.com EMPLOYEE: gerçek potansiyel müşteri — taşıma planı belirsiz
- ~49 kurumsal alan adlı EMPLOYEE (tümü giriş yapmamış): şimdilik olduğu gibi kalır

## DB Bölgesi

**DB bölgesi: eu-central-1 (Frankfurt)** — 12 Ekim 2026'da Tokyo'dan (ap-northeast-1) taşındı.
Bölge iddiaları her zaman Supabase panelinden doğrulanır, env'deki hostname'den çıkarım yapılmaz.

S3 ses/görsel bucket: `audiob2b-audio-files` — bölge `eu-central-1` (Frankfurt).

## Commit Kapsam Kuralı

**Bir commit'e sadece o işle ilgili dosyalar girer. İlgisiz veya commit edilmemiş kullanıcı dosyalarını commit'e ekleme; emin değilsen sor.**

## QA Admin Hesabı

Admin paneli kontrolleri QA_ADMIN_* hesabıyla yapılır (.env.local: QA_ADMIN_EMAIL / QA_ADMIN_PASSWORD).
Şirket: AudioB2B QA (id: cmbqr6l9nxbmjh8kztutjmmds) — COMPANY_ADMIN rolü.
Bu şifre rastgele üretilmiştir; gerektiğinde DB'de bcryptjs ile yenilenebilir.

## Katalog Verisi — Canlı DB'de Değiştirme Yasağı

**Book, Category ve PackageBook tabloları tüm şirketler arasında ortaktır.**
Bir kitabın kategorisini değiştirmek, yeni kategori oluşturmak veya Book kaydı eklemek
Demo paketini paylaşan diğer şirketleri (TPAO, review-company-001 dahil) anında etkiler.

**Kural:**
- Canlı DB'de katalog verisi (Book, Category, PackageBook) değiştiren test yapılmaz.
- Yalnızca şunlara izin verilir:
  - Salt okuma sorguları (SELECT)
  - QA şirketine özgü kayıtlar — ancak o kayıt başka şirketlerin paketinde YOK ise
    (örn. PackageBook yalnızca QA paketine bağlıysa, book kaydı global olsa da)
- Kitap kategorisi değiştirme, kategori oluşturma/silme: canlı DB'de asla test için yapılmaz.
- Bu ihtiyaç için yerel veritabanı veya staging ortamı kullanılır.

## Harici Test Servisi Davetleri

mail-tester.com, Mailgun testleri veya benzeri harici servisler için yapılan davetler:
- **Her zaman "Çalışan" (EMPLOYEE) rolüyle** gönderilir — yönetici rolü asla kullanılmaz.
- Test tamamlanır tamamlanmaz davet tokeni `inviteToken.deleteMany` ile silinir.
- Silme sonrası `/api/invite/accept` ile token'ın `"geçersiz veya süresi dolmuş"` döndürdüğü doğrulanır.
