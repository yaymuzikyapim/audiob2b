# Dinleme Verisi ve Telif Altyapısı — Kesin Uygulama Planı (Sürüm 2.1)

**Tarih:** 14 Ekim 2026
**Dayanak:** Aşama 0 inceleme paketi + dört bağımsız inceleme (İnc. 1: GPT paket incelemesi, İnc. 2: ikinci paket incelemesi, İnc. 3 ve İnc. 4: kesin plan incelemeleri) + ikinci kontrolcü değerlendirmesi.
**İlke:** Her adım önce geliştirme veritabanında denenir. Canlıya yalnızca açık onayla ve `./deploy.sh origin/main` ile çıkar. Geri alma = ileri düzeltme; veri yazılmaya başlamış kolon, geri alma amacıyla silinmez.

**Sürüm 2'de değişenler:** Geri yükleme testi geliştirme ortamından ayrıldı (K0). Şirket bilgisinin kökeni artık ayrı bir alanda (K3). Tek bir doğrulama durumu alanı geldi (K8, K10). Erişim kontrolü ikiye bölündü: oynatma izni ve geç kayıt kabulü (K12). Kitabın pasife alındığı an kaydediliyor (K13). Mükerrer kitap birleştirme denetimli (K13). "Anonimleştirme" yerine "takma ad" (K14). Çevrimdışı izin süresi ile geç kayıt kabul penceresi ayrıldı (K6, K19). Mobil kuyruk kullanıcı oturumuna bağlandı (K18). K23 eklendi; test listesi ve yayın formu geldi.

**Sürüm 2.1'de değişenler:** companyId alanının boş bırakılabildiği açıkça yazıldı (K5). Erişim kontrolü tek sorguyla ve önbelleksiz yapılacak (K12). Ses dosyasının yeniden yüklenmesi tamamen yasaklanmak yerine toleransla ve sürüm anlık görüntüsüyle serbest bırakıldı (K15). Mobilde `crypto.randomUUID` kullanımı yasaklandı (K18). Monoton saat, içerik süresine değil gerçek geçen süreye göre ilerliyor (K19). Şirket türü formda zorunlu (Adım 6).

---

## 1. Kesinleşen kararlar

