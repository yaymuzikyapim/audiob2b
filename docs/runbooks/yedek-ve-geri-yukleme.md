# Canlı yedek ve geri yükleme testi

**Son çalıştırma:** 15 Ekim 2026, 13:47–13:50 (Adım 0-C)
**Araçlar:** PostgreSQL **17.11**, yalnızca tam yol: `/usr/local/opt/postgresql@17/bin/`
(`postgresql@17` link edilmemiştir; `psql` adıyla çağrılırsa 18.6 gelir.)

> CLAUDE.md → **Güvenlik Kuralları** geçerlidir: canlı `.env` kabuğa yüklenmez,
> `DIRECT_URL` yalnızca komutun argümanı içinde okunur. Canlıya yalnızca okuma.

## Neden 5432 session pooler

`DIRECT_URL` Supabase'in **session pooler**'ını (`aws-1-eu-central-1.pooler.supabase.com:5432`)
gösterir, `db.<ref>.supabase.co`'yu değil. Supabase'in direkt host'u yalnızca IPv6'dan
erişilebilir ve bu makine ulaşamıyor. Frankfurt taşımasında tüm `pg_dump` / `pg_restore`
işleri bu pooler üzerinden yapıldı ve çalıştı; yedek de böyle alınıyor. **`DIRECT_URL`
değiştirilmeyecek.**

## Saklama ve güvenlik

**Yedek dosyaları kişisel veri içerir** (kullanıcı adı, e-posta, şifre özeti, dinleme
geçmişi). Bu yüzden:

- Repo **dışında** tutulur: `~/Backups/audiob2b/` (`chmod 700`).
- Dosyalar `chmod 600`.
- **FileVault'lu diskte** tutulur.
- **30 günden eski yedekler silinir; en az son 2 yedek korunur.**

> ⚠️ 15 Ekim 2026 itibarıyla bu Mac'te `fdesetup status` → **FileVault is Off.**
> Yedek şu an şifresiz diskte duruyor. FileVault açılana kadar bu dosyaların
> makineden çıkmaması ve makinenin kaybı/çalınması durumunda kişisel veri
> sızıntısı riski taşıdığı unutulmamalı.

## 1. Ön kontrol

```bash
fdesetup status                       # FileVault açık olmalı
mkdir -p ~/Backups/audiob2b && chmod 700 ~/Backups/audiob2b
TS=$(date +%Y%m%d-%H%M)
```

## 2. Canlı referans sayımlar

21 public tablonun satır sayısı + yapı ölçütleri, tek bir salt okuma işleminde:

```bash
PG=/usr/local/opt/postgresql@17/bin
$PG/psql "$(grep -m1 '^DIRECT_URL=' .env | cut -d= -f2- | tr -d '"')" -At -f counts.sql \
  | grep '|' | sort > ~/Backups/audiob2b/prod-counts-$TS.txt
chmod 600 ~/Backups/audiob2b/prod-counts-$TS.txt
```

`counts.sql` iskeleti (`BEGIN READ ONLY; SET LOCAL statement_timeout='30s'; … ROLLBACK;`
içinde): tablo sayımları için `query_to_xml` ile tek sorgu, ardından
tablo / PK / FK / FK-geçerli / index / unique index / enum / RLS sayıları.

**15 Ekim 2026 ölçümü** — `prod-counts-20261015-1347.txt`:

| Tablo | Satır | | Tablo | Satır |
|---|---|---|---|---|
| Book | 1.055 | | PlayerState | 60 |
| Bookmark | 3 | | ProposalLink | 2 |
| Category | 20 | | ProposalLinkVisitor | 2 |
| Chapter | 8.867 | | RateLimit | 26 |
| Company | 5 | | Series | 37 |
| DemoRequest | 0 | | User | 63 |
| InviteToken | 8 | | UserFavorite | 365 |
| NotificationLog | 1 | | _prisma_migrations | 19 |
| Package | 2 | | | |
| PackageBook | 1.046 | | | |
| PasswordAuditLog | 9 | | | |
| PasswordResetToken | 3 | | | |
| PlayHistory | 216 | | | |

