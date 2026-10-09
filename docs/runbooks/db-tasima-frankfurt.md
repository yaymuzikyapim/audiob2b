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

> **Ağ kısıtlaması:** Tokyo'da SQL üzerinden görülemeyen platform düzeyinde ağ politikası olabilir.
> Geçiş öncesinde her iki projenin Supabase panelinden Settings → Database → Network Restrictions
> kontrol edilmeli; Tokyo'daki kısıtlamalar Frankfurt'a aynı şekilde uygulanmalı.

---

## Bağlantı Bilgileri

### Tokyo bağlantıları — `.env.tokyo`

Geçiş öncesinde `.env`'deki Tokyo değerleri `.env.tokyo`'ya kopyalanır:

```bash
# Geçiş gününden önce bir kez çalıştır
grep "^DATABASE_URL=\|^DIRECT_URL=" .env > .env.tokyo
# Satır başlarını TOKYO_ ön ekiyle yeniden adlandır:
sed -i '' 's/^DATABASE_URL=/TOKYO_DATABASE_URL=/' .env.tokyo
sed -i '' 's/^DIRECT_URL=/TOKYO_DIRECT_URL=/' .env.tokyo
chmod 600 .env.tokyo
```

`.env.tokyo` gitignore kapsamındadır (`.env*` kuralı). Bu dosya geçiş boyunca ve 7 gün sonraki Tokyo
kapatılmasına kadar silinmez. Runbook'taki tüm Tokyo komutları bu dosyadan okur.

### Frankfurt bağlantıları — `.env.migration`

```
FRANKFURT_DATABASE_URL=   # Transaction pooler — port 6543, pooler.supabase.com
FRANKFURT_DIRECT_URL=     # Session pooler — port 5432, pooler.supabase.com
```

`chmod 600 .env.migration`

### Frankfurt bağlantı mimarisi

Frankfurt Supabase projesinde **IPv4 direkt bağlantı yoktur** (yalnızca IPv6).  
Her iki bağlantı da `pooler.supabase.com` üzerinden gider:

| Amaç | URL | Port |
|---|---|---|
| Uygulama (Vercel) | Transaction pooler | 6543 |
| Migration / pg_dump | Session pooler | 5432 |

Frankfurt `DATABASE_URL` yapısı Tokyo'dakiyle birebir aynıdır: `postgresql://postgres.<ref>@<pooler-host>:6543/postgres`  
**`?pgbouncer=true` eklenmez** (uygulama `@prisma/adapter-pg` ile bağlanır, prepared statement üretmez).

**`schema.prisma` notu:** Migration için:
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

**Frankfurt'ta `ensure_rls` event trigger var:** Frankfurt projesinde `ensure_rls` (ddl_command_end) event
trigger'ı bulunuyor; Tokyo'da yok. Bu trigger veritabanı düzeyindedir — `DROP SCHEMA public CASCADE`'den
etkilenmez, pg_restore boyunca da aktif kalır ve yeni oluşturulan tablolara otomatik RLS uygular.

**Frankfurt projesinde açılacak extension'lar:**  
`pgcrypto` · `uuid-ossp` · `pg_stat_statements` (Supabase panelinden Database > Extensions)  
`supabase_vault` Supabase tarafından otomatik kurulur.

---

## AŞAMA 1 — PROVA (gündüz, canlıya dokunmadan) ✅

### Adım 1 — Tokyo tam yedeği

```bash
source .env.tokyo

pg_dump "$TOKYO_DIRECT_URL" \
  --format=custom \
  --no-owner \
  --no-privileges \
  --schema=public \
  -f ~/Backups/audiob2b_tokyo_$(date +%Y%m%d_%H%M).pgdump

chmod 600 ~/Backups/audiob2b_tokyo_*.pgdump
```

**Veri gizliliği:** Yedek dosya kişisel veri içerir — repoya girmez, geçişten 7 gün sonra silinir.

### Adım 2 — Frankfurt'a restore

```bash
source .env.migration

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

### Adım 3 — Doğrulama

```bash
source .env.tokyo
source .env.migration

