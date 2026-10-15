# Geliştirme veritabanı — yerel PostgreSQL 17

**Karar (Adım 0-B):** Geliştirme DB'si **yerel** PostgreSQL 17 kümesidir. Supabase'de ayrı
bir dev projesi açılmadı (Free plan 2 proje sınırı). Geri yükleme testi kümesi bu küme
**değildir**; o ayrı bir adımda `/tmp` altında, ayrı portta kurulacak.

## Künye

| | |
|---|---|
| Sürüm | PostgreSQL 17.11 (Homebrew, `postgresql@17`, **link edilmemiş**) |
| Araçlar | yalnızca tam yol: `/usr/local/opt/postgresql@17/bin/...` |
| Veri dizini | `~/pgdata/audiob2b-dev` |
| Port | **5433** (canlı araçların kullandığı 5432 ile çakışmaz) |
| Dinleme | `listen_addresses = 'localhost'` — yalnızca 127.0.0.1 ve ::1 |
| Veritabanı | `audiob2b_dev` |
| Rol | `postgres`, `trust` auth (yerel, şifre yok → `.env.dev` sır taşımaz) |
| Encoding | UTF8 · collate/ctype `en_US.UTF-8` · locale provider **ICU** (`en-US`) |
| Sunucu TZ | UTC (canlıyla aynı) |
| Log | `~/pgdata/audiob2b-dev/server.log` |

Encoding / collation / locale provider canlı Supabase ile **birebir aynı** seçildi:
canlı `UTF8 | en_US.UTF-8 | en_US.UTF-8 | i`.

## Ortam dosyaları (Adım 0-F)

