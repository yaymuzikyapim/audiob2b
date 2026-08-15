export const metadata = { title: "Gizlilik Politikası – AudioB2B" };

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-gray-950 text-gray-300">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold text-white mb-2">Gizlilik Politikası</h1>
        <p className="text-gray-500 text-sm mb-10">Son güncelleme: Ağustos 2026</p>

        <section className="space-y-8 text-sm leading-relaxed">
          <div>
            <h2 className="text-white font-semibold text-base mb-2">1. Genel Bakış</h2>
            <p>AudioB2B ("uygulama"), YAY Prodüksiyon Yapım Müzik Film Organizasyon Reklam İç ve Dış Ticaret Limited Şirketi tarafından işletilmektedir. Bu politika, uygulamayı kullanan bireyler ve şirketlerin verilerinin nasıl toplandığını, kullanıldığını ve korunduğunu açıklar.</p>
          </div>

          <div>
            <h2 className="text-white font-semibold text-base mb-2">2. Toplanan Veriler</h2>
            <ul className="list-disc list-inside space-y-1 text-gray-400">
              <li>Ad, e-posta adresi ve şirket bilgisi (kayıt sırasında)</li>
              <li>Oturum açma tarihleri ve uygulama kullanım verileri</li>
              <li>Sesli kitap dinleme geçmişi ve favori listesi</li>
              <li>Push bildirim tokeni (bildirim iznine bağlı)</li>
            </ul>
          </div>

          <div>
            <h2 className="text-white font-semibold text-base mb-2">3. Verilerin Kullanımı</h2>
            <p>Toplanan veriler yalnızca hizmetin sunulması, kullanıcı hesabının yönetilmesi ve uygulama performansının iyileştirilmesi amacıyla kullanılır. Verileriniz üçüncü taraflarla satılmaz veya pazarlama amacıyla paylaşılmaz.</p>
          </div>

          <div>
            <h2 className="text-white font-semibold text-base mb-2">4. Veri Güvenliği</h2>
            <p>Verileriniz şifreli bağlantılar (HTTPS) üzerinden iletilir ve güvenli bulut altyapısında saklanır. Şifreler tek yönlü karma (bcrypt) ile korunur.</p>
          </div>

          <div>
            <h2 className="text-white font-semibold text-base mb-2">5. Üçüncü Taraf Hizmetler</h2>
            <p>Uygulama altyapısı için Supabase (veritabanı) ve Vercel (barındırma) hizmetlerinden yararlanılmaktadır. Bu hizmetlerin kendi gizlilik politikaları geçerlidir.</p>
          </div>

          <div>
            <h2 className="text-white font-semibold text-base mb-2">6. Haklarınız</h2>
            <p>Hesabınıza ait verilerin silinmesini veya dışa aktarılmasını talep etmek için aşağıdaki e-posta adresinden bize ulaşabilirsiniz.</p>
          </div>

          <div>
            <h2 className="text-white font-semibold text-base mb-2">7. İletişim</h2>
            <p>Sorularınız için: <a href="mailto:yay@yayyapim.com" className="text-blue-400 hover:underline">yay@yayyapim.com</a></p>
          </div>
        </section>
      </div>
    </main>
  );
}
