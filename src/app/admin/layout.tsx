export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-guard";
import AdminSidebar from "@/components/admin/AdminSidebar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user || !user.isActive || user.role !== "SUPER_ADMIN") redirect("/login");

  return (
    <div className="min-h-screen bg-[#080d17] flex">
      <AdminSidebar />
      {/*
        Kenar boşluğu: xl → tam sidebar 224px, md-xl → daraltılmış 64px, mobile → üst bar 56px
      */}
      <main className="flex-1 min-h-screen pt-14 md:pt-0 md:ml-16 xl:ml-[224px]">
        <div className="p-6 xl:p-8">{children}</div>
      </main>
    </div>
  );
}
