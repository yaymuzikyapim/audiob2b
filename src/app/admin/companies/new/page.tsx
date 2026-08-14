import { prisma } from "@/lib/prisma";
import NewCompanyForm from "@/components/admin/NewCompanyForm";

export default async function NewCompanyPage() {
  const packages = await prisma.package.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Yeni Şirket Ekle</h1>
        <p className="text-gray-400 mt-1 text-sm">Kurumsal lisans sözleşmesi imzalanan şirketi kaydedin.</p>
      </div>
      <NewCompanyForm packages={packages} />
    </div>
  );
}
