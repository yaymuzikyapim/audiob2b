export interface FAQItem {
  question: string;
  answer: string;
}

export const FAQS: FAQItem[] = [
  {
    question: "AudioB2B kütüphanesinde hangi kategorilerde içerikler bulunuyor?",
    answer:
      "Kütüphanemizde roman ve kurgu, iş ve kişisel gelişim, tarih ve düşünce, dünya klasikleri ve çocuk edebiyatı gibi kategorilerde sesli kitaplar yer alır. Kütüphanemiz, yayınevleri ve hak sahipleriyle yapılan anlaşmalarla düzenli olarak genişletilmektedir.",
  },
  {
    question: "Sistemi şirketimize entegre etmek için IT / bilgi işlem desteği gerekir mi?",
    answer:
      "Hayır, teknik bir IT entegrasyonuna gerek yoktur. Şirket yöneticisi panel üzerinden çalışanlara davet e-postası gönderir. Çalışanlar iOS veya Android uygulamasını indirip bağlantı üzerinden şifrelerini belirleyerek anında dinlemeye başlayabilir.",
  },
  {
    question: "Yönetici panelinde hangi kullanım verilerini ve raporları takip edebiliriz?",
    answer:
      "Yönetici panelinden şirket genelindeki toplam dinleme süresini, aktif kullanıcı sayısını, tamamlanan kitap sayısını ve en çok dinlenen eserleri takip edebilirsiniz. Raporları Excel ve PDF olarak indirebilirsiniz.",
  },
  {
    question: "İnternet bağlantısı olmayan durumlarda (uçak, saha vb.) dinleme yapılabilir mi?",
    answer:
      "Evet. Mobil uygulamamız üzerinden kitaplar cihaza indirilerek seyahatlerde veya internet erişiminin kısıtlı olduğu ortamlarda çevrimdışı (offline) dinlenebilir.",
  },
  {
    question: "Şirketten ayrılan bir çalışanın yerine yeni başlayan bir çalışan dahil edilebilir mi?",
    answer:
      "Evet. Ayrılan çalışanın hesabını yönetici panelinden pasife aldığınızda lisansı boşa çıkar; yeni çalışana davet göndererek aynı lisansı sözleşme süresinin sonuna kadar kullandırabilirsiniz.",
  },
  {
    question: "Kişisel veriler ve KVKK süreçleri nasıl işletiliyor?",
    answer:
      "Hizmetin sunulması için çalışanın adı, kurumsal e-posta adresi ve dinleme geçmişi işlenir; kimlik numarası, sağlık verisi veya finansal veri toplanmaz. Veriler şifreli bağlantı (HTTPS/TLS) üzerinden iletilir, parolalar geri döndürülemez biçimde (bcrypt) saklanır. Veritabanı ve ses dosyaları Avrupa Birliği'nde (Frankfurt) barındırılır; web barındırma ve e-posta iletimi için ABD merkezli hizmet sağlayıcılar kullanılır. Ayrıntılar için Gizlilik Politikası ve Aydınlatma Metnimizi inceleyebilirsiniz.",
  },
  {
    question: "Lisanslama ve fiyatlandırma nasıl işliyor?",
    answer:
      "AudioB2B kişi başı, yıllık lisans modeliyle sunulur. En az kullanıcı sayısı şartı yoktur; kurumunuzun ihtiyacına göre istediğiniz sayıda lisansla başlayabilir, yıl içinde ek lisans alabilirsiniz. Fiyatlandırma kullanıcı sayısı ve sözleşme koşullarına göre kurumunuza özel olarak hazırlanır. Teklif almak için demo formunu doldurmanız yeterlidir.",
  },
  {
    question: "Kurumsal deneme veya demo talep edebilir miyiz?",
    answer:
      "Evet. Demo formunu doldurmanız yeterli; sizinle iletişime geçip kurumunuz için süresi ve kullanıcı sayısı birlikte belirlenen bir deneme hesabı açıyoruz.",
  },
];
