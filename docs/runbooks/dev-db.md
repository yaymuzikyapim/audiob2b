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

Küme şu an **boş** (yalnızca şema). Canlı kişisel veri bu kümeye **girmez** (K0).
Katalog ve sentetik kullanıcı/şirket yüklemesi ayrı bir adımda yapılacak.

## Koruma kapıları

- `scripts/lib/prod-guard.mjs` — bağlantı dizesinde canlı proje ref'ini görürse
  `ALLOW_PROD=1` olmadan yazan scriptleri `exit(1)` ile durdurur. Yerel `localhost:5433`
  URL'sinde ref yoktur, dolayısıyla dev DB'de scriptler serbest çalışır.
- `S3_DELETE_DISABLED=true` (`.env.dev`) — `src/lib/s3.ts` ve
  `scripts/lib/s3-delete.mjs` üzerinden tüm silmeler atlanır.
- `.env.dev` AWS anahtarları yalnızca `s3:GetObject` (+ gerekirse `s3:ListBucket`)
  yetkili, canlıdan **ayrı** bir IAM anahtarı olmalıdır.
- `.env.dev` içindeki `AUTH_SECRET` ve `CRON_SECRET` canlıdan kopyalanmadı; yeni üretildi.

## Bilinen kısıt

`prisma/*.mjs` ve `scripts/dedupe-chapters.mjs` env dosyasının yolunu sabit yazıyor
(`fs.readFileSync(root + "/.env")`), bu yüzden `dotenvx`/`tsx:devdb` onlara etki etmez —
hâlâ `.env`'i (canlıyı) okurlar ve prod koruması onları durdurur. Dev DB'de
çalışabilmeleri için `process.env.ENV_FILE ?? ".env"` desteği eklenmelidir (ayrı adım).
