import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import bcrypt from "bcryptjs";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const company = await prisma.company.findFirst({
    where: { name: { contains: "TPAO" } },
    select: { id: true, name: true },
  });
  if (!company) { console.log("Şirket bulunamadı"); return; }
  console.log("Şirket:", company.name);

  const hash = await bcrypt.hash("Test1234!", 10);
  const user = await prisma.user.upsert({
    where: { email: "admin@tpao-test.com" },
    update: { password: hash, companyId: company.id, role: "COMPANY_ADMIN", isActive: true },
    create: { email: "admin@tpao-test.com", password: hash, name: "Test Yönetici", role: "COMPANY_ADMIN", isActive: true, companyId: company.id },
    select: { id: true, email: true, role: true },
  });
  console.log("Kullanıcı oluşturuldu:", user.email, user.role);
}

main().catch(console.error).finally(() => prisma.$disconnect());