| Dosya | İçerik | Kim okur |
|---|---|---|
| `.env` | **`.env.dev`'e sembolik bağ** | `next dev`, Prisma CLI, `ENV_FILE` verilmeyen scriptler |
| `.env.dev` | geliştirme — `localhost:5433`, S3 salt okuma anahtarı, `S3_DELETE_DISABLED=true` | `*:devdb` komutları |
| `.env.prod` | **canlı** — eski `.env` buraya taşındı (`chmod 600`) | yalnızca `*:prod` komutları |
| `.env.local` | yalnızca test hesabı bilgileri + `VERCEL_OIDC_TOKEN`, DB/AWS içermez | Next.js (`.env`'i ezer), test scriptleri |

Varsayılan **geliştirmedir**: `npm run dev` yerel 5433'e gider. Canlıya erişim her zaman
açık ve bilinçlidir:

```bash
ALLOW_PROD=1 npm run prisma:prod -- migrate status   # salt okuma
ALLOW_PROD=1 npm run backup:prod                     # pg_dump
ALLOW_PROD=1 npm run mjs:prod -- scripts/x.mjs
ALLOW_PROD=1 npm run tsx:prod -- scripts/x.ts
```

`scripts/lib/prod-komut.mjs` sırayla: kabuk sızıntısı kontrolü → `ALLOW_PROD=1` kontrolü →
hedefi yazdırma (`→ HEDEF: CANLI (…hoxkr) · env: .env.prod · TZ=UTC`) → `dotenvx -f .env.prod`.
`ALLOW_PROD` yoksa komut hiç başlamaz.

**Neden kopya değil sembolik bağ:** kopyada iki dosya zamanla birbirinden ayrışır ve
`.env.dev`'e eklenen bir değişken `.env`'de eksik kalır; ayrıca S3 anahtarı diskte iki
yere yazılmış olur. Bağda tek kaynak vardır, izinler hedeften (`chmod 600`) gelir ve
`.env.dev` silinirse bağ kırılır — araçlar **sessizce eski değerlerle değil, hatayla**
durur. Repoda ikisi de `.env*` kuralıyla yok sayılır.

`.env.prod` adı bilinçli: Next.js `.env.production` / `.env.production.local` dosyalarını
production build'de **otomatik yükler**; `.env.prod` o listede yoktur.

## Günlük kullanım

```bash
npm run devdb:start     # kümeyi başlat
npm run devdb:status    # pg_isready
npm run devdb:psql      # psql ile bağlan
npm run devdb:stop      # kümeyi durdur (-m fast)

npm run dev:devdb                        # Next.js'i .env.dev ile çalıştır
npm run prisma:devdb -- migrate deploy   # şemayı uygula
npm run prisma:devdb -- studio
npm run tsx:devdb -- prisma/<script>.ts  # TS scriptleri dev DB ile
```

### `LC_ALL` zorunlu

macOS'ta `pg_ctl start` komutu `LC_ALL` olmadan şu hatayla düşer:

```
FATAL: postmaster became multithreaded during startup
HINT:  Set the LC_ALL environment variable to a valid locale.
```

Bu yüzden `devdb:start` komutu `LC_ALL="en_US.UTF-8"` ile başlar. Elle başlatırken de
gerekir:

```bash
LC_ALL="en_US.UTF-8" /usr/local/opt/postgresql@17/bin/pg_ctl \
  -D ~/pgdata/audiob2b-dev -l ~/pgdata/audiob2b-dev/server.log -w start
```

Küme `brew services` ile **kayıtlı değil**; oturum açılışında kendiliğinden başlamaz.
Bu bilinçli: dev DB yalnızca üzerinde çalışılırken ayakta olsun.

## Kurulumun tekrarı (sıfırdan)

```bash
brew install postgresql@17          # LINK ETME
PG=/usr/local/opt/postgresql@17/bin

$PG/initdb -D ~/pgdata/audiob2b-dev -U postgres \
  --encoding=UTF8 --locale-provider=icu --icu-locale=en-US \
  --lc-collate=en_US.UTF-8 --lc-ctype=en_US.UTF-8 \
  --auth-local=trust --auth-host=trust

cat >> ~/pgdata/audiob2b-dev/postgresql.conf <<'CONF'
port = 5433
listen_addresses = 'localhost'
unix_socket_directories = '/tmp'
timezone = 'UTC'
log_timezone = 'UTC'
CONF

npm run devdb:start
LC_ALL="en_US.UTF-8" $PG/createdb -h localhost -p 5433 -U postgres audiob2b_dev
cp .env.dev.example .env.dev && chmod 600 .env.dev   # değerleri doldurun
npm run prisma:devdb -- migrate deploy
```

## Şema doğrulaması

Dev kümesi canlıyla karşılaştırıldığında (Adım 0-B, 14 Ekim 2026) **fark yok**:

| Ölçüt | Dev | Canlı |
|---|---|---|
| migration (`_prisma_migrations`) | 19 | 19 (liste birebir aynı) |
| tablo | 21 | 21 |
| kolon | 159 | 159 (tip/null/default dahil birebir) |
| primary key | 21 | 21 |
| foreign key | 22 | 22 |
| unique constraint | 0 | 0 |
| index | 41 | 41 |
| unique index | 35 | 35 |
| enum türü | 3 | 3 |
| RLS açık tablo | 21 | 21 |
| trigger / view / fonksiyon | 0 / 0 / 0 | 0 / 0 / 0 |

Tekrar doğrulamak için aynı sayım sorgusunu iki tarafta çalıştırıp `diff` alın. Canlı
tarafta **her zaman** `BEGIN READ ONLY; SET LOCAL statement_timeout='30s'; … ROLLBACK;`.

## Veri

| Kaynak | İçerik |
|---|---|
| **Katalog** (canlıdan salt okuma kopyası) | Category 20 · Series 37 · Package 2 · Book 1055 · Chapter 8867 · PackageBook 1046 — canlıyla birebir |
| **Sentetik** (`scripts/seed-dev.mjs`) | 4 şirket · 15 kullanıcı · ~370–400 dinleme kaydı · favori / oynatıcı durumu / yer imi |

**Canlı kişisel veri bu kümeye girmez** (K0). Kopyalanan altı katalog tablosunun
hiçbirinde `User` / `Company` gibi kişisel veri tablolarına FK yoktur — doğrulandı.
Kopyalanmayan tablolar: User, Company, PlayHistory, InviteToken, PasswordResetToken,
PasswordAuditLog, NotificationLog, DemoRequest, ProposalLink, ProposalLinkVisitor,
RateLimit, UserFavorite, PlayerState, Bookmark.

```bash
npm run katalog:devdb   # canlı katalog → dev (yalnızca 6 tablo, --data-only)
npm run seed:devdb      # sentetik şirket/kullanıcı/dinleme (tekrar çalıştırılabilir)
npm run devdb:reset     # şema sıfırla → migrate deploy → katalog → seed
```

Üçü de yalnızca `localhost:5433`'e yazar; `.env.dev` başka bir hedefi gösterirse durur.

### Sentetik şirketler ve senaryolar

| Şirket | Durum | Kütüphane çağrısı |
|---|---|---|
| QA Test A.Ş. | aktif, tam paket (Demo), 20 koltuk | HTTP 200 — 1003 kitap |
| Süresi Dolmuş Ltd. | `endDate` 30 gün önce | HTTP 403 `LICENSE_EXPIRED` |
| Pasif Kurum | `isActive=false` | HTTP 403 `COMPANY_INACTIVE` |
| Demo Kurum | `isDemo=true`, küçük paket | HTTP 200 |
| (şirketsiz kullanıcı) | `companyId=null` | HTTP 403 `COMPANY_INACTIVE` |

Kullanıcılar: 1 SUPER_ADMIN · 4 COMPANY_ADMIN · 8 aktif çalışan · 1 pasif çalışan ·
1 şirketsiz. **Tüm e-postalar `@example.test`.** Şifre `.env.dev` içindeki
`DEV_SEED_PASSWORD` (yoksa rastgele üretilip oraya yazılır, ekrana basılmaz).

Dinleme kayıtlarının tamamı `clientVersion=2`, `contentSec>0`, `clientId` dolu; son
60 güne yayılmış, hızlar 1.0 / 1.25 / 1.5 / 2.0. Kenar durumlar: İstanbul gece
yarısını aşan oturum, 30 sn altı kayıtlar (6/11/19/27 sn), aynı kullanıcının iki
cihazda zamanda çakışan dilimleri, 2.0x hızda dilim.

### Neden kütüphanede 1018 değil 1003 kitap görünüyor

`1018` katalog genelinde aktif + en az bir bölümü olan kitap sayısıdır. Kütüphane
ise **pakete göre** süzer: Demo paketinde 1040 kitap var, bunların 1003'ü aktif ve
bölümlü. Aktif + bölümlü olup Demo paketinde **olmayan** 15 kitap, hiçbir şirketin
kütüphanesinde görünmez.

## Koruma kapıları

- **`scripts/lib/dev-env-guard.mjs`** — `dev:devdb`, `build:devdb`, `prisma:devdb`,
  `tsx:devdb`, `mjs:devdb` komutlarının en başında çalışır. Kabukta
  `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `DATABASE_URL` veya `DIRECT_URL`
  tanımlıysa süreci durdurur. Gerekçe: `dotenvx` zaten tanımlı değişkenleri **ezmez**,
  bu yüzden kabuğa sızan canlı bir değer `-f .env.dev` komutunu sessizce canlıya
  yönlendirir. Temizlemek için: `unset AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY DATABASE_URL DIRECT_URL`

- `scripts/lib/prod-guard.mjs` — bağlantı dizesinde canlı proje ref'ini görürse
  `ALLOW_PROD=1` olmadan yazan scriptleri `exit(1)` ile durdurur. Yerel `localhost:5433`
  URL'sinde ref yoktur, dolayısıyla dev DB'de scriptler serbest çalışır.
- `S3_DELETE_DISABLED=true` (`.env.dev`) — `src/lib/s3.ts` ve
  `scripts/lib/s3-delete.mjs` üzerinden tüm silmeler atlanır.
- `.env.dev` AWS anahtarları yalnızca `s3:GetObject` (+ gerekirse `s3:ListBucket`)
  yetkili, canlıdan **ayrı** bir IAM anahtarı olmalıdır.
- `.env.dev` içindeki `AUTH_SECRET` ve `CRON_SECRET` canlıdan kopyalanmadı; yeni üretildi.

## RLS

Canlıdaki gibi 21 tablonun hepsinde RLS **etkin, politika yok**. Bu durum
migration'lardan geliyor (`20261001000001_enable_rls_notification_log`,
`20261007000001_password_management`, `20261008000001_add_demo_request`), bu yüzden
**ayrı bir dev kurulum adımı gerekmiyor**. Tablo tablo karşılaştırıldı, fark yok.

Politika olmadığı ve `FORCE ROW LEVEL SECURITY` kapalı olduğu için tablo sahibi RLS'i
atlar; uygulama sahibi rolle bağlandığı sürece etkisizdir. Sahip olmayan bir rolle
bağlanılırsa her sorgu boş döner.

## `.mjs` scriptleri — ENV_FILE

13 `.mjs` script `process.env.ENV_FILE ?? ".env"` okuyor. `.env` artık `.env.dev`'e bağlı
olduğu için **varsayılan hedef geliştirme DB'sidir**:

```bash
node prisma/fix-duplicate-books.mjs                   # .env → .env.dev → localhost:5433
npm run mjs:devdb -- prisma/fix-duplicate-books.mjs   # aynısı, kabuk kontrolüyle
ALLOW_PROD=1 npm run mjs:prod -- prisma/fix-duplicate-books.mjs   # canlı (bilinçli)
```

Prod koruması `ENV_FILE` ile okunan URL'yi de denetler: `ENV_FILE=.env.prod` verildiğinde
`ALLOW_PROD=1` olmadan durdurur.

### SSL

Yerel küme sertifikasız çalıştığı için SSL bağlantısını reddeder
("The server does not support SSL connections"). `scripts/lib/pg-ssl.mjs` host'a bakıp
karar verir: `localhost` / `127.0.0.1` / `[::1]` → SSL kapalı, diğer her şey →
`{ rejectUnauthorized: false }`. 11 `pg.Pool` scripti ve iki TS scripti bunu kullanır.

## Bilinen kısıt — e-posta

`src/lib/mailer.ts:3` `new Resend(process.env.RESEND_API_KEY!)` çağrısını **modül
kapsamında** yapıyor. `.env.dev` içinde `RESEND_API_KEY` boş olduğu için mailer'ı import
eden route'lar dev ortamında **HTTP 500** veriyor (`Missing API key`). Doğrulandı:
`POST /api/demo-request` → 500, DB'ye yazma hiç olmuyor.

Etkilenen 6 dosya: `api/admin/companies/[id]/invite`, `api/dashboard/invite`,
`api/dashboard/invite/bulk`, `api/demo-request`, `lib/emails/reset-password`,
`lib/emails/password-changed`. Çözüm, mailer'ı tembel başlatmaktır (ayrı görev;
`project_pending_web` notunda zaten duruyor).