| # | Konu | Karar | Kaynak |
|---|---|---|---|
| K0 | Ortamlar | İki ayrı ortam: (a) **geri yükleme testi**, kullanıcının Mac'inde yerel, geçici bir Postgres'e (test bitince silinir, silme kayda alınır); (b) **geliştirme DB'si** (Supabase, Frankfurt), yalnızca şema + katalog (kişisel veri içermeyen tablolar) + sentetik kullanıcı/şirket. Canlı kişisel veri geliştirme DB'sine girmez. Geliştirme ortamı S3'e salt okuma IAM anahtarıyla bağlanır + `S3_DELETE_DISABLED=true`. Yerel `.env` geliştirme DB'sini gösterir; canlıya yazan scriptler prod korumasına takılır | İnc. 3 + Claude |
| K1 | `receivedAt` eski kayıtlar | NULL. Kolon nullable eklenir; yeni kayıtta sunucu katmanı zorunlu olarak yazar; yeni satırda NULL çıkarsa hata logu | İnc. 1 + 2 + 3 |
| K2 | Zaman tipi | Mevcut şemayla tutarlı `TIMESTAMP(3)`, UTC kuralı yazılı. Gün/ay sınırları Europe/Istanbul'a göre hesaplanır. `timestamptz` geçişi ayrı, tek seferlik karar | Claude |
| K3 | companyId kökeni | Ayrı alan: `companyIdSource` = `SERVER_AT_EVENT` / `BACKFILL_CURRENT_USER`. Geri doldurma, sabit bir başlangıç anında (watermark) belirlenen aday kümeye uygulanır; doğrulama bu kümeye göre yapılır. Satır düzeyinde uyuşmazlık sorgusu DB içinde çalışır (dışa aktarım yok). Geri doldurulan atıflar "tarihi doğrulanmamış" etiketiyle raporlanır | İnc. 1 + 3 |
| K4 | Yeni kayıtta şirket | Sunucu, auth-guard'ın doğruladığı aktif şirketten yazar; istemciden companyId kabul edilmez | İnc. 1 |
| K5 | companyId FK | Kolon **nullable**; FK `ON DELETE RESTRICT` (Postgres FK yalnızca dolu değerleri denetler). Şirketsiz kullanıcının kaydı yazılır, `companyId` NULL kalır; telif hesabına girmez | İnc. 1 + 4 |
| K6 | Zaman penceresi | Gerçek dinleme anı `playedAt`'e, ulaşma anı `receivedAt`'e. Gelecek tarihli (> now + 5 dk) → red + sayaç. **Kabul penceresi** (geç gelen kayıt) ayrı bir parametredir ve çevrimdışı izin süresinden uzun olmalıdır. Pencere içi → normal doğrulama. Pencere dışı → silinmez, `QUARANTINED_LATE` olarak saklanır. Sessiz `now()` yazımı kalkar | Claude + İnc. 3 |
| K7 | Ret sayacı | `PlayHistoryReject` (sebep, gün, platform, istemci sürümü, adet; kişisel veri yok). Yazma hatası isteği bozmaz; yapılandırılmış hata logu düşer | İnc. 1 + Claude |
| K8 | Doğrulama durumu | Her kayıtta tek alan `validationStatus`: `VALID` / `SYNTHETIC` / `INVALID_V2_NO_CONTENT` / `QUARANTINED_LATE` / `QUARANTINED_ACCESS` / `LEGACY_V1`. Telif ve "geçerli dinleme" raporları yalnızca `VALID`'i sayar. Raporlar "alınan / geçerli / telife giren" ayrımını korur | İnc. 3 + Claude |
| K9 | Sürüm alanları | `platform`, `appVersion`, `buildNumber`, `runtimeVersion`, `updateId` ayrı | İnc. 1 |
| K10 | Sentetik 18 kayıt | Silinmez; `validationStatus = SYNTHETIC` (kanıt listesiyle: saat 19:23:53 UTC, 100'e bölünen süre, clientId/chapterId NULL, AudioB2B QA) | İnc. 1 + 2 + 3 |
| K11 | Şirket sınıflandırması | İki eksen: `commercialStatus` (PAID / TRIAL / FREE / UNKNOWN) ve `tenantPurpose` (CUSTOMER / DEMO / QA / REVIEW / INTERNAL / UNKNOWN). Varsayılan UNKNOWN; UNKNOWN rapor ve telif dışı. Beş şirket ürün sahibiyle tek tek sınıflanır. `isDemo` tek kaynaktan türetilir; tüm okuyucular geçince kaldırılır | İnc. 1 |
| K12 | Erişim kontrolü (ikiye bölündü) | `canStartPlayback(user, book, now)`: kitap aktif, pakette, şirket/lisans şu an geçerli. Liste, detay, audio-url, listen, favorites, player-state, bookmarks bunu kullanır. `canSubmitPlayHistory(user, book, event)`: olay anında kitap aktif mi (`inactiveSince` > olay anı), şirket o an geçerli mi, olay kabul penceresinde mi; lease geldikten sonra lease'e de bakar. Geçerli → `VALID`, değilse `QUARANTINED_ACCESS` (silinmez). Her ikisi de tek, indeksli bir JOIN sorgusuyla; şirket durumu auth-guard'dan gelir; önbellek yok (iptali geciktirir) | İnc. 3 + İnc. 1 + 2 + 4 |
| K13 | Kitap pasife alma ve silme | Arşiv = `Book.isActive = false` + **yeni `Book.inactiveSince`** (K12 için zorunlu). Admin "Sil" → "Yayından kaldır". Mükerrer kitap: önce eşleştirme raporu (metadata, süre, bölüm sırası/süresi, ses hash, hak sahibi, dinleme sayısı). Yalnızca doğrulanmış eşdeğer çiftler birleştirilir; chapterId eşlenir; `BookMergeAudit` (mergedFromBookId, işlem kimliği, önce/sonra sayım). Belirsiz çiftler arşivlenir, silinmez. **RESTRICT en son** | İnc. 1 + 2 + 3 |
| K14 | Kullanıcı silme | Fiziksel silme yok. Talep olursa **takma ad işlemi** (pseudonimleştirme): e-posta, ad, şifre, push token temizlenir; satır ve PlayHistory kalır. Bu işlem "anonimleştirme" diye adlandırılmaz. Kullanıcı bağının PlayHistory'den tamamen koparılması, saklama süreleri ve imha kayıtları avukat / KVKK uzmanıyla belirlenir | İnc. 2 + 3 |
| K15 | Ses sürümü | Dinleme kaydı olan kitapta yeniden yükleme: bölüm sayısı aynı ve her bölümün süresi ±1 sn / ±%1 içindeyse serbest. Değilse SUPER_ADMIN'in açık onayı gerekir ve yüklemeden önce eski bölüm listesi (id, sıra, süre, s3Key) `BookAudioVersion` kaydına anlık görüntü olarak yazılır. Tam değişmez ses sürümü modeli ilk dış yayıncıdan önce zorunlu | Claude + İnc. 4 |
| K16 | Web istemci | Mevcut (doğrulandı, `AudioPlayer.tsx:111`): beforeunload'da `fetch keepalive`. **Yeni:** 60 sn periyodik gönderim (yalnızca oynarken); dilim başına bir kez üretilen sabit `clientId`; `listenedAt`; `pagehide` / `visibilitychange`'de son dilim gönderimi; periyodik gönderim ile kapanış gönderiminin aynı dilimi farklı kimlikle göndermemesi | İnc. 1 + 3 + Claude |
| K17 | Sunucu idempotency | Aynı `clientId` + aynı içerik → başarılı (yok sayılır). Aynı `clientId` + farklı içerik → ilk kayıt korunur, `id_conflict` sayacı. DB düzeyinde test | İnc. 1 + 2 |
| K18 | Mobil kuyruk | expo-file-system; promise-zinciri mutex; geçici dosya + rename; bozuk dosya `.corrupted`; ACK gelmeden silinmez; hata sınıfları (401 / 429 / 5xx / ağ → tekrar; kalıcı doğrulama hatası → sınırlı deneme sonra inceleme dosyası); azami boyut. **Her öğe, olayı üreten kullanıcı oturumuna bağlı;** başka hesapla girişte gönderilmez, aynı hesap dönünce devam eder; çıkışta tanımlı politika. `version: "1.0.6"` korunur (OTA). **UUID:** mobilde hâlihazırda kullanılan üreteç kullanılır; `crypto.randomUUID()` çağrılmaz, yeni native modül eklenmez | İnc. 1 + 2 + 3 + 4 |
| K19 | Çevrimdışı izin (lease) | Sunucu imzalı, kısa ömürlü: `expiresAt = min(şirket erişim sonu, kitap hak sonu / planlı kaldırma tarihi, son doğrulama + çevrimdışı izin süresi)`. Kitap başına iptal listesi. Monoton alt sınır = son sunucu zamanı + **gerçek geçen oynatma süresi (listenedSec, içerik süresi değil)**, küçük tolerans. İmza = bütünlük, koruma değil. Çevrimdışı cihazda anlık iptal mümkün değildir; bu sınır sözleşmede yazılır. Kilitleme ve silme ayrı kararlar | İnc. 1 + 2 + 3 |
| K20 | Şifreleme | Şimdilik yok (platform sandbox). Düz MP3 ve iOS yedeği riski, yayıncı sözleşmesi ve tehdit modeliyle birlikte kabul ya da red kararı | Claude + İnc. 2 + 3 |
| K21 | Ölçüm dili | "İstemci tarafından bildirilen, doğrulama kurallarından geçen içerik dakikası" | İnc. 1 |
| K22 | Eşik kalibrasyonu | 30 sn, G ve diğer eşikler yalnızca `VALID` pilot verisiyle | İnc. 1 + 2 |
| K23 | Planlı yayından kaldırma | Acil olmayan kaldırmada kitaba kaldırma tarihi + sebep (varsayılan en az 30 gün). Kitap kartı, kitap sayfası ve oynatıcıda "X tarihine kadar dinlenebilir" rozeti; isteğe bağlı öneri / yeni çıkanlar listelerinden çıkarma. Aktif dinleyicilere (son 60 gün dinleyen, yarıda bırakan, favoriye ekleyen, indiren) push + uygulama içi bildirim: duyuru, 7 gün kala, 1 gün kala. Şirket yöneticisi panelinde "yakında kaldırılacaklar". Kaldırma günü `canStartPlayback` ve lease otomatik kapatır; o güne kadarki çevrimdışı dinlemeler `canSubmitPlayHistory` ile kabul edilir. Hak ihlalinde anında kaldırma ayrı akış. Yayıncı sözleşmesinde en az 30 gün bildirim; müşteri sözleşmesinde katalog değişikliği maddesi | Ürün sahibi |

---

## 2. Adımlar ve çıkış kapıları

| Adım | İçerik | Dağıtım | Çıkış kapısı |
|---|---|---|---|
| **0** | Geliştirme DB'si (şema + katalog + sentetik) · yerel `.env` → geliştirme · S3 salt okuma + silme kapalı · prod koruması · canlı yedek (repo dışı, chmod 600, şifreli) · yerel geçici Postgres'te geri yükleme testi | — | Geri yükleme: 21 tablonun sayımları + FK / unique / index doğrulaması + uygulama yerel kopyada açılıyor; süre kaydedildi; geçici kopya silindi (kayıt). Geliştirme: yerel uygulama dev'e bağlı, canlı kişisel veri yok, S3 silme denemesi engellendi, prod koruması bir yıkıcı scripti durdurdu |
| **1** ✅ | 18 sentetik kaydın kanıt listesi · beş şirketin sınıflandırma kararı (ürün sahibi) | — (karar) | **GEÇTİ 2026-10-17.** Liste ve sınıflandırma yazılı (bkz. §6 Adım 1 Kapatma Kaydı) |
| **2** | A1 + A3: nullable `receivedAt`, `companyId` (FK RESTRICT) + `companyIdSource`, sürüm alanları, `validationStatus`, `PlayHistoryReject`, `Book.inactiveSince`; K6 / K7 / K8 / K17 sunucu davranışı; sentetik ve v1 kayıtların durum işaretlemesi | WEB | Dev'de test listesinin "zaman ve sınır" + "idempotency" bölümleri geçiyor; eski kayıtlar `receivedAt` NULL; yeni kayıtlarda NULL yok; 18 kayıt SYNTHETIC; raporların öncesi/sonrası farkı kayıtlı |
| **3** | companyId geri doldurma (watermark kümesi) + satır düzeyinde uyuşmazlık sorgusu | Script (onaylı) | Aday kümenin tamamı dolu ve `BACKFILL_CURRENT_USER`; uyuşmazlık 0 ya da her biri sınıflandırılmış |
| **4** | Erişim: `canStartPlayback` ve `canSubmitPlayHistory` (K12) | WEB | Pasif kitap: yeni oynatma tüm uçlarda reddediliyor; pasife alınmadan önceki tarihli geç kayıt `VALID`, sonrası `QUARANTINED_ACCESS`; aktif kitap etkilenmiyor |
| **5** | Silme: "Yayından kaldır" · mükerrer kitap eşleştirme raporu + denetimli birleştirme · K15 yükleme toleransı + sürüm anlık görüntüsü · **sonra** PlayHistory FK'leri RESTRICT (ayrı deploy) | WEB | Dinlemesi olan kitap silinemiyor (anlamlı mesaj); belirsiz çiftler arşivde; birleştirme audit kaydı var |
| **6** | D1: `commercialStatus` + `tenantPurpose`, admin ekranı, `isDemo` türetme | WEB | Oluşturma / düzenleme formunda iki alan zorunlu, UNKNOWN seçeneği yok; Genel Bakış'ta UNKNOWN şirket uyarısı; raporlar beklenen kümeyi gösteriyor; fark raporu |
| **7** | A4: raporlar `PlayHistory.companyId` + `validationStatus` + şirket türüyle | WEB | Pasif kullanıcı geçmişi raporda kalıyor; eski/yeni farkı belgelenmiş |
| **8** | B1 web istemci (K16) | WEB | 3 dk dinleme → 3 dilim, sabit kimlikler; sekme kapatma / arka plan; periyodik + kapanış çakışması → tek satır |
| **9** | B2 mobil kalıcı kuyruk (K18) | OTA (1.0.6) | Uçak modu + force-quit + yeniden açılış → kayıp yok; bozuk dosya; çıkış / başka hesapla giriş → yanlış hesaba gönderim yok |
| **10** | C1 çevrimdışı lease (K19): sunucu, sonra istemci | WEB + OTA | Test listesinin "çevrimdışı lisans" bölümü gerçek iOS / Android'de geçiyor |
| **10b** | K23 planlı yayından kaldırma | WEB + OTA | Rozet; hedef kitleye 3 bildirim; tarih geçince oynatma ve lease kapanıyor; o tarihe kadarki çevrimdışı dinlemeler kabul ediliyor |
| **11** | C2 (gerekirse) | SÜRÜM | Tehdit modeli kararı |

---

## 3. Test listesi (çıkış kapılarında kullanılır)

**Zaman ve sınır:** 5 sn alt sınırı ve 3.600 sn üst sınırı (tam sınır değerleri); +5 dk gelecek toleransı; kabul penceresinin iki yanı; Europe/Istanbul gün ve ay geçişi; çevrimdışı izin süresinin iki yanı. Her ret ya da karantina için beklenen sayaç ve durum.

**Idempotency ve eşzamanlılık:** Aynı clientId ile eşzamanlı iki istek (aynı içerik / farklı içerik); zaman aşımı sonrası tekrar; web periyodik + pagehide aynı son dilim; mobil ACK kaybı. İlk kaydın korunduğu DB düzeyinde doğrulanır.

**Erişim ve geç kayıt:** Hak bitti, sonra cihaz çevrimiçi oldu; kitap pasife alındıktan sonra eski tarihli kayıt; şirket süresi bittikten sonra eski tarihli kayıt.

**Çevrimdışı lisans:** Oynatma sırasında lease bitişi; uygulama arka plandayken bitiş; saat geri / ileri; cihaz yeniden başlatma; secure storage yedeği / geri yükleme; hesap değiştirme; kitap iptali (çevrimiçi / çevrimdışı); yeniden kurulum.

**Mobil OTA güvenliği:** OTA paketi gerçek iOS ve Android cihazda (Hermes) açılıyor; yeni native modül yok; UUID üretimi çalışıyor.

**Migration kabulü:** Eski mobil / web sürümlerinden gelen istekler; yeni kolonları bilmeyen eski API örneği (rolling deploy); geri doldurma sırasında eşzamanlı yeni kayıt; veri yazıldıktan sonra ileri düzeltme provası.

---

## 4. Yayın formu (her canlı adımda doldurulur)

Commit / ref · migration adı · onaylayan · ön sayım sorguları ve sonuçları · son sayım sorguları ve sonuçları · hata eşiği (neyi görürsek durduruyoruz) · gözlem süresi · ileri düzeltme planı.

---

## 5. Karar bekleyen konular (ürün sahibi)

1. ~~Beş şirketin iki eksenli sınıflandırması~~ → **Karara bağlandı 2026-10-17 (bkz. §6).**
2. Çevrimdışı izin süresi (taslak 30 gün) ve geç kayıt kabul penceresi (taslak 45 gün).
3. Lease bitişinde: yalnızca kilit mi, X gün sonra silme mi?
4. Kullanıcı silme talebi politikası ve saklama süreleri (avukat).
5. A4 sonrası rapor değişikliği müşteriye bildirilecek mi?

---

## 6. Adım 1 Kapatma Kaydı (2026-10-17)

### 18 Sentetik kayıt — tanımlayıcı özellikler (canlıdan doğrulandı)

Koşul: `clientId IS NULL AND chapterId IS NULL AND listenedSec % 100 = 0`
→ 18 satır (aynı 18 satır saat 19:23 UTC'de `clientId IS NULL` koşuluyla da bulundu).
`validationStatus = SYNTHETIC` olarak işaretlenecek; silinmeyecek (K10).

### Şirket sınıflandırma kararları (ürün sahibi, 2026-10-17)

| Şirket | id (kısaltılmış) | commercialStatus | tenantPurpose | Not |
|---|---|---|---|---|
| TPAO Sunum (Demo) | cmss0ak… | `FREE` | `DEMO` | Sunum ortamı |
| AudioB2B Demo | review-company-001 | `FREE` | `REVIEW` | App Store inceleme + karışık kullanıcılar; ayrıştırma U11 (gerçek demo talebi gelince) |
| TPAO A.Ş. | cmbyjva… | `FREE` | `DEMO` | isDemo=true kararla tutarlı; sözleşme imzalanınca `PAID`/`CUSTOMER` — geçiş tarihi o an kaydedilecek |
| AudioB2B QA | cmbqr6l… | `FREE` | `QA` | İç test ortamı |

YAY Deneme 2026-10-16'da silindi; şirket sayısı 4. `UNKNOWN` değerli satır kalmadı.

**isDemo türetme kuralı (Adım 6'da uygulanacak):** `tenantPurpose IN ('DEMO', 'REVIEW')` → `isDemo = true`; geri kalanlar `false`. Mevcut değerlerle tutarlı.

### Adım 0 durumu

Adım 0 çıkış kapısı bu planda ayrıca belgelenmemiş; Adım 1'in doğrulanabilir olması Adım 0'ın fiilen geçildiğini gösteriyor.