Yapı: tablo 21 · PK 21 · FK 22 (22'si geçerli) · index 41 (35 unique) · enum 3 · RLS açık 21.

## 3. Yedek

```bash
$PG/pg_dump -Fc --schema=public --no-owner --no-acl \
  -f ~/Backups/audiob2b/audiob2b-prod-public-$TS.dump \
  "$(grep -m1 '^DIRECT_URL=' .env | cut -d= -f2- | tr -d '"')"
chmod 600 ~/Backups/audiob2b/audiob2b-prod-public-$TS.dump
shasum -a 256 ~/Backups/audiob2b/audiob2b-prod-public-$TS.dump
$PG/pg_restore --list ~/Backups/audiob2b/audiob2b-prod-public-$TS.dump
```

**15 Ekim 2026 ölçümü:** süre **8 sn**, boyut **756.542 bayt (768K)**,
`sha256 = 0f274e3529c6f980dd19c5ddc2a88e57dda016e42f6ad050f79aef1477f22d41`.

`pg_restore --list` içeriği: 1 SCHEMA · 3 TYPE · 21 TABLE · **21 TABLE DATA** ·
21 CONSTRAINT (PK) · 20 INDEX · 22 FK CONSTRAINT · 21 ROW SECURITY.
(21 PK + 20 INDEX = 41 index, canlıyla tutarlı.)

## 4. Geçici geri yükleme kümesi

Dev kümesinden (5433) **ayrı**, `/tmp` altında, port **5434**, iş bitince silinir.

```bash
D=/tmp/audiob2b-restore-$TS
$PG/initdb -D "$D" -U postgres --encoding=UTF8 \
  --locale-provider=icu --icu-locale=en-US \
  --lc-collate=en_US.UTF-8 --lc-ctype=en_US.UTF-8 \
  --auth-local=trust --auth-host=trust

cat >> "$D/postgresql.conf" <<'CONF'
port = 5434
listen_addresses = 'localhost'
unix_socket_directories = '/tmp'
timezone = 'UTC'
CONF

LC_ALL="en_US.UTF-8" $PG/pg_ctl -D "$D" -l "$D/server.log" -w start
LC_ALL="en_US.UTF-8" $PG/createdb -h localhost -p 5434 -U postgres audiob2b_restore
LC_ALL="en_US.UTF-8" $PG/pg_restore --no-owner --no-acl \
  -h localhost -p 5434 -U postgres -d audiob2b_restore \
  ~/Backups/audiob2b/audiob2b-prod-public-$TS.dump
```

`LC_ALL` zorunlu: olmadan macOS'ta `FATAL: postmaster became multithreaded during startup`.

**Beklenen tek hata** (zararsız, `pg_restore` exit 1 döndürür ama devam eder):

```
pg_restore: error: could not execute query: HATA:  "public" şeması zaten mevcut
Command was: CREATE SCHEMA public;
pg_restore: warning: errors ignored on restore: 1
```

Yeni bir PG17 veritabanında `public` şeması hep vardır. Başka hata/uyarı çıkarsa
**durulur ve incelenir**. 15 Ekim 2026 ölçümü: geri yükleme **< 1 sn**.

## 5. Doğrulama

1. **Satır sayıları:** aynı sayım sorgusu 5434'te çalıştırılır, `prod-counts-$TS.txt`
   ile `diff` → **fark 0 olmalı**.
2. **Yapı:** PK 21 · FK 22 · `convalidated` 22 (doğrulanmamış 0) · index 41 ·
   unique 35 · enum 3 · RLS 21 · politika 0.
3. **Migration:** `_prisma_migrations` 19 satır, listesi canlıyla birebir.
4. **Kolon düzeyi:** 159 kolonun ad/tip/null/default satırı canlıyla `diff` → fark 0.
5. **Uygulama testi:** `.env.dev`'in kopyasından `DATABASE_URL`/`DIRECT_URL`'i
   `postgresql://postgres@localhost:5434/audiob2b_restore` yapan **geçici** bir env
   dosyası (`/tmp`, `chmod 600`, iş sonunda silinir) ile:

```bash
node scripts/lib/dev-env-guard.mjs \
  && npx dotenvx run -f /tmp/audiob2b-restore-test.env --quiet -- next dev --port 3200
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3200/login   # 200 beklenir
```

Prisma ile salt okuma sayım da yapılır (hedef yazdırılır, CLAUDE.md kuralı 4).
**Giriş yapılmaz, hiçbir hesap kullanılmaz.** Geçici kümede `aliye` rolü olmadığı için
bağlantı dizesinde kullanıcı adı `postgres` olmalıdır.

15 Ekim 2026 sonucu: `/login` → **HTTP 200**; Prisma `localhost:5434/audiob2b_restore`
hedefinde Book 1055 · Company 5 · Chapter 8867 · User 63 · PlayHistory 216 — hepsi canlı
referansla aynı.

## 6. Temizlik (K0 gereği kayda alınır)

```bash
pkill -f "next dev --port 3200"
$PG/pg_ctl -D "$D" -m fast -w stop
rm -rf "$D" /tmp/audiob2b-restore-test.env
ls -ld "$D"                      # "No such file or directory" beklenir
```

Yedek dosyası `~/Backups/audiob2b/` altında **kalır**.

**15 Ekim 2026 silme kaydı:** geçici küme `/tmp/audiob2b-restore-20261015-1347` ve
geçici env dosyası `/tmp/audiob2b-restore-test.env` **2026-10-15 13:50:11 +03**'te
silindi; `ls` ile doğrulandı.

## Ölçülen süreler (15 Ekim 2026)

| Adım | Süre |
|---|---|
| Referans sayımlar (canlı, salt okuma) | ~2 sn |
| `pg_dump` (pooler üzerinden) | **8 sn** |
| `initdb` + küme başlatma | ~3 sn |
| `pg_restore` | **< 1 sn** |
| Doğrulama sorguları + uygulama testi | ~25 sn |
| **Toplam** | **~3 dk** |
