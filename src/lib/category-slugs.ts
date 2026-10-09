export const CATEGORY_ORDER = [
  "Roman", "İş/Gelişim", "Anı/Biyografi", "Tarih/Mitoloji", "Öykü/Hikâye",
  "Din/Tasavvuf", "Polisiye", "Felsefe", "Bilim/Bilimkurgu", "Çocuk",
  "Genç Okurlar", "Dünya Klasikleri", "Şiir", "Radyo Tiyatrosu", "Dil Öğrenme",
];
export const CATEGORY_LAST = ["İngilizce Kitaplar"];
export const SHELF_LIMIT = 10;

// Kategori adından slug üret — sabit eşleme değil, her zaman algoritmik.
// Türkçe karakter dönüşümü: ç→c, ğ→g, ı→i, ö→o, ş→s, ü→u, â→a
// "/" ve boşluk ve diğer özel karakterler → "-"; küçük harf
export function categoryToSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ş/g, "s")
    .replace(/ü/g, "u")
    .replace(/â/g, "a")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
