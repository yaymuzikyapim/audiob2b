import Image from "next/image";
import Link from "next/link";

export const metadata = {
  title: "AudioB2B — Kurumsal Sesli Kitap Platformu",
  description:
    "Şirketinizin çalışanlarına sesli kitap kütüphanesi sunun. Kurumsal lisans, kolay yönetim, mobil uygulama.",
};

const APP_STORE_URL  = "https://apps.apple.com/tr/app/audiob2b/id6801790848?l=tr";
const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.audiob2b.mobile&pcampaignid=web_share";

const COVERS = [
  { url: "https://audiob2b-audio-files.s3.eu-central-1.amazonaws.com/covers/9786055571344.png",  title: "İnsan Ne İle Yaşar" },
  { url: "https://audiob2b-audio-files.s3.eu-central-1.amazonaws.com/covers/9786257888424.png",  title: "Sokrates'in Savunması" },
  { url: "https://audiob2b-audio-files.s3.eu-central-1.amazonaws.com/covers/9786255578853.jpg",  title: "Silahlara Veda" },
  { url: "https://dj37r9f1t56v.cloudfront.net/covers/d83146c5-70dc-4506-abdf-eb88b6cfbb1e.jpg",  title: "Çok Hayal Kuran Çocuk" },
  { url: "https://audiob2b-audio-files.s3.eu-central-1.amazonaws.com/covers/9786255577177.png",  title: "At Şu Adımı" },
  { url: "https://dj37r9f1t56v.cloudfront.net/covers/4c9cb1a6-57a5-492d-91ce-131b0fd945f6.jpg",  title: "Gençler İçin Nutuk" },
  { url: "https://audiob2b-audio-files.s3.eu-central-1.amazonaws.com/covers/9786257112505.png",  title: "Mikrobiyota" },
  { url: "https://audiob2b-audio-files.s3.eu-central-1.amazonaws.com/covers/9786257353144.png",  title: "Aganta Burina Burinata" },
  { url: "https://audiob2b-audio-files.s3.eu-central-1.amazonaws.com/covers/9786255578068.jpg",  title: "Kur'an-ı Kerim" },
  { url: "https://audiob2b-audio-files.s3.eu-central-1.amazonaws.com/covers/9786258477061.png",  title: "Listen Up!" },
  { url: "https://audiob2b-audio-files.s3.eu-central-1.amazonaws.com/covers/9786055212568.jpg",  title: "Küçük Prens" },
  { url: "https://audiob2b-audio-files.s3.eu-central-1.amazonaws.com/covers/9786257353427.png",  title: "Söylenceler - Odysseia" },
];