# COUNT(*) karşılaştırması — FARK varsa script çıkış kodu 1
python3 - <<'PYEOF'
import subprocess, os, sys

tokyo = os.environ["TOKYO_DIRECT_URL"]
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
2. `vercel.json` `regions` değeri `hnd1`'de kalır — commit gerekmez.
3. `./deploy.sh origin/main` (~4 dk)

Doğrulama:
```bash
curl -sv -X POST \
  "https://www.audiob2b.com.tr/api/dashboard/progress/sync" 2>&1 | \
  grep "< HTTP\|< retry-after"
# Beklenen: 503, retry-after: 300
```

### Adım 2 — Son yedek + Frankfurt restore (korumalı script)

```bash
source .env.tokyo
source .env.migration

# Son yedek
pg_dump "$TOKYO_DIRECT_URL" \
  --format=custom --no-owner --no-privileges --schema=public \
  -f ~/Backups/audiob2b_tokyo_FINAL_$(date +%Y%m%d_%H%M).pgdump
chmod 600 ~/Backups/audiob2b_tokyo_FINAL_*.pgdump
```

```bash
# Frankfurt temizleme — KORUMA: host ve ref doğrula, sonra DROP çalış
source .env.migration

python3 - <<'PYEOF'
import os, subprocess, sys

url = os.environ["FRANKFURT_DIRECT_URL"]

# Güvenlik: host "eu-central-1" içermeli
if "eu-central-1" not in url:
    print(f"HATA: FRANKFURT_DIRECT_URL host'unda 'eu-central-1' bulunamadı.")
    print("DROP çalıştırılmıyor.")
    sys.exit(1)

# Güvenlik: Tokyo ref'i (...tsra) içermemeli
if "tsra" in url:
    print("HATA: URL Tokyo ref'i (...tsra) içeriyor.")
    print("DROP çalıştırılmıyor.")
    sys.exit(1)

# Bağlantıyı doğrula ve ekrana yaz
result = subprocess.check_output(
    ["psql", url, "-t", "-c", "SELECT current_database(), inet_server_addr();"]
).decode().strip()
print(f"Bağlantı: {result}")
print("Host eu-central-1 ✓, Tokyo ref yok ✓")
print("DROP SCHEMA public CASCADE çalıştırılıyor...")

subprocess.check_call(["psql", url, "-c", "DROP SCHEMA public CASCADE;"])
subprocess.check_call(["psql", url, "-c", "CREATE SCHEMA public;"])

# public şema yetkileri — yalnızca postgres ve service_role
# (Data API ve automatic expose kapalı; anon/authenticated'a yetki verilmez)
grants = [
    "GRANT USAGE ON SCHEMA public TO postgres, service_role;",
    "GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role;",
    "GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, service_role;",
    "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, service_role;",
    "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, service_role;",
]
for g in grants:
    subprocess.check_call(["psql", url, "-c", g])

print("Şema yetkileri yeniden kuruldu (postgres + service_role).")
# ensure_rls event trigger veritabanı düzeyindedir — DROP SCHEMA'dan etkilenmez.
# pg_restore sonrası aktif kalır ve oluşturulan tablolara otomatik RLS uygular.
print("ensure_rls event trigger: DROP SCHEMA'dan etkilenmez, aktif kalır.")
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
# COUNT(*) karşılaştırması — FARK varsa geçiş durur
source .env.tokyo
source .env.migration

python3 - <<'PYEOF'
import subprocess, os, sys

tokyo = os.environ["TOKYO_DIRECT_URL"]
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
   - `DATABASE_URL` → Frankfurt **Transaction pooler** (port 6543)  
     Yapı: `postgresql://postgres.<ref>@aws-1-eu-central-1.pooler.supabase.com:6543/postgres`
   - `DIRECT_URL` → Frankfurt **Session pooler** (port 5432)
   - `MAINTENANCE_MODE` → kaldır (veya `false`)
