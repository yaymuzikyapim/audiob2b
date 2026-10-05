import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-guard";
import AdminShell from "@/components/admin/AdminShell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?from=/dashboard/admin");
  if (user.role !== "COMPANY_ADMIN") redirect("/dashboard");

  const brandColor = user.company?.brandColor ?? "#1E5AA8";
  const companyName = user.company?.name ?? "";
  const logoUrl = user.company?.logoUrl ?? null;

  return (
    <AdminShell
      brandColor={brandColor}
      companyName={companyName}
      logoUrl={logoUrl}
      userName={user.name}
      userEmail={user.email}
    >
      {children}
    </AdminShell>
  );
}
