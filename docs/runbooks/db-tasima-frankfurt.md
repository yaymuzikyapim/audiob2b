# DB Taşıma Koşu Kitabı — Tokyo → Frankfurt (eu-central-1)

**Hazırlayan:** AudioB2B  
**Durum:** Aşama 1 tamamlandı ✅ — Aşama 2 bekleniyor  
**Geçiş zamanı:** 11 Ekim 2026 Pazar, 22:30 TR (19:30 UTC)  
**Hedef:** Supabase ap-northeast-1 (Tokyo) → eu-central-1 (Frankfurt)

> **Dondurma:** Pazar geçişine kadar Prisma şema değişikliği veya migration içeren dal merge/deploy edilmez.
> Dal üzerinde çalışma ve inceleme serbesttir.

---

## Ön Bilgi

| Bileşen | Şu an | Hedef |
|---|---|---|
| Supabase DB | ap-northeast-1 (Tokyo) | eu-central-1 (Frankfurt) |
| AWS S3 ses/görsel | eu-central-1 (Frankfurt) | Değişmez |
| Vercel Lambda | hnd1 (Tokyo) | fra1 (Frankfurt) |

**DB boyutu:** ~17 MB · 21 tablo · 19 Prisma migration  
**Supabase Storage:** Kullanılmıyor (0 obje)  
**pg_dump/pg_restore:** Yerel 18.6 → sunucu 17.11 (uyumlu; pg_dump yeni sürümler eski sunucu destekler)

> **Free plan notu:** Frankfurt projesinde PITR (Point-in-Time Recovery) yoktur.
> Geçiş sonrası haftalık otomatik pg_dump yedeği ayrıca planlanacak (geçiş gecesi yapılmaz).

---

## Bağlantı Bilgileri

