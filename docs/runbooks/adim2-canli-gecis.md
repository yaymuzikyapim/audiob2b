# Adım 2 Canlı Geçiş Runbook'u

**Tarih:** 2026-10-17  
**Hazırlayan:** Adım 2 kapsamı (PlayHistory şema genişletme + validationStatus backfill)  
**Canlı SHA (geçiş öncesi):** `6b79e8f` (px94xrabg)  
**Hedef SHA:** `7b5f1cd` (origin/main, migration kapısı fix dahil)  
**Bekleyen migrasyon:** `20261017000001_adim2_play_history` (tek migrasyon)

---

## Ön Koşullar

- [ ] `npm run test:guards` yeşil (tüm guard testleri dahil adim2-route.test.mjs)
- [ ] `./deploy.sh origin/main --dry-run --from 6b79e8f` çıktısı onaylandı (⚠️ UYARI görüldü, beklenen)
- [ ] `DIRECT_URL` ortam değişkeni `.env.prod`'da mevcut (port 5432, RLS bypass)
- [ ] Vercel production URL erişilebilir durumda

---

## a) Backup Al

```bash
npm run backup:prod
```

Çıktıda tarih damgalı `.sql.gz` dosyasının oluştuğunu doğrula. Devam etmeden önce dosya boyutunun sıfırdan büyük olduğunu kontrol et.

```bash
ls -lh backups/ | tail -5
```

---

## b) Migrasyonu Uygula (Canlı DB)

`DIRECT_URL` gereklidir — `migrate deploy` RLS bypass olmadan `_prisma_migrations` tablosuna yazamaz.

```bash
node scripts/lib/prod-komut.mjs prisma migrate deploy
```

Beklenen çıktı:

```
1 migration found in prisma/migrations
Applying migration `20261017000001_adim2_play_history`
The following migration(s) have been applied:
  migrations/20261017000001_adim2_play_history/migration.sql
```

Hata alınırsa **deploy'a geçme**. `prisma migrate status` ile durumu kontrol et:

```bash
node scripts/lib/prod-komut.mjs prisma migrate status
```

---

## c) Deploy

```bash
DEPLOY_CONFIRM=7b5f1cd ./deploy.sh origin/main --from 6b79e8f
```

`DEPLOY_CONFIRM` tam 7 karakterdir (`7b5f1cd`). Vercel çıktısında `✅ Production deployment complete` benzeri bir satır bekle.

---

## d) Smoke Test

Deploy tamamlandıktan sonra:

1. **API erişilebilirlik:** `/api/dashboard/play-history` endpoint'ine ağ üzerinden erişilebilir olduğunu doğrula (herhangi bir mobil cihaz veya Postman ile 401/403 alınmalı, 500 alınmamalı).
2. **Prisma şema uyumu:** Yeni `ValidationStatus` enum'unun çalıştığını doğrulamak için aşağıdaki salt okunur sorguyu çalıştır:

```bash
ENV_FILE=.env.prod node scripts/lib/prod-komut.mjs node - <<'EOF'
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "dotenv";
config({ path: ".env.prod" });
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const c = await prisma.playHistory.count({ where: { validationStatus: null } });
console.log("NULL validationStatus:", c, "(backfill öncesi beklenen: ~225)");
await prisma.$disconnect();
EOF
```

Çıktı yaklaşık 225 olmalı (backfill henüz yapılmadı, bu beklenen durumdur).

---

## e) Backfill — Kuru Çalışma Önce

```bash
ENV_FILE=.env.prod DRY_RUN=1 node scripts/ops/2026-10-17-adim2-backfill.mjs
```

Beklenen çıktı:
- `NULL validationStatus: toplam=225, v1=137, v2=88`
- `Heuristic ... 18`, `Kanıt listesi × heuristic kesişimi: 18`
- `Sayı kontrolü geçti.`
- `[DRY RUN] Veritabanı değişmedi.`

Herhangi bir `HATA:` satırı görülürse **gerçek backfill'i çalıştırma**, sebep araştır.

### Gerçek Backfill

```bash
ENV_FILE=.env.prod node scripts/ops/2026-10-17-adim2-backfill.mjs
```