2. `vercel.json`: `"regions": ["fra1"]` (commit + push)
3. `./deploy.sh origin/main` → **~4 dk**

### Adım 4 — DB kanıtı (Frankfurt'a yazma doğrulaması)

Deploy 2 tamamlandıktan sonra:

1. **`[U]`** QA çalışan hesabıyla web'den bir kitabı favoriye ekle, kitap adını söyle.
2. **`[K]`** Frankfurt ve Tokyo'da o `userId` + `bookId` kombinasyonunu sorgular (ham çıktı):

```bash
source .env.tokyo
source .env.migration

# [K] Frankfurt'ta kayıt var mı?
psql "$FRANKFURT_DIRECT_URL" -c \
  "SELECT id, \"userId\", \"bookId\", \"createdAt\"
   FROM public.\"UserFavorite\"
   ORDER BY \"createdAt\" DESC LIMIT 3;"

# [K] Tokyo'da aynı kayıt yok olmalı (son 5 dakika içinde oluşan)
psql "$TOKYO_DIRECT_URL" -c \
  "SELECT COUNT(*) FROM public.\"UserFavorite\"
   WHERE \"createdAt\" > NOW() - INTERVAL '5 minutes';"
# Beklenen: 0
```

3. **`[U]`** Favoriyi web'den kaldır.

### Adım 5 — Yerel `.env` güncelleme

`.env` dosyasında `DATABASE_URL` ve `DIRECT_URL`'yi Frankfurt değerlerine çevir.  
`.env.tokyo` silinmez — 7 gün sonraki Tokyo kapatma adımında kullanılacak.

### Adım 6 — Doğrulama

```bash
# Vercel region (x-vercel-id'deki Lambda bölgesi)
curl -s -I "https://www.audiob2b.com.tr/" | grep -i "x-vercel-id"

# Giriş gerektirmeyen sayfa TTFB (10 istek)
for i in $(seq 1 10); do
  curl -s -o /dev/null \
    -w "Req $i: %{time_total}s\n" \
    "https://www.audiob2b.com.tr/api/health"
  sleep 2
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

```bash
source .env.tokyo
# Vercel panelinden:
#   DATABASE_URL  → TOKYO_POOLER_URL   (Transaction pooler — test edildi ✅)
#   DIRECT_URL    → TOKYO_DIRECT_URL   (Session pooler)
# vercel.json: "regions": ["hnd1"]
# ./deploy.sh origin/main  (~5 dk)
# .env: DATABASE_URL/DIRECT_URL → .env.tokyo değerlerine geri çevir
```

---

## Tokyo Projesinin Kapatılması (7 gün sonra, ayrıca onaylanacak)

Geçiş başarısından **7 gün sonra**, kullanıcı onayıyla:

```bash
source .env.tokyo

# Son yedek
pg_dump "$TOKYO_DIRECT_URL" \
  --format=custom --no-owner --no-privileges --schema=public \
  -f ~/Backups/audiob2b_tokyo_SHUTDOWN_$(date +%Y%m%d_%H%M).pgdump
