import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-guard";
import AdminSidebar from "@/components/admin/AdminSidebar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user || !user.isActive || user.role !== "SUPER_ADMIN") redirect("/login");

  return (
    <div className="min-h-screen bg-gray-950 flex">
      <AdminSidebar />
      <main className="flex-1 ml-60 min-h-screen">
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
