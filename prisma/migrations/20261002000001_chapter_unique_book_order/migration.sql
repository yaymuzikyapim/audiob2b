-- Aynı kitapta aynı bölüm numarasının iki kez oluşmasını engeller.
-- ÖNEMLİ: Çalıştırmadan önce mevcut mükerrer kayıtlar temizlenmiş olmalı
-- (prisma/dedupe-chapters.mjs --yes), aksi halde bu migration hata verir.

CREATE UNIQUE INDEX "Chapter_bookId_order_key" ON "Chapter"("bookId", "order");
