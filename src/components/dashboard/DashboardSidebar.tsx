"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

interface Branding {
  companyName: string;
  logoUrl: string | null;
  brandColor: string;
}

const NAV_EMPLOYEE = [
  { href: "/dashboard", label: "Ana Sayfa", icon: "▦" },
  { href: "/dashboard/library", label: "Kütüphane", icon: "🎧" },
];

const NAV_ADMIN_EXTRA = [
  { href: "/dashboard/team", label: "Ekip", icon: "👥" },
];

export default function DashboardSidebar({
  role,
  name,
  email,
  branding,
}: {
  role: string;
  name: string | null;
  email: string;
  branding: Branding;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const color = branding.brandColor || "#2563eb";

  const nav = role === "COMPANY_ADMIN"
    ? [...NAV_EMPLOYEE, ...NAV_ADMIN_EXTRA]
    : NAV_EMPLOYEE;

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <aside
      className="fixed top-0 left-0 h-full w-60 bg-gray-900 border-r border-gray-800 flex flex-col z-10"
      style={{ borderTop: `3px solid ${color}` }}
    >
      {/* Header: logo veya şirket adı */}
      <div className="px-6 py-5 border-b border-gray-800 flex items-center gap-3 min-h-[72px]">
        {branding.logoUrl ? (
          <img
            src={branding.logoUrl}
            alt={branding.companyName}
            className="max-h-9 max-w-[140px] object-contain"
          />
        ) : (
          <span className="text-white font-bold text-base leading-tight">{branding.companyName}</span>
        )}
        <span
          className="ml-auto text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: color + "22", color }}
        >
          {role === "COMPANY_ADMIN" ? "Yönetici" : "Çalışan"}
        </span>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {nav.map((item) => {
          const active =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                active ? "" : "text-gray-400 hover:text-white hover:bg-gray-800"
              }`}
              style={active ? { backgroundColor: color + "22", color } : {}}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gray-800">
        <div className="px-3 py-2 mb-1">
          <div className="text-white text-sm font-medium truncate">{name || "Kullanıcı"}</div>
          <div className="text-gray-500 text-xs truncate">{email}</div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full text-left px-3 py-2 rounded-xl text-sm font-medium text-gray-400 hover:text-red-400 hover:bg-red-400/10 transition-colors"
        >
          Çıkış Yap
        </button>
      </div>
    </aside>
  );
}
