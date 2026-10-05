import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-guard";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user || !user.isActive) redirect("/login");
  if (user.role === "SUPER_ADMIN") redirect("/admin");

  const branding = {
    companyName: user.company?.name ?? "AudioB2B",
    logoUrl: user.company?.logoUrl ?? null,
    brandColor: user.company?.brandColor ?? "#2563eb",
  };

  return (
    <div className="min-h-screen bg-gray-950 flex">
      <DashboardSidebar
        role={user.role}
        name={user.name ?? null}
        email={user.email}
        branding={branding}
      />
      <main className="flex-1 ml-60 min-h-screen">
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
