/*
  HUKUK DANIŞMANI İNCELEME NOTLARI (yayına alınmadan önce netleştirilecek):
  1. Veri Sorumlusu / Veri İşleyen: Kurumsal çalışan verileri bakımından işverenin (müşteri şirketin) veri sorumlusu, AudioB2B'nin veri işleyen sıfatı teyit edilmelidir.
  2. Yurt Dışı Aktarım (KVKK m.9): ABD ve AB sağlayıcılarına aktarım için uygulanacak hukuki mekanizma (Standart Sözleşme / Açık Rıza) netleştirilmelidir.
  3. Saklama Süreleri: Demo talepleri ve sözleşme bitimi sonrası saklama süreleri şirket politikasına göre onaylanmalıdır.
  4. İlgili Kişi Başvuruları (KVKK m.11): Çalışanların doğrudan işverenlerine mi yoksa AudioB2B'ye mi başvuracağı netleştirilmelidir.
*/

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Gizlilik Politikası ve Aydınlatma Metni — AudioB2B",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-gray-950 text-gray-300">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold text-white mb-2">
          Gizlilik Politikası ve Aydınlatma Metni
        </h1>
        <p className="text-gray-500 text-sm mb-10">Son güncelleme: Ekim 2026</p>

        <section className="space-y-8 text-sm leading-relaxed">
          <div>
            <h2 className="text-white font-semibold text-base mb-2">
              1. Veri Sorumlusu ve Veri İşleyen Sıfatı
            </h2>
            <p className="mb-2">
              6698 sayılı Kişisel Verilerin Korunması Kanunu (&ldquo;KVKK&rdquo;) kapsamında:
            </p>
            <ul className="list-disc list-inside space-y-1 text-gray-400">
              <li>
                <b>Web sitesi demo talepleri bakımından:</b> Veri sorumlusu, Kavaklıdere Mah. Konur Sokak No:52/12 Çankaya/Ankara adresinde mukim <b>YAY Prodüksiyon Yapım Müzik Film Organizasyon Reklam İç ve Dış Ticaret Limited Şirketi</b>&apos;dir (&ldquo;AudioB2B&rdquo;).
              </li>
              <li>
                <b>Kurumsal müşterilerin çalışan verileri bakımından:</b> Platformu çalışanlarına sunan <b>işveren (müşteri şirket) Veri Sorumlusu</b>; AudioB2B ise hizmet sözleşmesi kapsamında bu verileri işleyen <b>Veri İşleyen</b> konumundadır.
              </li>
            </ul>
          </div>

          <div>
            <h2 className="text-white font-semibold text-base mb-2">
              2. İşlenen Kişisel Veriler
            </h2>
            <ul className="list-disc list-inside space-y-1 text-gray-400">
              <li>
                <b>Demo Talepleri:</b> Ad, soyad, iş e-postası, şirket adı, telefon numarası, çalışan sayısı ve mesaj içeriği.
              </li>
              <li>
                <b>Kullanıcı Hesap Verileri:</b> Ad, soyad, kurumsal e-posta adresi, şirket bilgisi ve tek yönlü parola karması (bcrypt).
              </li>
              <li>
                <b>Kullanım Verileri:</b> Oturum açma tarihleri, dinlenen kitaplar, dinleme süreleri ve favoriler. Müşteri şirketin yöneticileri, çalışan bazında yalnızca özet kullanım bilgilerini (toplam dinleme süresi, dinlenen kitap sayısı, son dinleme tarihi, ortalama ilerleme) görebilir; hangi çalışanın hangi kitabı dinlediği yöneticilere gösterilmez.
              </li>
              <li>
                <b>Teknik Veriler ve Çerezler:</b> IP adresi, sistem erişim logları ve mobil bildirim izinlerine bağlı anlık bildirim belirteci (push token). Şifre sıfırlama ve değiştirme işlemlerinde güvenlik amacıyla IP adresi ve tarayıcı bilgisi kaydedilir. Platformda yalnızca oturumun sürdürülmesi için zorunlu bir teknik çerez (audiob2b_session, 30 gün) kullanılır. Analitik, reklam veya hedefleme çerezi ya da aracı kullanılmaz.
              </li>
            </ul>
          </div>

          <div>
            <h2 className="text-white font-semibold text-base mb-2">
              3. Veri İşleme Amaçları ve Hukuki Dayanaklar
            </h2>
            <p className="mb-2">Kişisel verileriniz KVKK&apos;nın 5. maddesi uyarınca şu dayanaklarla işlenir:</p>
            <ul className="list-disc list-inside space-y-1 text-gray-400">
              <li>
                <b>Demo taleplerinin yanıtlanması ve teklif sunulması:</b> Bir sözleşmenin kurulması veya ifasıyla doğrudan doğruya ilgili olması.
              </li>
              <li>
                <b>Platform hizmetlerinin yürütülmesi, lisans kontrolü ve performansın iyileştirilmesi:</b> Sözleşmenin ifası ve meşru menfaat.
              </li>
              <li>
                <b>Servis güvenliği ve kötüye kullanımın engellenmesi (IP hız sınırı):</b> Meşru menfaat ve hukuki yükümlülüklerin yerine getirilmesi.
              </li>
            </ul>
          </div>

          <div>
            <h2 className="text-white font-semibold text-base mb-2">
              4. Yurt Dışı Veri Aktarımı ve Hizmet Sağlayıcılar
            </h2>
            <p className="mb-2 text-white font-medium">
              Kişisel verileriniz üçüncü taraflara satılmaz ve pazarlama amacıyla paylaşılmaz.
            </p>
            <p className="mb-2">
              Hizmetin teknik altyapısının işletilmesi ve iletişimin sağlanması amacıyla verileriniz yurt dışında yerleşik sunucularda işlenmektedir:
            </p>
            <ul className="list-disc list-inside space-y-1 text-gray-400">
              <li>
                <b>Resend (ABD):</b> Demo bildirimi ve davet e-postalarının iletimi.
              </li>
              <li>
                <b>Vercel Inc. (ABD / Küresel Dağıtım):</b> Web uygulaması barındırma ve sunucusuz fonksiyonların çalıştırılması.
              </li>
              <li>
                <b>Expo / 650 Industries Inc. (ABD):</b> Mobil cihazlara anlık bildirim iletimi.
              </li>
              <li>
                <b>Apple (APNs) ve Google (Firebase Cloud Messaging):</b> Expo üzerinden iletilen anlık bildirimlerin cihazlara ulaştırılması.
              </li>
              <li>
                <b>Supabase Inc. & AWS (Frankfurt, Almanya / AB):</b> Veritabanı ve dosya depolama altyapısı.
              </li>
            </ul>
          </div>

          <div>
            <h2 className="text-white font-semibold text-base mb-2">
              5. Saklama Süreleri ve Güvenlik
            </h2>
            <p className="mb-2">
              Verileriniz TLS/HTTPS şifreli protokoller üzerinden iletilir. Parolalar bcrypt ile korunur.
            </p>
            <ul className="list-disc list-inside space-y-1 text-gray-400">
              <li>
                <b>Demo Talepleri:</b> Ticari iletişim ve değerlendirme süreçleri kapsamında azami 2 yıl süreyle saklanır.
              </li>
              <li>
                <b>Kullanıcı ve Dinleme Verileri:</b> Kurumsal müşteri ile yürütülen sözleşme süresince ve sözleşmenin sona ermesini takiben yasal zamanaşımı süreleri boyunca saklanır.
              </li>
              <li>
                <b>Güvenlik kayıtları (şifre işlemleri):</b> IP adresi ve tarayıcı bilgisi 1 yıl sonunda silinir; işlemin türü ve tarihi kaydı tutulmaya devam eder.
              </li>
            </ul>
          </div>

          <div>
            <h2 className="text-white font-semibold text-base mb-2">
              6. Hesap Silme Talepleri ve İlgili Kişinin Hakları (KVKK Madde 11)
            </h2>
            <p className="mb-2">
              <b>Hesap Silme ve Dışa Aktarma:</b> Kullanıcılar veya kurumlar, hesaplarının ve ilişkili verilerinin silinmesini veya dışa aktarılmasını talep etmek için başvuru adresimiz üzerinden bizimle iletişime geçebilir.
            </p>
            <p className="mb-2">
              KVKK&apos;nın 11. maddesi uyarınca herkes veri sorumlusuna başvurarak kendisiyle ilgili:
            </p>
            <ul className="list-disc list-inside space-y-1 text-gray-400">
              <li>Kişisel veri işlenip işlenmediğini öğrenme,</li>
              <li>Kişisel verileri işlenmişse buna ilişkin bilgi talep etme,</li>
              <li>Kişisel verilerin işlenme amacını ve bunların amacına uygun kullanılıp kullanılmadığını öğrenme,</li>
              <li>Yurt içinde veya yurt dışında kişisel verilerin aktarıldığı üçüncü kişileri bilme,</li>
              <li>Kişisel verilerin eksik veya yanlış işlenmiş olması hâlinde bunların düzeltilmesini isteme,</li>
              <li>KVKK 7. maddede öngörülen şartlar çerçevesinde kişisel verilerin silinmesini veya yok edilmesini isteme,</li>
              <li>Düzeltme, silme ve yok edilme işlemlerinin verilerin aktarıldığı üçüncü kişilere bildirilmesini isteme,</li>
              <li>İşlenen verilerin münhasıran otomatik sistemler vasıtasıyla analiz edilmesi suretiyle kişinin kendisi aleyhine bir sonucun ortaya çıkmasına itiraz etme,</li>
              <li>Kişisel verilerin kanuna aykırı olarak işlenmesi sebebiyle zarara uğraması hâlinde zararın giderilmesini talep etme haklarına sahiptir.</li>
            </ul>
            <p className="mt-2 text-xs text-gray-500">
              * Kurumsal çalışanlar, iş ilişkileri kapsamındaki verileri için başvurularını doğrudan işverenlerine (müşteri şirkete) de iletebilirler.
            </p>
          </div>

          <div>
            <h2 className="text-white font-semibold text-base mb-2">
              7. Başvuru ve İletişim
            </h2>
            <p className="mb-1">
              KVKK kapsamındaki haklarınıza, veri taleplerinize ve hesap silme/dışa aktarma işlemlerinize ilişkin başvurularınızı:
            </p>
            <ul className="list-disc list-inside space-y-1 text-gray-400">
              <li>
                E-posta yoluyla:{" "}
                <a href="mailto:satis@audiob2b.com.tr" className="text-orange-400 hover:underline">
                  satis@audiob2b.com.tr
                </a>
              </li>
              <li>
                Posta yoluyla: Kavaklıdere Mah. Konur Sokak No:52/12 Çankaya/Ankara
              </li>
            </ul>
            <p className="mt-3 text-xs text-gray-500">
              Başvurunuzu değerlendirebilmemiz için kimliğinizi doğrulamaya yönelik bilgi istenebilir. Başvurular, niteliğine göre en kısa sürede ve en geç 30 gün içinde sonuçlandırılır.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
