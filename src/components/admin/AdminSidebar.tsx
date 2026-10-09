"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  Building2,
  Headphones,
  Package,
  BarChart2,
  Bell,
  ClipboardList,
  LogOut,
  Menu,
  X,
} from "lucide-react";

const SIDEBAR_FULL = 224;
const SIDEBAR_COLLAPSED = 64;

const NAV = [
  { href: "/admin", label: "Genel Bakış", icon: LayoutDashboard, exact: true },
  { href: "/admin/companies", label: "Şirketler", icon: Building2 },
  { href: "/admin/books", label: "Kitaplar", icon: Headphones },
  { href: "/admin/packages", label: "Paketler", icon: Package },
  { href: "/admin/reports", label: "Raporlar", icon: BarChart2 },
  { href: "/admin/notifications", label: "Bildirimler", icon: Bell },
  { href: "/admin/demo-requests", label: "Demo Talepleri", icon: ClipboardList },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => { setMobileOpen(false); }, [pathname]);
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  function isActive(item: (typeof NAV)[0]) {
    return item.exact ? pathname === item.href : pathname.startsWith(item.href);
  }

  // ── Ortak nav içeriği (tam / daraltılmış / drawer için) ──────────────────

  const navLinks = (collapsed: boolean) => (
    <nav className="flex-1 p-3 flex flex-col gap-0.5 overflow-y-auto">
      {NAV.map((item) => {
        const active = isActive(item);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            title={collapsed ? item.label : undefined}
            className={`relative flex items-center gap-3 px-3 rounded-xl text-sm font-medium transition-colors min-h-[40px] ${
              collapsed ? "justify-center" : ""
            } ${
              active
                ? "bg-[#0e392f] text-[#35d2a1]"
                : "text-[#a0aec0] hover:text-[#edf3fb] hover:bg-[#1a2a3a]"
            }`}
          >
            <Icon size={18} strokeWidth={active ? 2.2 : 1.8} className="shrink-0" />
            {!collapsed && <span>{item.label}</span>}
          </Link>
        );
      })}
    </nav>
  );

  // ── Çıkış butonu ─────────────────────────────────────────────────────────

  const logoutBtn = (collapsed: boolean) => (
    <div className={`p-3 border-t border-[#263449] ${collapsed ? "flex justify-center" : ""}`}>
      <button
        onClick={handleLogout}
        title={collapsed ? "Çıkış Yap" : undefined}
        className={`flex items-center gap-3 px-3 rounded-xl text-sm font-medium text-[#a0aec0] hover:text-red-400 hover:bg-red-400/10 transition-colors min-h-[40px] ${
          collapsed ? "justify-center w-full" : "w-full"
        }`}
      >
        <LogOut size={18} strokeWidth={1.8} className="shrink-0" />
        {!collapsed && <span>Çıkış Yap</span>}
      </button>
    </div>
  );

  return (
    <>
      {/* ── Masaüstü: tam sidebar (≥1280px) ─────────────────────────────── */}
      <aside
        className="hidden xl:flex fixed top-0 left-0 h-full flex-col z-20 border-r border-[#263449] bg-[#101827]"
        style={{ width: SIDEBAR_FULL }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2 px-5 py-4 border-b border-[#263449]" style={{ minHeight: 64 }}>
          <span className="text-[#edf3fb] font-bold text-base leading-none">AudioB2B</span>
          <span className="ml-1 text-[10px] font-semibold text-[#35d2a1] bg-[#0e392f] px-2 py-0.5 rounded-full">
            Admin
          </span>
        </div>
        {navLinks(false)}
        {logoutBtn(false)}
      </aside>

      {/* ── Tablet: daraltılmış ikon sidebar (768–1279px) ────────────────── */}
      <aside
        className="hidden md:flex xl:hidden fixed top-0 left-0 h-full flex-col z-20 border-r border-[#263449] bg-[#101827] items-center"
        style={{ width: SIDEBAR_COLLAPSED }}
      >
        {/* Logo yalnızca ikon */}
        <div className="flex items-center justify-center border-b border-[#263449] w-full" style={{ height: 64 }}>
          <span className="text-[#35d2a1] font-black text-lg">A</span>
        </div>
        {navLinks(true)}
        {logoutBtn(true)}
      </aside>

      {/* ── Mobil: üst bar + drawer (<768px) ────────────────────────────── */}
      {/* Üst bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-20 h-14 bg-[#101827] border-b border-[#263449] flex items-center px-4 gap-3">
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Menüyü aç"
          className="p-2 text-[#a0aec0] hover:text-[#edf3fb] transition-colors"
        >
          <Menu size={22} />
        </button>
        <span className="text-[#edf3fb] font-bold text-base">AudioB2B</span>
        <span className="text-[10px] font-semibold text-[#35d2a1] bg-[#0e392f] px-2 py-0.5 rounded-full">Admin</span>
      </div>

      {/* Overlay */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-30"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Drawer */}
      {mobileOpen && (
        <div
          className="md:hidden fixed top-0 left-0 bottom-0 z-40 flex flex-col bg-[#101827] border-r border-[#263449]"
          style={{ width: SIDEBAR_FULL, animation: "slideInLeft .18s ease" }}
        >
          <div className="flex items-center justify-between px-5 border-b border-[#263449]" style={{ height: 64 }}>
            <div className="flex items-center gap-2">
              <span className="text-[#edf3fb] font-bold text-base">AudioB2B</span>
              <span className="text-[10px] font-semibold text-[#35d2a1] bg-[#0e392f] px-2 py-0.5 rounded-full">Admin</span>
            </div>
            <button
              onClick={() => setMobileOpen(false)}
              aria-label="Menüyü kapat"
              className="p-2 text-[#a0aec0] hover:text-[#edf3fb] transition-colors"
            >
              <X size={20} />
            </button>
          </div>
          {navLinks(false)}
          {logoutBtn(false)}
        </div>
      )}

      <style>{`
        @keyframes slideInLeft {
          from { transform: translateX(-100%); }
          to   { transform: translateX(0); }
        }
      `}</style>
    </>
  );
}
