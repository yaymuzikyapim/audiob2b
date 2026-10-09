# DB Taşıma Koşu Kitabı — Tokyo → Frankfurt (eu-central-1)

**Hazırlayan:** AudioB2B  
**Durum:** Aşama 1 (prova) tamamlanmamış  
**Hedef:** Supabase ap-northeast-1 (Tokyo) → eu-central-1 (Frankfurt)

---

## Ön Bilgi

| Bileşen | Şu an | Hedef |
|---|---|---|
| Supabase DB | ap-northeast-1 (Tokyo) | eu-central-1 (Frankfurt) |
| AWS S3 ses/görsel | eu-central-1 (Frankfurt) | Değişmez |
| Vercel Lambda | hnd1 (Tokyo) | fra1 (Frankfurt) |

**DB boyutu:** ~17 MB · 21 tablo · 19 Prisma migration  
**Supabase Storage:** Kullanılmıyor (0 obje)  
**pg_dump/pg_restore:** Yerel 18.6 → sunucu 17.6 (uyumlu; pg_dump yeni sürümler eski sunucu destekler)

---

## Bağlantı Bilgileri

Frankfurt bağlantı bilgileri `.env.migration` dosyasında tutulur (gitignore'da, repoya girmez).  
Kullanıcı bu dosyayı kendisi doldurur. **Değerler hiçbir komut çıktısında gösterilmez.**

```
# .env.migration (kullanıcı dolduracak — değerleri buraya yazmayın)
FRANKFURT_DATABASE_URL=
FRANKFURT_DIRECT_URL=
```

Dosyayı yüklemeden önce: `chmod 600 .env.migration`

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

## AŞAMA 1 — PROVA (gündüz, canlıya dokunmadan)

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
- Geçiş tarihinden 7 gün sonra silinir: `rm ~/Backups/audiob2b_tokyo_*.pgdump`

### Adım 2 — Frankfurt'a restore

```bash
source .env.migration   # FRANKFURT_DIRECT_URL'i yükle

# Frankfurt projesinde önce extension'ları aç (Supabase panel veya SQL):
# CREATE EXTENSION IF NOT EXISTS pgcrypto;
# CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
# CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

pg_restore \
  --dbname="$FRANKFURT_DIRECT_URL" \
  --no-owner \
  --no-privileges \
  --schema=public \
  ~/Backups/audiob2b_tokyo_$(date +%Y%m%d)*.pgdump
```

### Adım 3 — Doğrulama

```bash
# Tokyo satır sayıları
DIRECT_URL_TOKYO=$(grep "^DIRECT_URL=" .env | cut -d= -f2- | tr -d '"')
psql "$DIRECT_URL_TOKYO" -c \
  "SELECT relname, n_live_tup FROM pg_stat_user_tables ORDER BY relname;"

# Frankfurt satır sayıları (aynı sorgu)
source .env.migration
psql "$FRANKFURT_DIRECT_URL" -c \
  "SELECT relname, n_live_tup FROM pg_stat_user_tables ORDER BY relname;"

# Frankfurt RLS kontrolü
psql "$FRANKFURT_DIRECT_URL" -c \
  "SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='public' ORDER BY tablename;"

# Prisma migration durumu (migrate deploy ÇALIŞTIRMA)
DATABASE_URL="$FRANKFURT_DIRECT_URL" npx prisma migrate status
```

Beklenen: 21 tablonun tümünde satır sayıları eşleşmeli, RLS hepsi `t`, `migrate status` temiz.

### Adım 4 — Yerel okuma testi

`.env.local` dosyasında `DATABASE_URL` ve `DIRECT_URL`'yi geçici olarak Frankfurt değerleriyle değiştir.  
`npm run dev` ile çalıştır:

- QA admin girişi
- `/dashboard/library` yükleme
- `/dashboard/admin/reports` sayfası

**Yazma testi YAPMA.** Frankfurt prova verisi gece geçişinde silinip yeniden yüklenecek.

Test sonrası `.env.local`'i Tokyo değerlerine geri al.

### Adım 5 — Gece geçiş zamanı önerisi

Türkiye saatiyle **02:00–04:00** arası (düşük trafik).  
Prova başarılı ise kullanıcıya tarih öner ve onay al.

---

## AŞAMA 2 — GEÇİŞ (gece, kullanıcı onayıyla)

> **Vercel env değişikliği her zaman redeploy gerektirir.**  
> `MAINTENANCE_MODE` ayarı, `DATABASE_URL`/`DIRECT_URL` ve `regions` değişikliklerinin
> hepsi ayrı deploy ile yürürlüğe girer.
>
> **Gece akışının deploy sırası ve tahmini süreler:**
> 1. `MAINTENANCE_MODE=true` + `regions=["hnd1"]` (Tokyo) ile deploy → **~4 dk**
> 2. Son dump + Frankfurt restore + satır sayısı karşılaştırması → **~10-15 dk**
> 3. Frankfurt env (`DATABASE_URL`/`DIRECT_URL`) + `MAINTENANCE_MODE` kaldır + `regions=["fra1"]` ile deploy → **~4 dk**
>
> Toplam bakım penceresi: **~20-25 dk**  
> Frankfurt PostgreSQL sürümünü proje açılır açılmaz doğrula:  
> `psql "$FRANKFURT_DIRECT_URL" -c "SELECT version();"` → **17.x** olmalı (pg_dump 18.6 uyumlu).

### Adım 1 — Bakım modunu aç (Deploy 1)

Vercel panelinden `MAINTENANCE_MODE=true` ekle.  
`vercel.json` `regions` değeri `hnd1`'de kalır (Tokyo, mevcut DB ile aynı bölge).  
Commit gerekmez; yalnızca env değişikliği → Vercel otomatik redeploy başlatır (~4 dk).

Doğrulama:
```bash
curl -sv -X POST \
  "https://www.audiob2b.com.tr/api/dashboard/progress/sync" 2>&1 | \
  grep "< HTTP\|< retry-after"
# Beklenen: 503, retry-after: 300
```

### Adım 2 — Son yedek + Frankfurt restore

```bash
# Son yedek
DIRECT_URL_TOKYO=$(grep "^DIRECT_URL=" .env | cut -d= -f2- | tr -d '"')
pg_dump "$DIRECT_URL_TOKYO" \
  --format=custom --no-owner --no-privileges --schema=public \
  -f ~/Backups/audiob2b_tokyo_FINAL_$(date +%Y%m%d_%H%M).pgdump
chmod 600 ~/Backups/audiob2b_tokyo_FINAL_*.pgdump

# Frankfurt prova verisini temizle, yeniden restore
source .env.migration
psql "$FRANKFURT_DIRECT_URL" -c \
  "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

# Extension'ları yeniden aç (schema drop sonrası)
# CREATE EXTENSION IF NOT EXISTS pgcrypto;
# CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
# CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

pg_restore \
  --dbname="$FRANKFURT_DIRECT_URL" \
  --no-owner --no-privileges --schema=public \
  ~/Backups/audiob2b_tokyo_FINAL_*.pgdump

# Satır sayısı karşılaştırması
psql "$DIRECT_URL_TOKYO" -c \
  "SELECT relname, n_live_tup FROM pg_stat_user_tables ORDER BY relname;"
psql "$FRANKFURT_DIRECT_URL" -c \
  "SELECT relname, n_live_tup FROM pg_stat_user_tables ORDER BY relname;"
```

### Adım 3 — Frankfurt env + bölge değişimi + bakım modunu kapat (Deploy 2)

1. **Kullanıcı** Vercel panelinden production env değişkenlerini günceller:
   - `DATABASE_URL` → Frankfurt pooler (port 6543, transaction mode)
   - `DIRECT_URL` → Frankfurt direct (port 5432)
   - `MAINTENANCE_MODE` → kaldır (veya `false`)
2. `vercel.json`: `"regions": ["fra1"]` (commit + push)
3. `./deploy.sh origin/main` → **~4 dk**

Bu tek deploy ile üç değişiklik birden yürürlüğe girer: Frankfurt DB, fra1 Lambda, bakım modu kapalı.

### Adım 4 — Yerel `.env` güncelleme

`.env` dosyasında `DATABASE_URL` ve `DIRECT_URL`'yi Frankfurt değerlerine çevir (aksi halde sonraki geliştirme Tokyo'ya yazar).

