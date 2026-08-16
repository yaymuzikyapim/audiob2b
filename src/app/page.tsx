import Image from "next/image";
import Link from "next/link";

export const metadata = {
  title: "AudioB2B — Kurumsal Sesli Kitap Platformu",
  description:
    "Şirketinizin çalışanlarına sesli kitap kütüphanesi sunun. Kurumsal lisans, kolay yönetim, mobil uygulama.",
};

export default function Home() {
  return (
    <main className="min-h-screen bg-white text-gray-900">
      {/* NAV */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <div className="flex items-center gap-2">
          <Image src="/logo.png" alt="AudioB2B" width={56} height={56} className="rounded-xl" priority />
        </div>
        <Link
          href="/login"
          className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
        >
          Giriş Yap →
        </Link>
      </nav>

      {/* HERO */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-24 text-center">
        <span className="inline-block bg-orange-50 text-orange-600 text-xs font-semibold px-3 py-1 rounded-full mb-6 tracking-wide uppercase">
          Kurumsal Sesli Kitap
        </span>
        <h1 className="text-5xl font-extrabold tracking-tight leading-tight mb-6 text-gray-900">
          Çalışanlarınıza en iyi<br />
          <span className="text-orange-500">sesli kitap deneyimini</span> sunun
        </h1>
        <p className="text-xl text-gray-500 max-w-2xl mx-auto mb-10 leading-relaxed">
          AudioB2B, şirketlerin çalışanlarına kurumsal sesli kitap kütüphanesi
          sunduğu B2B platformdur. Kolay yönetim, mobil uygulama, detaylı raporlama.
        </p>
        <a
          href="mailto:satis@audiob2b.com.tr?subject=AudioB2B Demo Talebi"
          className="inline-block bg-orange-500 hover:bg-orange-600 text-white font-semibold px-8 py-4 rounded-xl transition-colors text-base"
        >
          Demo Talep Et
        </a>
      </section>

      {/* FEATURES */}
      <section className="bg-gray-50 py-20">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-14">Neden AudioB2B?</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: "📚",
                title: "Kurumsal Kütüphane",
                desc: "Şirketiniz için seçilmiş sesli kitap koleksiyonu. Roman, kurgu dışı, kişisel gelişim ve daha fazlası.",
              },
              {
                icon: "📱",
                title: "Mobil Uygulama",
                desc: "iOS uygulamasıyla çalışanlar istedikleri zaman, istedikleri yerde dinleyebilir.",
              },
              {
                icon: "📊",
                title: "Yönetim Paneli",
                desc: "Kullanıcı daveti, dinleme raporları ve lisans yönetimi tek panelden.",
              },
              {
                icon: "🔒",
                title: "Güvenli Erişim",
                desc: "Davet sistemiyle yalnızca şirket çalışanları platforma erişebilir.",
              },
              {
                icon: "🎧",
                title: "Kesintisiz Dinleme",
                desc: "Kaldığınız yerden devam, uyku zamanlayıcı, hız kontrolü.",
              },
              {
                icon: "🏢",
                title: "Marka Uyumu",
                desc: "Şirket logonuz ve kurumsal renk palet ile kişiselleştirilmiş deneyim.",
              },
            ].map((f) => (
              <div key={f.title} className="bg-white rounded-2xl p-6 shadow-sm">
                <div className="text-3xl mb-3">{f.icon}</div>
                <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="py-20 max-w-6xl mx-auto px-6">
        <h2 className="text-3xl font-bold text-center mb-14">Nasıl Çalışır?</h2>
        <div className="grid md:grid-cols-3 gap-10 text-center">
          {[
            { step: "1", title: "İletişime Geçin", desc: "Demo talep edin, size uygun paketi birlikte belirleyelim." },
            { step: "2", title: "Çalışanlarınızı Davet Edin", desc: "E-posta ile davet gönderin, çalışanlar uygulamayı indirip anında başlasın." },
            { step: "3", title: "Raporları Takip Edin", desc: "Dinleme istatistikleri ve kullanım raporlarını yönetim panelinden izleyin." },
          ].map((s) => (
            <div key={s.step} className="flex flex-col items-center">
              <div className="w-12 h-12 rounded-full bg-orange-500 text-white font-bold text-lg flex items-center justify-center mb-4">
                {s.step}
              </div>
              <h3 className="font-semibold text-lg mb-2">{s.title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gray-900 py-20 text-center">
        <div className="max-w-2xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-white mb-4">
            Şirketiniz için demo alın
          </h2>
          <p className="text-gray-400 mb-8">
            Size özel fiyatlandırma ve demo için e-posta gönderin.
          </p>
          <a
            href="mailto:satis@audiob2b.com.tr?subject=AudioB2B Demo Talebi"
            className="inline-block bg-orange-500 hover:bg-orange-600 text-white font-semibold px-8 py-4 rounded-xl transition-colors"
          >
            satis@audiob2b.com.tr
          </a>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-gray-900 border-t border-gray-800 py-6 text-center text-gray-500 text-sm">
        <p>
          © 2026 YAY Prodüksiyon Yapım Müzik Film Ltd. Şti. ·{" "}
          <Link href="/privacy" className="hover:text-gray-300 transition-colors">
            Gizlilik Politikası
          </Link>
        </p>
      </footer>
    </main>
  );
}
