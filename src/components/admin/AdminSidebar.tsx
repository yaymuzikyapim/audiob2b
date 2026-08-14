"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";

const NAV = [
  { href: "/admin", label: "Genel Bakış", icon: "▦" },
  { href: "/admin/companies", label: "Şirketler", icon: "🏢" },
  { href: "/admin/books", label: "Kitaplar", icon: "🎧" },
  { href: "/admin/packages", label: "Paketler", icon: "📦" },
  { href: "/admin/reports", label: "Raporlar", icon: "📊" },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <aside className="fixed top-0 left-0 h-full w-60 bg-gray-900 border-r border-gray-800 flex flex-col z-10">
      <div className="px-6 py-5 border-b border-gray-800">
        <span className="text-white font-bold text-lg">AudioB2B</span>
        <span className="ml-2 text-xs text-emerald-400 font-medium bg-emerald-400/10 px-2 py-0.5 rounded-full">Admin</span>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {NAV.map((item) => {
          const active =
            item.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                active
                  ? "bg-emerald-500/15 text-emerald-400"
                  : "text-gray-400 hover:text-white hover:bg-gray-800"
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gray-800">
        <button
          onClick={handleLogout}
          className="w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:text-red-400 hover:bg-red-400/10 transition-colors"
        >
          Çıkış Yap
        </button>
      </div>
    </aside>
  );
}
