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
