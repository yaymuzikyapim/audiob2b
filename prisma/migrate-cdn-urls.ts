/**
 * Mevcut /api/covers/ ve /api/logos/ URL'lerini CloudFront URL'lerine çevirir.
 * Çalıştırmadan önce CLOUDFRONT_URL env değişkenini set et.
 *
 * Kullanım:
 *   CLOUDFRONT_URL=https://dXXXXXXXXXXXX.cloudfront.net \
 *   npx tsx prisma/migrate-cdn-urls.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const CDN = process.env.CLOUDFRONT_URL?.replace(/\/$/, "");

if (!CDN) {
  console.error("CLOUDFRONT_URL env değişkeni set edilmemiş.");
  process.exit(1);
}

function toCdn(url: string, prefix: "covers" | "logos"): string {
  // /api/covers/abc.jpg  →  https://xxx.cloudfront.net/covers/abc.jpg
  const match = url.match(new RegExp(`/api/${prefix}/(.+)`));
  if (match) return `${CDN}/${prefix}/${match[1]}`;
  return url; // zaten CDN URL'i veya başka bir şey
}

async function main() {
  // Kitap kapakları
  const books = await prisma.book.findMany({
    where: { coverUrl: { startsWith: "/api/covers/" } },
    select: { id: true, coverUrl: true },
  });
  console.log(`Güncellenecek kitap: ${books.length}`);
  for (const b of books) {
    await prisma.book.update({
      where: { id: b.id },
      data: { coverUrl: toCdn(b.coverUrl!, "covers") },
    });
  }

  // Seri kapakları (varsa)
  const series = await prisma.series.findMany({
    where: { coverUrl: { startsWith: "/api/covers/" } },
    select: { id: true, coverUrl: true },
  });
  console.log(`Güncellenecek seri: ${series.length}`);
  for (const s of series) {
    await prisma.series.update({
      where: { id: s.id },
      data: { coverUrl: toCdn(s.coverUrl!, "covers") },
    });
  }

  // Şirket logoları
  const companies = await prisma.company.findMany({
    where: { logoUrl: { startsWith: "/api/logos/" } },
    select: { id: true, logoUrl: true },
  });
  console.log(`Güncellenecek şirket logosu: ${companies.length}`);
  for (const c of companies) {
    await prisma.company.update({
      where: { id: c.id },
      data: { logoUrl: toCdn(c.logoUrl!, "logos") },
    });
  }

  console.log("Migration tamamlandı.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
