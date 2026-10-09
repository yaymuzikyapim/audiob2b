export interface FAQItem {
  question: string;
  answer: string;
}

export const FAQS: FAQItem[] = [
  {
    question: "AudioB2B kütüphanesinde hangi kategorilerde içerikler bulunuyor?",
    answer:
      "Kütüphanemizde 1.000'i aşkın sesli kitap bulunur: roman ve kurgu, iş ve kişisel gelişim, tarih ve düşünce, dünya klasikleri ve çocuk edebiyatı gibi kategorilerde. Kütüphanemiz, yayınevleri ve hak sahipleriyle yapılan anlaşmalarla düzenli olarak genişletilmektedir.",
  },
  {
    question: "Sistemi şirketimize entegre etmek için IT / bilgi işlem desteği gerekir mi?",
    answer:
      "Hayır, teknik bir IT entegrasyonu gerekmez. Şirket yöneticisi panel üzerinden çalışanlara davet e-postası gönderir; çalışanlar iOS veya Android uygulamasını indirip davet bağlantısıyla hesaplarını etkinleştirerek dinlemeye başlar. Davet e-postaları bildirim@audiob2b.com.tr adresinden gelir; kurumsal e-posta filtreleriniz varsa bu adresin izinli gönderenlere eklenmesini öneririz.",
  },
  {
    question: "Yönetici panelinde hangi kullanım verilerini ve raporları takip edebiliriz?",
    answer:
      "Yönetici panelinden şirket genelindeki toplam dinleme süresini, aktif kullanıcı sayısını, tamamlanan kitap sayısını ve en çok dinlenen eserleri takip edebilir; raporları Excel ve PDF olarak indirebilirsiniz.",
  },
  {
    question: "İnternet bağlantısı olmayan durumlarda (uçak, saha vb.) dinleme yapılabilir mi?",
    answer:
      "Evet. Mobil uygulamada cihaza indirilen kitaplar internet bağlantısı olmadan dinlenebilir. Lisans süresi sona erdiğinde uygulamaya erişim kapanır.",
  },
  {
    question: "Şirketten ayrılan bir çalışanın yerine yeni başlayan bir çalışan dahil edilebilir mi?",
    answer:
      "Evet. Ayrılan çalışanın hesabını yönetici panelinden pasife aldığınızda lisansı boşa çıkar; yeni çalışana davet göndererek aynı lisansı sözleşme süresinin sonuna kadar kullandırabilirsiniz.",
  },
  {
    question: "Yöneticiler çalışanların hangi kitapları dinlediğini görebilir mi?",
    answer:
      "Hayır. Yönetici panelinde çalışan bazında yalnızca özet bilgiler yer alır: toplam dinleme süresi, dinlenen kitap sayısı, son dinleme tarihi ve ortalama ilerleme. Hangi çalışanın hangi kitabı dinlediği gösterilmez; kitap bazındaki raporlar kurum geneli için toplu olarak sunulur.",
  },
  {
    question: "Kişisel veriler ve KVKK süreçleri nasıl işletiliyor?",
    answer:
      "Hizmetin sunulması için çalışanın adı, kurumsal e-posta adresi ve kullanım verileri (dinlenen kitaplar, dinleme süreleri) ile IP adresi gibi teknik veriler işlenir; kimlik numarası, sağlık verisi veya finansal veri toplanmaz. Veriler şifreli bağlantı (HTTPS/TLS) üzerinden iletilir, parolalar geri döndürülemez biçimde (bcrypt) saklanır. Veritabanı ve ses dosyaları Avrupa Birliği'nde (Frankfurt) barındırılır; web barındırma ve e-posta iletimi için ABD merkezli hizmet sağlayıcılar kullanılır. Platformda yalnızca oturum için gerekli bir çerez kullanılır; analitik veya reklam aracı yoktur. Ayrıntılar için Gizlilik Politikası ve Aydınlatma Metnimizi inceleyebilirsiniz.",
  },
  {
    question: "Lisanslama ve fiyatlandırma nasıl işliyor?",
    answer:
      "AudioB2B kişi başı, yıllık lisans modeliyle sunulur. En az kullanıcı sayısı şartı yoktur; kurumunuzun ihtiyacına göre istediğiniz sayıda lisansla başlayabilir, yıl içinde ek lisans alabilirsiniz. Fiyatlandırma kullanıcı sayısı ve sözleşme koşullarına göre kurumunuza özel olarak hazırlanır. Teklif almak için demo formunu doldurmanız yeterlidir.",
  },
  {
    question: "Kurumsal deneme veya demo talep edebilir miyiz?",
    answer:
      "Evet. Demo formunu doldurmanız yeterli; sizinle iletişime geçip kurumunuz için süresi ve kullanıcı sayısı birlikte belirlenen bir deneme hesabı açıyoruz. Deneme süresi sonunda erişim otomatik olarak kapanır.",
  },
];
