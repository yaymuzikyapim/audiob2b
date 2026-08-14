import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const CATEGORIES = [
  { name: "Roman",      slug: "roman" },
  { name: "Kurgu Dışı", slug: "kurgu-disi" },
  { name: "İş/Finans",  slug: "is-finans" },
  { name: "Çocuk",      slug: "cocuk" },
];

async function main() {
  for (const cat of CATEGORIES) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: { name: cat.name },
      create: cat,
    });
    console.log(`✅ ${cat.name}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
