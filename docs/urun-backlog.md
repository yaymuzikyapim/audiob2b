# Ürün İş Listesi (Backlog)

Telif / dinleme verisi planı dışında kalan ürün riskleri ve işleri. Plana bağlı maddeler `docs/plans/dinleme-verisi-kesin-plan.md` içinde; içerik (katalog) işleri `docs/icerik-backlog.md` içinde.

Son güncelleme: 15 Ekim 2026

| # | Konu | Risk / etki | Durum | Not |
|---|---|---|---|---|
| U1 | **Pasif kullanıcı tekrar aktif yapılınca koltuk limiti kontrol edilmiyor** | Şirket, sözleşmedeki koltuk sayısını aşabilir; lisans ve faturalama tutarsızlığı | Açık | Aktifleştirme akışlarında (şirket yöneticisi paneli `toggle_active`, süper admin) `maxSeats` kontrolü eklenmeli; davet akışındaki kontrolle aynı kural kullanılmalı. Mevcut taşma: AudioB2B Demo 51 / 10 |
| U2 | **Davet e-postaları canlıda `davet@yayyapim.com` adresinden gidiyor olabilir** | Marka tutarsızlığı, SPF/DKIM uyumsuzluğu nedeniyle spam'e düşme riski | Doğrulanacak | Beklenen gönderen: `bildirim@audiob2b.com.tr`. Önce salt okuma: davet gönderen kodda ve Vercel `EMAIL_FROM` değerinde hangi adres kullanılıyor; Resend'de doğrulanmış alan adı hangisi |
| U3 | **Lisans bittikten sonra indirilen içerik, kullanıcı çıkış yapana kadar cihazda kalıyor ve dinlenebiliyor** | Telif ve müşteri sözleşmesi ihlali; yayıncı sözleşmesindeki "azami çevrimdışı süre" maddesi bu düzeltilmeden imzalanamaz | Planda | Dinleme verisi planı Adım 10 (K19: imzalı çevrimdışı lease, `expiresAt = min(...)`). Aşama 0 bulgusu: `lib/player.tsx:268,292,302` yerel dosyada ağ çağrısı yapmıyor |
| U4 | **Günlük temizlik görevi (cron) hiç çalışmıyor** | `CRON_SECRET` Vercel'de tanımlı değil → `/api/cron/cleanup` her gün 401 | İnceleniyor | Açmadan önce neyi sildiği salt okuma ile incelenecek |
| U5 | **Vercel Git entegrasyonu açık: `main`'e her push canlıya deploy** | "Deploy yalnızca onayla" kuralı pratikte işlemiyor | **Kapalı** | 15 Eki 2026 — Vercel project inspect çıktısında Git bağlantısı yok; deploy yalnızca `./deploy.sh origin/main` |
| U6 | **Canlı Supabase Free planda** | Otomatik günlük yedek yok; tek yedek elle alınanlar (`npm run backup:prod`) | Karar bekliyor | TPAO kullanmaya başlamadan önce Pro plan değerlendirilecek |
| U7 | **Geliştirme bilgisayarında FileVault kapalı** | Canlı yedekler ve `.env.prod` şifresiz diskte | Kullanıcı işi | Sistem Ayarları → Gizlilik ve Güvenlik → FileVault |