Frankfurt bağlantı bilgileri `.env.migration` dosyasında tutulur (gitignore'da, repoya girmez).  
Kullanıcı bu dosyayı kendisi doldurur. **Değerler hiçbir komut çıktısında gösterilmez.**

```
# .env.migration (kullanıcı dolduracak — değerleri buraya yazmayın)
FRANKFURT_DATABASE_URL=   # Transaction pooler — port 6543, pooler.supabase.com
FRANKFURT_DIRECT_URL=     # Session pooler — port 5432, pooler.supabase.com
```

Dosyayı yüklemeden önce: `chmod 600 .env.migration`

### Frankfurt bağlantı mimarisi

Frankfurt Supabase projesinde **IPv4 direkt bağlantı yoktur** (yalnızca IPv6).  
Bu nedenle her iki bağlantı da `pooler.supabase.com` üzerinden gider:

| Amaç | URL | Port |
|---|---|---|
| Uygulama (Vercel) | Transaction pooler | 6543 |
| Migration / pg_dump | Session pooler | 5432 |

Frankfurt `DATABASE_URL` yapısı Tokyo'dakiyle birebir aynıdır: `postgresql://postgres.<ref>@<pooler-host>:6543/postgres` — **`?pgbouncer=true` eklenmez** (uygulama `@prisma/adapter-pg` ile bağlanır, prepared statement üretmez).

**`schema.prisma` notu:** Datasource'da `url`/`directUrl` alanı yoktur; Prisma `prisma.config.ts` üzerinden okur.  
Migration için `DIRECT_URL` override:
```bash
DIRECT_URL="$FRANKFURT_DIRECT_URL" npx prisma migrate status
```

---

## Ön Kontrol Sonuçları

- supabase-js / SUPABASE_URL / anon key: Kodda YOK — Prisma direkt bağlantı kullanılıyor
- vault.secrets: 0 kayıt
- Tetikleyiciler (triggers): 0
- Stored functions: 0
- pg_cron: Kurulu değil
- Database webhooks (pg_net): Kurulu değil
- Supabase Storage: Boş

**Frankfurt projesinde açılacak extension'lar:**  
`pgcrypto` · `uuid-ossp` · `pg_stat_statements` (Supabase panelinden Database > Extensions)  
`supabase_vault` Supabase tarafından otomatik kurulur.

---

## AŞAMA 1 — PROVA (gündüz, canlıya dokunmadan) ✅

### Adım 1 — Tokyo tam yedeği

```bash
DIRECT_URL_TOKYO=$(grep "^DIRECT_URL=" .env | cut -d= -f2- | tr -d '"')

pg_dump "$DIRECT_URL_TOKYO" \
  --format=custom \
  --no-owner \
  --no-privileges \
  --schema=public \
  -f ~/Backups/audiob2b_tokyo_$(date +%Y%m%d_%H%M).pgdump

chmod 600 ~/Backups/audiob2b_tokyo_*.pgdump
```

**Veri gizliliği:** Yedek dosya kişisel veri içerir.
- Repoya commit edilmez.
- Geçişten 7 gün sonra silinir: `rm ~/Backups/audiob2b_tokyo_*.pgdump`

### Adım 2 — Frankfurt'a restore

```bash
source .env.migration   # FRANKFURT_DIRECT_URL ve FRANKFURT_DATABASE_URL yükle

# Frankfurt projesinde önce extension'ları aç (Supabase panel: Database > Extensions):
#   pgcrypto, uuid-ossp, pg_stat_statements
# supabase_vault otomatik kurulur.

# Frankfurt PostgreSQL sürümünü doğrula (17.x olmalı, pg_dump 18.6 uyumlu):
psql "$FRANKFURT_DIRECT_URL" -c "SELECT version();"

pg_restore \
  --dbname="$FRANKFURT_DIRECT_URL" \
  --no-owner \
  --no-privileges \
  --schema=public \
  ~/Backups/audiob2b_tokyo_$(date +%Y%m%d)*.pgdump
```

`FRANKFURT_DIRECT_URL` = Session pooler (port 5432) — pg_restore için tam oturum gerekir; transaction pooler (6543) kullanılmaz.

### Adım 3 — Doğrulama

```bash
source .env.migration
DIRECT_URL_TOKYO=$(grep "^DIRECT_URL=" .env | cut -d= -f2- | tr -d '"')

# Tokyo ve Frankfurt COUNT(*) karşılaştırması — FARK varsa geçiş durur
python3 - <<'PYEOF'
import subprocess, os, sys

tokyo = os.environ.get("DIRECT_URL_TOKYO") or subprocess.check_output(
    "grep '^DIRECT_URL=' .env | cut -d= -f2-", shell=True).decode().strip().strip('"')
frankfurt = os.environ["FRANKFURT_DIRECT_URL"]

def counts(url):
    sql = "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY 1;"
    tables = subprocess.check_output(["psql", url, "-t", "-c", sql]).decode().split()
    result = {}
    for t in tables:
        c = subprocess.check_output(
            ["psql", url, "-t", "-c", f'SELECT COUNT(*) FROM public."{t}";']).decode().strip()
        result[t] = int(c)
    return result

t = counts(tokyo)
f = counts(frankfurt)
all_tables = sorted(set(t) | set(f))

print(f"{'TABLO':<30} {'TOKYO':>8} {'FRANKFURT':>10} {'FARK':>6}")
print("-" * 58)
has_diff = False
for tbl in all_tables:
    tc, fc = t.get(tbl, -1), f.get(tbl, -1)
    diff = tc - fc
    flag = " ← FARK!" if diff != 0 else ""
    print(f"{tbl:<30} {tc:>8} {fc:>10} {diff:>+6}{flag}")
    if diff != 0:
        has_diff = True

print()
if has_diff:
    print("HATA: Satır sayısı farkı var — geçiş durduruldu.")
    sys.exit(1)
else:
    print("OK: Tüm tablolar eşleşiyor.")
PYEOF
```

```bash
# Frankfurt RLS — 21 tablonun tümü 't' olmalı
psql "$FRANKFURT_DIRECT_URL" -c \
  "SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='public' ORDER BY tablename;"

# Prisma migration durumu
DIRECT_URL="$FRANKFURT_DIRECT_URL" npx prisma migrate status
# Beklenen: 19 migration, hepsi "Applied"
```

### Adım 4 — Yerel okuma testi

`.env.local` dosyasında `DATABASE_URL` ve `DIRECT_URL`'yi geçici olarak Frankfurt değerleriyle değiştir.  
`npm run dev` ile çalıştır:

- QA admin girişi
- `/dashboard/library` yükleme
- `/dashboard/admin/reports` sayfası

**Yazma testi YAPMA.** Frankfurt prova verisi gece geçişinde silinip yeniden yüklenecek.

Test sonrası `.env.local`'i Tokyo değerlerine geri al.

### Adım 5 — Geçiş zamanı

**11 Ekim 2026 Pazar, 22:30 TR (19:30 UTC)** — onaylandı.

---

## AŞAMA 2 — GEÇİŞ (gece, kullanıcı onayıyla)

> **Gece akışının deploy sırası ve tahmini süreler:**
> 1. `MAINTENANCE_MODE=true` → `./deploy.sh origin/main` → **~4 dk**
> 2. Son dump + Frankfurt restore + satır sayısı karşılaştırması → **~10-15 dk**
> 3. Frankfurt env + `MAINTENANCE_MODE` kaldır + `regions=["fra1"]` → `./deploy.sh origin/main` → **~4 dk**
>
> Toplam bakım penceresi: **~20-25 dk**

### Adım 1 — Bakım modunu aç (Deploy 1)

1. **Kullanıcı** Vercel panelinden Production env'e `MAINTENANCE_MODE=true` ekler.
2. `vercel.json` `regions` değeri `hnd1`'de kalır (Tokyo, mevcut DB ile aynı bölge) — commit gerekmez.
3. `./deploy.sh origin/main` (~4 dk) — deploy.sh `git archive` kullanır, yalnızca commit edilmiş dosyaları yükler.

Doğrulama:
```bash
curl -sv -X POST \
  "https://www.audiob2b.com.tr/api/dashboard/progress/sync" 2>&1 | \
  grep "< HTTP\|< retry-after"
# Beklenen: 503, retry-after: 300
```

### Adım 2 — Son yedek + Frankfurt restore (korumalı script)

```bash
DIRECT_URL_TOKYO=$(grep "^DIRECT_URL=" .env | cut -d= -f2- | tr -d '"')
source .env.migration   # FRANKFURT_DIRECT_URL yükle

# Son yedek
pg_dump "$DIRECT_URL_TOKYO" \
  --format=custom --no-owner --no-privileges --schema=public \
  -f ~/Backups/audiob2b_tokyo_FINAL_$(date +%Y%m%d_%H%M).pgdump
chmod 600 ~/Backups/audiob2b_tokyo_FINAL_*.pgdump
```

```bash
# Frankfurt temizleme — KORUMA: önce host ve DB doğrula, sonra DROP çalış
source .env.migration

python3 - <<'PYEOF'
import os, subprocess, sys, re

url = os.environ["FRANKFURT_DIRECT_URL"]

# Güvenlik: host "eu-central-1" içermeli
if "eu-central-1" not in url:
    print(f"HATA: FRANKFURT_DIRECT_URL host'unda 'eu-central-1' bulunamadı.")
    print("DROP çalıştırılmıyor. URL kontrol edin.")
    sys.exit(1)

# Güvenlik: Tokyo ref'i (...tsra) içermemelisin
if "tsra" in url:
    print("HATA: URL Tokyo ref'i (...tsra) içeriyor.")
    print("DROP çalıştırılmıyor.")
    sys.exit(1)

# Bağlantıyı ve DB'yi doğrula
result = subprocess.check_output(
    ["psql", url, "-t", "-c", "SELECT current_database(), inet_server_addr();"]
).decode().strip()
print(f"Bağlantı doğrulandı: {result}")
print("Host eu-central-1 ✓, Tokyo ref yok ✓")
print("DROP SCHEMA public CASCADE çalıştırılıyor...")

subprocess.check_call(["psql", url, "-c", "DROP SCHEMA public CASCADE;"])
subprocess.check_call(["psql", url, "-c", "CREATE SCHEMA public;"])

# Supabase public şema yetkilerini geri kur
grants = [
    "GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;",
    "GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;",
    "GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;",
    "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;",
    "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role;",
]
for g in grants:
    subprocess.check_call(["psql", url, "-c", g])

print("Şema yetkileri yeniden kuruldu.")
PYEOF
```

```bash
# Restore
pg_restore \
  --dbname="$FRANKFURT_DIRECT_URL" \
  --no-owner --no-privileges --schema=public \
  ~/Backups/audiob2b_tokyo_FINAL_*.pgdump
```

```bash
# Satır sayısı karşılaştırması (COUNT(*), FARK sütunlu — fark varsa script çıkış kodu 1)
source .env.migration
DIRECT_URL_TOKYO=$(grep "^DIRECT_URL=" .env | cut -d= -f2- | tr -d '"')

python3 - <<'PYEOF'
import subprocess, os, sys

tokyo = os.environ.get("DIRECT_URL_TOKYO") or subprocess.check_output(
    "grep '^DIRECT_URL=' .env | cut -d= -f2-", shell=True).decode().strip().strip('"')
frankfurt = os.environ["FRANKFURT_DIRECT_URL"]

def counts(url):
    sql = "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY 1;"
    tables = subprocess.check_output(["psql", url, "-t", "-c", sql]).decode().split()
    result = {}
    for t in tables:
        c = subprocess.check_output(
            ["psql", url, "-t", "-c", f'SELECT COUNT(*) FROM public."{t}";']).decode().strip()
        result[t] = int(c)
    return result

t = counts(tokyo)
f = counts(frankfurt)
all_tables = sorted(set(t) | set(f))

print(f"{'TABLO':<30} {'TOKYO':>8} {'FRANKFURT':>10} {'FARK':>6}")
print("-" * 58)
has_diff = False
for tbl in all_tables:
    tc, fc = t.get(tbl, -1), f.get(tbl, -1)
    diff = tc - fc
    flag = " ← FARK!" if diff != 0 else ""
    print(f"{tbl:<30} {tc:>8} {fc:>10} {diff:>+6}{flag}")
    if diff != 0:
        has_diff = True

print()
if has_diff:
    print("HATA: Satır sayısı farkı var — geçiş durduruldu.")
    sys.exit(1)
else:
    print("OK: Tüm tablolar eşleşiyor.")
PYEOF
```

**→ Fark varsa geçiş durur, onay beklenir.**

### Adım 3 — Frankfurt env + bölge değişimi + bakım modunu kapat (Deploy 2)

1. **Kullanıcı** Vercel panelinden production env değişkenlerini günceller:
   - `DATABASE_URL` → Frankfurt **Transaction pooler** (port 6543, `pooler.supabase.com`)  
     Yapı: `postgresql://postgres.<ref>@aws-1-eu-central-1.pooler.supabase.com:6543/postgres`
   - `DIRECT_URL` → Frankfurt **Session pooler** (port 5432, `pooler.supabase.com`)
   - `MAINTENANCE_MODE` → kaldır (veya `false`)
2. `vercel.json`: `"regions": ["fra1"]` (commit + push)
3. `./deploy.sh origin/main` → **~4 dk**

Bu tek deploy ile üç değişiklik birden yürürlüğe girer: Frankfurt DB, fra1 Lambda, bakım modu kapalı.

### Adım 4 — Yerel `.env` güncelleme

`.env` dosyasında `DATABASE_URL` ve `DIRECT_URL`'yi Frankfurt değerlerine çevir.

### Adım 5 — DB kanıtı (Frankfurt'a yazma doğrulaması)

Deploy 2 tamamlandıktan sonra, canlı QA çalışan hesabıyla:

```bash
# 1. QA çalışan girişi yap, cookie kaydet
curl -s -c /tmp/proof_cookies.txt -X POST \
  "https://www.audiob2b.com.tr/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"<QA_EMPLOYEE_EMAIL>","password":"***"}' | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('role','?'))"

# 2. Favori ekle (rastgele bir kitap ID — örn. ilk kitap)
BOOK_ID=$(curl -s -b /tmp/proof_cookies.txt \
  "https://www.audiob2b.com.tr/api/dashboard/library" | \
  python3 -c "import sys,json; d=json.load(sys.stdin); print(d['books'][0]['id'])")

curl -s -b /tmp/proof_cookies.txt -X POST \
  "https://www.audiob2b.com.tr/api/dashboard/favorites" \
  -H "Content-Type: application/json" \
  -d "{\"bookId\":\"$BOOK_ID\"}"
```

```bash
# 3. Frankfurt'ta bu kaydın var olduğunu doğrula
source .env.migration
psql "$FRANKFURT_DIRECT_URL" -c \
  "SELECT id, \"bookId\", \"userId\", \"createdAt\" FROM public.\"UserFavorite\" ORDER BY \"createdAt\" DESC LIMIT 3;"

# 4. Tokyo'da bu kaydın OLMADIĞINI doğrula
DIRECT_URL_TOKYO=$(grep "^DIRECT_URL=" .env | cut -d= -f2- | tr -d '"')
psql "$DIRECT_URL_TOKYO" -c \
  "SELECT COUNT(*) FROM public.\"UserFavorite\" WHERE \"createdAt\" > NOW() - INTERVAL '5 minutes';"
# Beklenen: 0

# 5. Favoriyi kaldır
curl -s -b /tmp/proof_cookies.txt -X DELETE \
  "https://www.audiob2b.com.tr/api/dashboard/favorites/$BOOK_ID"
rm /tmp/proof_cookies.txt
```

### Adım 6 — Doğrulama

```bash
# Vercel region
curl -s -o /dev/null -w "x-vercel-id: %header{x-vercel-id}\n" \
  "https://www.audiob2b.com.tr/"

# QA admin TTFB (5 istek)
for i in $(seq 1 5); do
  curl -s -b /tmp/qa_cookies.txt -o /dev/null \
    -w "Req $i: %{time_total}s\n" \
    "https://www.audiob2b.com.tr/api/dashboard/library"
  sleep 3
done
```

Manuel kontrol listesi:
- [ ] QA admin giriş
- [ ] QA çalışan giriş
- [ ] Kütüphane yükleme
- [ ] Bir bölüm oynatma
- [ ] Kaldığı yer senkronu (PlayerState)
- [ ] Rapor sayfası (Excel/PDF indirme)
- [ ] Mobil: kütüphane + oynatma

---

## Geri Dönüş Planı

> **Önemli:** Frankfurt'a geçişten sonra yazılan veriler (PlayerState, PlayHistory, UserFavorite vb.)
> Tokyo'ya geri dönüşte kaybolur. **Geri dönüş kararı Deploy 2'den sonraki ilk 1 saat içinde
> verilmelidir.** Sonrasında veri kaybı riski kabul edilmiş sayılır.

1. Vercel panelinden `DATABASE_URL`/`DIRECT_URL` → Tokyo değerlerine geri al
2. `vercel.json`: `"regions": ["hnd1"]`
3. `./deploy.sh origin/main`
4. Yerel `.env`'i Tokyo'ya geri çevir
5. Beklenen süre: ~5 dakika

---

## Tokyo Projesinin Kapatılması (7 gün sonra, ayrıca onaylanacak)

Geçiş başarısından **7 gün sonra**, kullanıcı onayıyla:
1. Son bir yedek: `pg_dump "$DIRECT_URL_TOKYO" ... ~/Backups/audiob2b_tokyo_SHUTDOWN_*.pgdump`
2. Supabase Tokyo paneli: Settings → General → Pause project
3. 14 gün daha sorun çıkmazsa Tokyo projesini sil
4. Yedek dosyaları sil: `rm ~/Backups/audiob2b_tokyo_*.pgdump`

---

## Frankfurt Projesi Kurulum Kontrol Listesi

- [x] Bölge: eu-central-1 (Frankfurt) seçildi
- [x] Extension'lar açıldı: pgcrypto, uuid-ossp, pg_stat_statements
- [x] Pooler: Transaction mode, port 6543
- [ ] Ağ kısıtlaması: Vercel IP aralıkları eklendi (veya kapalı bırakıldı — Tokyo ile aynı)
- [ ] **Free plan:** PITR yok — geçiş sonrası haftalık pg_dump zamanlaması ayrıca yapılacak
- [x] `.env.migration` dosyası dolduruldu, chmod 600

---

## AŞAMA 2 KONTROL LİSTESİ — 11 Ekim Pazar 22:30

Adımlar sırayla yapılır; her onay beklenir. `[K]` = Claude çalıştırır, `[U]` = kullanıcının yapacağı adım.

---

**22:15 — Ön hazırlık (geçişten önce)**
- [ ] `[U]` Vercel paneline giriş yapıldı, Production env sekmesi açık
- [ ] `[U]` Supabase Frankfurt paneline giriş yapıldı
- [ ] `[U]` Parola yöneticisi açık (Frankfurt DATABASE_URL/DIRECT_URL hazır)
- [ ] `[K]` Runbook son kez okundu, bağlantılar doğrulandı

**22:30 — Hazırlık**
- [ ] `[K]` Canlı TTFB taban ölçümü: `/api/dashboard/library` × 3 istek
- [ ] `[K]` Tokyo bağlantısı son kontrol: COUNT(*) User tablosu

**22:35 — Deploy 1: Bakım modu aç**
- [ ] `[U]` Vercel Production env → `MAINTENANCE_MODE=true` ekle
- [ ] `[K]` `./deploy.sh origin/main` (~4 dk)
- [ ] `[K]` Doğrulama: POST → HTTP 503 + `retry-after: 300`
- [ ] `[K]` GET kontrolü: `/api/health` → engellenmedi

**22:40 — Son yedek + Frankfurt restore**
- [ ] `[K]` Son yedek: `pg_dump ... ~/Backups/audiob2b_tokyo_FINAL_*.pgdump`
- [ ] `[K]` Korumalı script: host doğrula → DROP SCHEMA → CREATE SCHEMA → yetkiler
- [ ] `[K]` `pg_restore ...`
- [ ] `[K]` COUNT(*) karşılaştırması (FARK sütunlu) — tüm tablolar 0 fark olmalı
- [ ] Onay bekle ✋

**22:55 — Deploy 2: Frankfurt env + fra1 + bakım kapat**
- [ ] `[U]` Vercel Production env güncelle:
  - `DATABASE_URL` → Frankfurt Transaction pooler (port 6543)
  - `DIRECT_URL` → Frankfurt Session pooler (port 5432)
  - `MAINTENANCE_MODE` → kaldır (veya `false`)
- [ ] `[K]` `vercel.json`: `"regions": ["fra1"]` commit et
- [ ] `[K]` `./deploy.sh origin/main` (~4 dk)
- [ ] `[K]` `curl ... x-vercel-id` → Lambda `fra1` doğrula

**23:05 — DB kanıtı + QA doğrulama**
- [ ] `[K]` DB kanıtı: favori ekle → Frankfurt'ta var, Tokyo'da yok → favori kaldır
- [ ] `[K]` QA admin giriş → kütüphane → rapor
- [ ] `[K]` TTFB: `/api/dashboard/library` × 5 istek
- [ ] `[U]` Mobil: kütüphane yükleme + bir bölüm oynatma + senkron

**23:15 — Kapanış**
- [ ] `[K]` `.env` güncelle: DATABASE_URL/DIRECT_URL → Frankfurt değerlerine çevir
- [ ] `[K]` CLAUDE.md güncelle: DB bölgesi Tokyo → Frankfurt

**Tokyo 7 gün ayakta kalır (geri dönüş penceresi).** Pause ve silme ayrıca onaylanacak.

**Geri dönüş (gerekirse, ilk 1 saat içinde):**
- [ ] `[U]` Vercel env → Tokyo DATABASE_URL/DIRECT_URL
- [ ] `[K]` `vercel.json`: `"regions": ["hnd1"]` + `./deploy.sh` (~5 dk)
- ⚠️ Deploy 2'den sonra yazılan veriler Tokyo'ya dönüşte kaybolur.

---

*Son güncelleme: 9 Ekim 2026*
