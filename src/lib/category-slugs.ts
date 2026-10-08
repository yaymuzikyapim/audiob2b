export const CATEGORY_ORDER = [
  "Roman", "İş/Gelişim", "Anı/Biyografi", "Tarih/Mitoloji", "Öykü/Hikâye",
  "Din/Tasavvuf", "Polisiye", "Felsefe", "Bilim/Bilimkurgu", "Çocuk",
  "Genç Okurlar", "Dünya Klasikleri", "Şiir", "Radyo Tiyatrosu", "Dil Öğrenme",
];
export const CATEGORY_LAST = ["İngilizce Kitaplar"];
export const SHELF_LIMIT = 10;

const SLUG_MAP: Record<string, string> = {
  "Roman": "roman",
  "İş/Gelişim": "is-gelisim",
  "Anı/Biyografi": "ani-biyografi",
  "Tarih/Mitoloji": "tarih-mitoloji",
  "Öykü/Hikâye": "oyku-hikaye",
  "Din/Tasavvuf": "din-tasavvuf",
  "Polisiye": "polisiye",
  "Felsefe": "felsefe",
  "Bilim/Bilimkurgu": "bilim-bilimkurgu",
  "Çocuk": "cocuk",
  "Genç Okurlar": "genc-okurlar",
  "Dünya Klasikleri": "dunya-klasikleri",
  "Şiir": "siir",
  "Radyo Tiyatrosu": "radyo-tiyatrosu",
  "Dil Öğrenme": "dil-ogrenme",
  "İngilizce Kitaplar": "ingilizce-kitaplar",
};

const NAME_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(SLUG_MAP).map(([name, slug]) => [slug, name])
);

export function categoryToSlug(name: string): string {
  return SLUG_MAP[name] ?? name
    .toLowerCase()
    .replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s")
    .replace(/ı/g, "i").replace(/ö/g, "o").replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function slugToCategory(slug: string): string | null {
  return NAME_MAP[slug] ?? null;
}
