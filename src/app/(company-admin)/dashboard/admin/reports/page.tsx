import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-guard";
import AdminReports from "./_AdminReports";

export default async function AdminReportsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "COMPANY_ADMIN") redirect("/dashboard");
  return <AdminReports />;
}
