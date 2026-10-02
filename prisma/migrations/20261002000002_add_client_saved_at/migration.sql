-- PlayerState: gerçek dinleme zamanını saklar (mobil saat).
-- NULL → eski kayıt; backfill ile updatedAt kopyalanır.
ALTER TABLE "PlayerState" ADD COLUMN "clientSavedAt" TIMESTAMP(3);

-- Mevcut kayıtları doldur: NULL bırakılırsa eski mobil kayıtlar
-- last-played sıralamasında boş-alanlı yeni kayıtların arkasına düşer.
UPDATE "PlayerState" SET "clientSavedAt" = "updatedAt" WHERE "clientSavedAt" IS NULL;