chmod 600 ~/Backups/audiob2b_tokyo_SHUTDOWN_*.pgdump
```

1. Supabase Tokyo paneli: Settings → General → Pause project
2. 14 gün daha sorun çıkmazsa Tokyo projesini sil
3. `rm ~/Backups/audiob2b_tokyo_*.pgdump` (kişisel veri — saklama süresi doldu)
4. `.env.tokyo` sil

---

## Frankfurt Projesi Kurulum Kontrol Listesi

- [x] Bölge: eu-central-1 (Frankfurt) seçildi
- [x] Extension'lar açıldı: pgcrypto, uuid-ossp, pg_stat_statements
- [x] Pooler: Transaction mode, port 6543
- [ ] **Ağ kısıtlaması:** Supabase panel → Settings → Database → Network Restrictions; Tokyo'daki ayarın aynısı Frankfurt'a uygulandı
- [ ] **Free plan:** PITR yok — geçiş sonrası haftalık pg_dump zamanlaması ayrıca yapılacak
- [x] `.env.migration` dosyası dolduruldu, chmod 600
- [x] `.env.tokyo` oluşturuldu, chmod 600

---

## AŞAMA 2 KONTROL LİSTESİ — 11 Ekim Pazar 22:30

`[K]` = Claude çalıştırır · `[U]` = kullanıcının yapacağı adım · Sırayla, her onay beklenerek.

---

**22:15 — Ön hazırlık**
- [ ] `[U]` Vercel paneline giriş yapıldı, Production env sekmesi açık
- [ ] `[U]` Supabase Frankfurt paneline giriş yapıldı
- [ ] `[U]` Parola yöneticisi açık (Frankfurt DATABASE_URL/DIRECT_URL hazır)
- [ ] `[K]` `.env.tokyo` mevcut ve chmod 600 olduğu doğrulandı
- [ ] `[K]` Runbook son kez okundu

**22:30 — Hazırlık**
- [ ] `[K]` Tokyo bağlantısı son kontrol: `source .env.tokyo && psql "$TOKYO_DIRECT_URL" -c "SELECT COUNT(*) FROM public.\"User\";"`
- [ ] `[K]` Canlı TTFB taban: `/api/health` × 3 istek

**22:35 — Deploy 1: Bakım modu aç**
- [ ] `[U]` Vercel Production env → `MAINTENANCE_MODE=true` ekle
- [ ] `[K]` `./deploy.sh origin/main` (~4 dk)
- [ ] `[K]` POST → HTTP 503 + `retry-after: 300` doğrula
- [ ] `[K]` GET → `/api/health` engellenmedi doğrula

**22:40 — Son yedek + Frankfurt restore**
- [ ] `[K]` Son yedek (.env.tokyo'dan)
- [ ] `[K]` Korumalı script: host doğrula → DROP SCHEMA → CREATE SCHEMA → yetkiler (postgres + service_role)
- [ ] `[K]` `pg_restore ...`
- [ ] `[K]` COUNT(*) karşılaştırması (FARK sütunlu) — tüm tablolar 0 fark
- [ ] Onay bekle ✋

**22:55 — Deploy 2: Frankfurt env + fra1 + bakım kapat**
- [ ] `[U]` Vercel Production env: DATABASE_URL + DIRECT_URL → Frankfurt; MAINTENANCE_MODE kaldır
- [ ] `[K]` `vercel.json`: `"regions": ["fra1"]` commit
- [ ] `[K]` `./deploy.sh origin/main` (~4 dk)
- [ ] `[K]` `x-vercel-id` → Lambda `fra1` doğrula

**23:05 — DB kanıtı + QA doğrulama**
- [ ] `[U]` QA çalışan hesabıyla web'den favori ekle, kitap adını söyle
- [ ] `[K]` Frankfurt'ta kayıt var / Tokyo'da yok (ham çıktı)
- [ ] `[U]` Favoriyi web'den kaldır
- [ ] `[K]` QA admin giriş → kütüphane → rapor
- [ ] `[U]` Mobil: kütüphane + bir bölüm oynatma + senkron

**23:15 — Kapanış**
- [ ] `[K]` `.env` güncelle: DATABASE_URL/DIRECT_URL → Frankfurt (`.env.tokyo` silinmez)
- [ ] `[K]` CLAUDE.md güncelle: DB bölgesi Tokyo → Frankfurt

**Tokyo 7 gün ayakta kalır. `.env.tokyo` korunur. Pause ve silme ayrıca onaylanacak.**

**Geri dönüş (gerekirse, ilk 1 saat içinde):**
- [ ] `[U]` Vercel env → `.env.tokyo`'daki değerler (TOKYO_DATABASE_URL / TOKYO_DIRECT_URL)
- [ ] `[K]` `vercel.json`: `"regions": ["hnd1"]` + `./deploy.sh` (~5 dk)
- ⚠️ Deploy 2'den sonra yazılan veriler Tokyo'ya dönüşte kaybolur.

---

*Son güncelleme: 9 Ekim 2026*
