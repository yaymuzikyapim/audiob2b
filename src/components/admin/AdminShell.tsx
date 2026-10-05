"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  BarChart2,
  Library,
  ChevronRight,
  LogOut,
  Headphones,
} from "lucide-react";

interface AdminShellProps {
  brandColor: string;
  companyName: string;
  logoUrl: string | null;
  userName: string | null;
  userEmail: string;
  children: React.ReactNode;
}

const NAV = [
  { href: "/dashboard/admin", label: "Genel Bakış", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/admin/users", label: "Kullanıcılar", icon: Users },
  { href: "/dashboard/admin/reports", label: "Raporlar", icon: BarChart2 },
  { href: "/dashboard/admin/library", label: "Kütüphane", icon: Library, soon: true },
];

export default function AdminShell({
  brandColor,
  companyName,
  logoUrl,
  userName,
  userEmail,
  children,
}: AdminShellProps) {
  const pathname = usePathname();
  const router = useRouter();

  const brand = brandColor || "#1E5AA8";

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <div data-theme="company-admin" className="flex min-h-screen" style={{ fontFamily: "'IBM Plex Sans', 'Segoe UI', system-ui, sans-serif" }}>
      {/* Sol Nav */}
      <aside
        className="fixed top-0 left-0 h-full flex flex-col z-20"
        style={{
          width: 260,
          background: "#FFFFFF",
          borderRight: "1px solid #E3E6EA",
        }}
      >
        {/* Logo + Şirket Adı */}
        <div
          className="flex items-center gap-3 px-6 py-5 border-b"
          style={{ borderColor: "#E3E6EA", minHeight: 72 }}
        >
          {logoUrl ? (
            <img src={logoUrl} alt={companyName} className="max-h-8 max-w-[130px] object-contain" />
          ) : (
            <span className="font-semibold text-sm leading-tight" style={{ color: "#14181F" }}>
              {companyName}
            </span>
          )}
          <span
            className="ml-auto text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: brand + "18", color: brand }}
          >
            Yönetici
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-4 py-4 space-y-0.5">
          {NAV.map((item) => {
            const active = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.soon ? "#" : item.href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors"
                style={
                  active
                    ? { backgroundColor: brand + "14", color: brand }
                    : { color: item.soon ? "#9EA6B3" : "#3A414C" }
                }
                aria-disabled={item.soon}
                onClick={item.soon ? (e) => e.preventDefault() : undefined}
              >
                <Icon size={18} strokeWidth={1.8} />
                <span className="flex-1">{item.label}</span>
                {item.soon && (
                  <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "#F0F2F5", color: "#9EA6B3" }}>
                    Yakında
                  </span>
                )}
                {active && !item.soon && <ChevronRight size={14} style={{ color: brand }} />}
              </Link>
            );
          })}
        </nav>

        {/* Dinlemeye dön */}
        <div className="px-4 pb-2">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm transition-colors"
            style={{ color: "#5A6270" }}
          >
            <Headphones size={16} strokeWidth={1.8} />
            Dinlemeye dön
          </Link>
        </div>

        {/* Kullanıcı */}
        <div className="p-4 border-t" style={{ borderColor: "#E3E6EA" }}>
          <div className="px-3 py-2 mb-1">
            <div className="text-sm font-medium truncate" style={{ color: "#14181F" }}>
              {userName || "Kullanıcı"}
            </div>
            <div className="text-xs truncate" style={{ color: "#9EA6B3" }}>
              {userEmail}
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors"
            style={{ color: "#5A6270" }}
          >
            <LogOut size={15} strokeWidth={1.8} />
            Çıkış Yap
          </button>
        </div>
      </aside>

      {/* Ana içerik */}
      <main className="flex-1" style={{ marginLeft: 260, background: "#F4F5F7", minHeight: "100vh" }}>
        {children}
      </main>
    </div>
  );
}