### Adım 5 — Doğrulama

```bash
# Vercel region
curl -s -o /dev/null -w "x-vercel-id: %header{x-vercel-id}\n" \
  "https://www.audiob2b.com.tr/"

# QA admin TTFB (10 istek)
for i in $(seq 1 10); do
  curl -s -b /tmp/qa_cookies.txt -o /dev/null \
    -w "Req $i: %{time_total}s\n" \
    "https://www.audiob2b.com.tr/api/dashboard/library"
  sleep 5
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

### Adım 6 — Bakım modunu kapat

Vercel panelinden `MAINTENANCE_MODE` değerini kaldır veya `false` yap → Redeploy.

---

## Geri Dönüş Planı

1. Vercel panelinden `DATABASE_URL`/`DIRECT_URL` → Tokyo değerlerine geri al
2. `vercel.json`: `"regions": ["hnd1"]`
3. `./deploy.sh origin/main`
4. Yerel `.env`'i Tokyo'ya geri çevir
5. Beklenen süre: ~5 dakika

---

## Tokyo Projesinin Kapatılması

Geçiş başarısından 7 gün sonra, kullanıcı onayıyla:
1. Tokyo Supabase projesini salt okunur yap (Settings > General > Pause)
2. Yedek dosyaları sil: `rm ~/Backups/audiob2b_tokyo_*.pgdump`
3. 14 gün sorun çıkmazsa Tokyo projesini sil

---

## Frankfurt Projesi Kurulum Kontrol Listesi

- [ ] Bölge: eu-central-1 (Frankfurt) seçildi
- [ ] Extension'lar açıldı: pgcrypto, uuid-ossp, pg_stat_statements
- [ ] Pooler: Transaction mode, port 6543
- [ ] Ağ kısıtlaması: Vercel IP aralıkları eklendi (veya kapalı bırakıldı — Tokyo ile aynı)
- [ ] PITR/yedekleme: Pro plan ise etkin (Tokyo ile aynı tier)
- [ ] `.env.migration` dosyası dolduruldu, chmod 600

---

*Son güncelleme: Ekim 2026*