// Sonsuz marquee için listeyi çiftleriz
const COVERS_DOUBLED = [...COVERS, ...COVERS];

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
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-16 text-center">
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

        {/* Mağaza rozeti */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-8">
          <a
            href={APP_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 bg-black text-white px-5 py-3 rounded-xl hover:bg-gray-800 transition-colors"
          >
            {/* Apple logo */}
            <svg viewBox="0 0 24 24" className="w-6 h-6 fill-white flex-shrink-0" xmlns="http://www.w3.org/2000/svg">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
            </svg>
            <div className="text-left">
              <p className="text-xs text-gray-400 leading-none">App Store'dan İndir</p>
              <p className="text-sm font-semibold leading-snug">iOS Uygulaması</p>
            </div>
          </a>

          <a
            href={PLAY_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 bg-black text-white px-5 py-3 rounded-xl hover:bg-gray-800 transition-colors"
          >
            {/* Google Play logo */}
            <svg viewBox="0 0 24 24" className="w-6 h-6 flex-shrink-0" xmlns="http://www.w3.org/2000/svg">
              <path d="M3.18 23.76c.3.17.63.24.97.21l13.2-11.97-2.97-2.97L3.18 23.76z" fill="#EA4335"/>
              <path d="M22.54 10.42l-3.48-1.96-3.3 2.97 3.3 3.3 3.51-1.98c1-.57 1-.99 1-1.17-.01-.18-.03-.59-1.03-1.16z" fill="#FBBC04"/>
              <path d="M3.18.24a1.23 1.23 0 00-.94 1.26v21c0 .54.32.95.77 1.26l.12.09L14.4 12.02v-.28L3.18.24z" fill="#4285F4"/>
              <path d="M14.4 12l3.84-3.84L4.9.3C4.55.1 4.1.05 3.7.2L14.4 12z" fill="#34A853"/>
            </svg>
            <div className="text-left">
              <p className="text-xs text-gray-400 leading-none">Google Play'de İndir</p>
              <p className="text-sm font-semibold leading-snug">Android Uygulaması</p>
            </div>
          </a>
        </div>
      </section>

      {/* BOOK SHOWCASE — sonsuz kayan şerit */}
      <section className="py-14 bg-gray-50 overflow-hidden">
        <div className="max-w-6xl mx-auto px-6 text-center mb-10">
          <h2 className="text-3xl font-bold mb-3">Kütüphanemizden Seçmeler</h2>
          <p className="text-gray-500 text-lg">Yüzlerce sesli kitap, çalışanlarınızın parmaklarının ucunda</p>
        </div>

        {/* Sonsuz marquee şeridi */}
        <div className="flex overflow-hidden select-none">
          <div className="flex gap-4 animate-marquee flex-shrink-0">
            {COVERS_DOUBLED.map((book, i) => (
              <div
                key={i}
                className="relative flex-shrink-0 w-44 h-44 rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-shadow duration-300"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={book.url}
                  alt={book.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* APP SCREENSHOTS */}
      <section className="bg-white py-20 overflow-hidden">
        <div className="max-w-6xl mx-auto px-6 text-center mb-14">
          <h2 className="text-3xl font-bold mb-3">Uygulamayı Keşfet</h2>
          <p className="text-gray-500 text-lg">iOS ve Android'de sorunsuz dinleme deneyimi</p>
        </div>
        <div className="flex justify-center gap-6 flex-wrap">
          {[
            { src: "/screenshots/screen-library.webp",    label: "Kütüphane",    bg: "from-orange-100 to-amber-50" },
            { src: "/screenshots/screen-book.webp",       label: "Kitap Detayı", bg: "from-blue-100 to-indigo-50" },
            { src: "/screenshots/screen-player.webp",     label: "Oynatıcı",     bg: "from-stone-700 to-stone-900" },
            { src: "/screenshots/screen-categories.webp", label: "Kategoriler",  bg: "from-rose-100 to-pink-50" },
          ].map((s, i) => (
            <div key={i} className="flex flex-col items-center gap-3">
              {/* Telefon çerçevesi */}
              <div className={`relative bg-gradient-to-b ${s.bg} rounded-[2.8rem] p-2 shadow-2xl`}
                style={{ width: 172, height: 372 }}>
                {/* Dinamik ada (notch yerine) */}
                <div className="absolute top-4 left-1/2 -translate-x-1/2 w-20 h-5 bg-black rounded-full z-10" />
                {/* Ekran */}
                <div className="w-full h-full rounded-[2.4rem] overflow-hidden bg-white">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.src} alt={s.label} className="w-full h-full object-cover object-top" />
                </div>
                {/* Yan butonlar */}
                <div className="absolute -right-1 top-20 w-1 h-10 bg-gray-400 rounded-r-full" />
                <div className="absolute -left-1 top-16 w-1 h-8 bg-gray-400 rounded-l-full" />
                <div className="absolute -left-1 top-28 w-1 h-8 bg-gray-400 rounded-l-full" />
              </div>
              <span className="text-sm font-medium text-gray-500">{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section className="bg-white py-20">
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
                desc: "iOS ve Android uygulamalarıyla çalışanlar istedikleri zaman, istedikleri yerde dinleyebilir.",
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
              <div key={f.title} className="bg-gray-50 rounded-2xl p-6 shadow-sm">
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

      {/* APP DOWNLOAD CTA */}
      <section className="bg-gray-900 py-20 text-center">
        <div className="max-w-2xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-white mb-4">
            Uygulamayı hemen indirin
          </h2>
          <p className="text-gray-400 mb-8">
            iOS ve Android için ücretsiz. Şirketiniz aboneyse anında başlayın.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-10">
            <a
              href={APP_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 bg-white text-gray-900 px-6 py-3 rounded-xl hover:bg-gray-100 transition-colors font-semibold"
            >
              <svg viewBox="0 0 24 24" className="w-6 h-6 fill-gray-900 flex-shrink-0" xmlns="http://www.w3.org/2000/svg">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
              </svg>
              App Store
            </a>
            <a
              href={PLAY_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 bg-white text-gray-900 px-6 py-3 rounded-xl hover:bg-gray-100 transition-colors font-semibold"
            >
              <svg viewBox="0 0 24 24" className="w-6 h-6 flex-shrink-0" xmlns="http://www.w3.org/2000/svg">
                <path d="M3.18 23.76c.3.17.63.24.97.21l13.2-11.97-2.97-2.97L3.18 23.76z" fill="#EA4335"/>
                <path d="M22.54 10.42l-3.48-1.96-3.3 2.97 3.3 3.3 3.51-1.98c1-.57 1-.99 1-1.17-.01-.18-.03-.59-1.03-1.16z" fill="#FBBC04"/>
                <path d="M3.18.24a1.23 1.23 0 00-.94 1.26v21c0 .54.32.95.77 1.26l.12.09L14.4 12.02v-.28L3.18.24z" fill="#4285F4"/>
                <path d="M14.4 12l3.84-3.84L4.9.3C4.55.1 4.1.05 3.7.2L14.4 12z" fill="#34A853"/>
              </svg>
              Google Play
            </a>
          </div>
          <p className="text-gray-500 text-sm">
            Demo veya kurumsal fiyatlandırma için:{" "}
            <a href="mailto:satis@audiob2b.com.tr" className="text-orange-400 hover:text-orange-300 transition-colors">
              satis@audiob2b.com.tr
            </a>
          </p>
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
