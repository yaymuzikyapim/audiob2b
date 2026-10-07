export interface FAQItem {
  question: string;
  answer: string;
}

export const FAQS: FAQItem[] = [
  {
    question: "AudioB2B kütüphanesinde hangi kategorilerde içerikler bulunuyor?",
    answer:
      "Kütüphanemizde roman ve kurgu, iş ve kişisel gelişim, tarih ve düşünce, dünya klasikleri ve çocuk edebiyatı gibi kategorilerde sesli kitaplar yer alır. Tüm içerikler yayınevlerinden lisanslıdır.",
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
      "Hizmetin sunulması için çalışanın adı, kurumsal e-posta adresi ve dinleme geçmişi işlenir; kimlik numarası, sağlık verisi veya finansal veri toplanmaz. Veriler şifreli bağlantı (HTTPS/TLS) üzerinden iletilir, parolalar geri döndürülemez biçimde (bcrypt) saklanır. Ayrıntılar için Gizlilik Politikası ve Aydınlatma Metnimizi inceleyebilirsiniz.",
  },
  {
    question: "Kurumsal deneme veya demo talep edebilir miyiz?",
    answer:
      "Evet. Demo formunu doldurmanız yeterli; sizinle iletişime geçip kurumunuz için süresi ve kullanıcı sayısı birlikte belirlenen bir deneme hesabı açıyoruz.",
  },
];
