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
