import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "SUPER_ADMIN") redirect("/admin");

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: {
      company: {
        select: { name: true, logoUrl: true, brandColor: true },
      },
    },
  });

  const branding = {
    companyName: user?.company?.name ?? "AudioB2B",
    logoUrl: user?.company?.logoUrl ?? null,
    brandColor: user?.company?.brandColor ?? "#2563eb",
  };

  return (
    <div className="min-h-screen bg-gray-950 flex">
      <DashboardSidebar
        role={session.role}
        name={session.name ?? null}
        email={session.email}
        branding={branding}
      />
      <main className="flex-1 ml-60 min-h-screen">
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
