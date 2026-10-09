import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-guard";
import AdminDashboard from "./_AdminDashboard";

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "COMPANY_ADMIN") redirect("/dashboard");
  return <AdminDashboard />;
}