Beklenen çıktı:
```
Aşama 1 — SYNTHETIC: 18 satır güncellendi
Aşama 2 — LEGACY_V1: 137 satır güncellendi
Aşama 3 — LEGACY_V2: 70 satır güncellendi
✓ Backfill tamamlandı. Toplam güncellenen: 225
```

---

## f) Doğrulama Sorguları

```bash
ENV_FILE=.env.prod node scripts/lib/prod-komut.mjs node - <<'EOF'
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "dotenv";
config({ path: ".env.prod" });
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const counts = await prisma.playHistory.groupBy({
  by: ["validationStatus"],
  _count: { id: true },
  orderBy: { validationStatus: "asc" },
});
console.log("validationStatus dağılımı:");
for (const row of counts) {
  console.log(`  ${row.validationStatus ?? "NULL"}: ${row._count.id}`);
}

const nullRemaining = await prisma.playHistory.count({ where: { validationStatus: null } });
console.log("\nKalan NULL:", nullRemaining, nullRemaining === 0 ? "✓" : "⚠️ HATA");

await prisma.$disconnect();
EOF
```

Beklenen:
```
LEGACY_V1: 137
LEGACY_V2: 70
SYNTHETIC: 18
VALID: <yeni kayıtlar>
...
Kalan NULL: 0 ✓
```

---

## g) Rollback Planı

### Migrasyon Geri Alınamaz (Prisma Kısıtı)

Prisma `migrate deploy` geri alınamaz. Şema değişikliği (`ALTER TABLE`, yeni enum) canlı veritabanında kalır.

**Kod rollback'i** (şema uyumlu):

```bash
npx vercel rollback px94xrabg
```

`px94xrabg` = `6b79e8f` — geçiş öncesi canlı deployment. Not: `route.ts`'nin eski sürümü `validationStatus` alanını doldurmaz ama alanın var olması bir sorun yaratmaz (NULL kabul eder).

**Veri rollback'i** (backfill geri alma, sadece gerekirse):

```bash
ENV_FILE=.env.prod node - <<'EOF'
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "dotenv";
config({ path: ".env.prod" });
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const r = await prisma.playHistory.updateMany({
  where: { validationStatus: { in: ["LEGACY_V1", "LEGACY_V2", "SYNTHETIC"] } },
  data: { validationStatus: null },
});
console.log("Geri alındı:", r.count);
await prisma.$disconnect();
EOF
```

---

## h) Canli-İşlem-Kaydı Güncelle

`docs/runbooks/canli-islem-kaydi.md` dosyasına geçiş kaydı ekle:

```
### Adım 2 Canlı Geçiş — 2026-10-17
- Migrasyon: 20261017000001_adim2_play_history uygulandı
- Deploy: 6b79e8f → 066f82a
- Backfill: 225 satır (SYNTHETIC=18, LEGACY_V1=137, LEGACY_V2=70)
- Durum: ✓ Tamamlandı
```

---

## i) Kapanış Kontrolleri

- [ ] `prisma migrate status` → `Database schema is up to date!`
- [ ] `/api/dashboard/play-history` → 401 (giriş gerekmez, 500 yok)
- [ ] `PlayHistory.count({ where: { validationStatus: null } })` → 0
- [ ] `PlayHistoryReject` tablosu erişilebilir (yeni tablo, içerik sıfırdan başlar)
- [ ] Mobil uygulamadan bir dinleme kaydı gönderildiğinde `validationStatus` doluyor mu? (opsiyonel manuel test)
- [ ] Adım 2 backlog maddesini `docs/urun-backlog.md`'de `✓ canlıda` olarak işaretle

---

## Özet

| Adım | İşlem | Geri Alınabilir |
|------|-------|-----------------|
| a | Backup | — |
| b | `prisma migrate deploy` | Hayır (şema kalıcı) |
| c | Deploy `7b5f1cd` | Evet (`npx vercel rollback px94xrabg`) |
| d | Smoke test | — |
| e | Backfill (225 satır) | Evet (g adımı ile) |
| f | Doğrulama | — |
| g | Rollback (gerekirse) | — |
| h | Kayıt güncelle | — |
| i | Kapanış | — |
