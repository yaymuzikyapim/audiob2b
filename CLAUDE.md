@AGENTS.md

## Veritabanı Migration Kuralı

Schema değişikliği yapıldığında deployment sırası:

1. **Önce migration**: `prisma migrate deploy` komutunu local'den çalıştır (DIRECT_URL ile, port 5432)
2. **Sonra kod deploy**: Vercel'e push et

`prisma migrate deploy` Vercel build'inde YOK — kasıtlı olarak kaldırıldı (Supabase pooler port 6543 üzerinde timeout yapıyordu).

## Prisma Config

- `DATABASE_URL` → Supabase pooler (port 6543) — uygulama bağlantısı
- `DIRECT_URL` → Supabase direct (port 5432) — migration'lar için

Her iki değişken de Vercel Environment Variables'a eklenmiş olmalı.

## Push Öncesi Kontrol Listesi

Push yapmadan önce her iki koşul sağlanmalı:

1. **`npm run build` yerelde temiz olmalı** — Vercel'de build'i kıran dosyalar (import edilip commit edilmemiş bileşenler vb.) yerelde de hata verir.
2. **`git status` temiz olmalı** — takip edilmeyen (untracked) dosya bırakılmamalı; her dosya ya commit edilmeli, ya silinmeli, ya da `.gitignore`'a eklenmeli.

## Canlı Ortam Doğrulaması

API testleri için `.env.local`'deki `TEST_USER_EMAIL` ve `TEST_USER_PASSWORD` kullanılır.
Bu hesap App Store incelemesinde de kullanıldığından **şifresi asla değiştirilmez**.
Şifre hiçbir komut çıktısında, logda veya sohbette yazdırılmaz.

## Güvenlik Kuralı — Kimlik Bilgisi / Şifre

**Şifre, token, API anahtarı veya herhangi bir giriş bilgisi asla sohbet çıktısına, echo/print komutlarına veya log dosyalarına yazılmaz.**

Ekran görüntüsü gerektiren görevler için kural:
1. Geçici hesabı `tmp-admin-screenshot-<timestamp>` adıyla oluştur — şifreyi script içinde üret, sohbete yazma
2. Giriş yap, görüntüleri al
3. Görüntü alındıktan hemen sonra hesabı DB'den sil, silindiğini `SELECT COUNT(*)` ile doğrula
4. Dev ve production aynı DB'yi kullandığından geçici hesaplar canlıda da geçerlidir — geciktirme yok

Bu kural `TEST_USER_PASSWORD` için de geçerlidir: değerini okuyabilirsin ama asla çıktıya yansıtma.

## Deneme Şirketleri Kısıtlaması

**review-company-001 ve TRIAL türündeki şirketler gerçek deneme kullanıcıları içerir: bu şirketlerde test yapılmaz, devre dışı bırakılmaz, kullanıcı eklenip çıkarılmaz. Testler için ayrı QA şirketi kullanılır.**

review-company-001'deki şu hesaplara şimdilik dokunma (kullanıcı kararı, 5 Ekim 2026):
- audiob2b.com.tr EMPLOYEE: App Store inceleme hesabı — şirket, rol, veri değiştirilmez
- iyzico.com EMPLOYEE: gerçek potansiyel müşteri — taşıma planı belirsiz
- ~49 kurumsal alan adlı EMPLOYEE (tümü giriş yapmamış): şimdilik olduğu gibi kalır

## Commit Kapsam Kuralı

**Bir commit'e sadece o işle ilgili dosyalar girer. İlgisiz veya commit edilmemiş kullanıcı dosyalarını commit'e ekleme; emin değilsen sor.**
