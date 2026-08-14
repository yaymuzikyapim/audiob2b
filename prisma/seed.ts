import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = "aliye@sesle.com.tr";
  const password = "sesle2026";

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log("Süper admin zaten mevcut:", email);
    return;
  }

  const hashed = await bcrypt.hash(password, 12);

  await prisma.user.create({
    data: {
      email,
      name: "Aliye Yağmur",
      password: hashed,
      role: "SUPER_ADMIN",
    },
  });

  console.log("✅ Süper admin oluşturuldu:");
  console.log("   E-posta:", email);
  console.log("   Şifre  :", password);
  console.log("\n⚠️  Giriş yaptıktan sonra şifrenizi değiştirin!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
